/**
 * Copyright 2021 Splunk Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. 
 */

'use strict'

const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const path = require('path')
const os = require('os')
const request = require('requestretry')
const LockManager = require('../lock_manager')
const models = require('../../models')
const CONST = require('../constant')
const dockerLib = require('../docker')
const logger = require('../logger').create('Deployment')
const retry = require('../retry')

const status = {
  READY: 'READY',
  PENDING: 'PENDING',
  NOT_DEPLOYED: 'NOT DEPLOYED'
}

class DeploymentHandlerLocal {
  /**
   * Creates a deployment handler
   *
   * @param {Object} doc
   */
  constructor (doc, authService, configs) {
    this.doc = doc
    const volume = CONST.DEPLOYMENT_LOCAL.VOLUME
    const pathMountHost = path.join(volume, this.doc._id)
    const pathMountContainer = '/mount'
    this.mount = [`${pathMountHost}:${pathMountContainer}`]
    this.containerPort = CONST.DEPLOYMENT_LOCAL.PORT
    this.env = {
      AUTH_SECRET: authService.getJwtSecret(),
      AUTH_REDIRECT: authService.getLoginUrl(),
      AUTH_LOGOUT_URL: authService.getLogoutUrl(),
      PORT: this.containerPort,
      DOC_ID: this.doc._id,
      SERVICE_PROGRESS: configs.services.progress,
      SERVICE_CATALOG: configs.services.catalog
    }
    this.useBridge = !!CONST.DEPLOYMENT_LOCAL.BRIDGE
  }

  async _startDocContainer (image, name, mount, env) {
    // Volume Mounts
    const mountStr = mount
      .map(value => {
        return `-v ${value}`
      })
      .join(' ')

    // Environment Variables
    const envStr = Object.keys(env)
      .map(key => {
        return `-e "${key}=${env[key]}"`
      })
      .join(' ')

    // Log Driver Configuration
    let logStr = CONST.CONFIG.LOG_SPLUNK
      ? '--log-opt splunk-insecureskipverify=true ' +
        '--log-driver=splunk ' +
        '--log-opt splunk-format=json ' +
        `--log-opt splunk-token=${CONST.CONFIG.LOG_SPLUNK_TOKEN} ` +
        `--log-opt splunk-url=${CONST.CONFIG.LOG_SPLUNK_URL}`
      : ''
    if (CONST.CONFIG.LOG_SPLUNK_INDEX) {
      logStr += ` --log-opt splunk-index=${CONST.CONFIG.LOG_SPLUNK_INDEX}`
    }
    if (CONST.CONFIG.LOG_SPLUNK_SOURCE) {
      logStr += ` --log-opt splunk-source=${CONST.CONFIG.LOG_SPLUNK_SOURCE}`
    }
    if (CONST.CONFIG.LOG_SPLUNK_SOURCETYPE) {
      logStr += ` --log-opt splunk-sourcetype=${CONST.CONFIG.LOG_SPLUNK_SOURCETYPE}`
    }

    // Network
    const networkStr = CONST.DEPLOYMENT_LOCAL.BRIDGE
      ? `--network ${CONST.DEPLOYMENT_LOCAL.BRIDGE}`
      : ''
    const portStr = this.useBridge ? '' : '-P'

    const command =
      `docker run --rm -d ${portStr} ` +
      `${logStr} ${envStr} ${mountStr} ${networkStr} ` +
      `--name ${name} ${image}@${this.doc.digest}`

    logger.debug({
      message: 'Starting Doc Container',
      command: command,
      arguments: arguments
    })
    try {
      const val = await exec(command)
      const containerId = val.stdout.split(os.EOL)[0].trim()
      logger.debug({
        message: `Successfully created a Container with ID ${containerId}`
      })
      return containerId
    } catch (err) {
      logger.warn(err)
      throw new Error('Failed to run docker image')
    }
  }

  async _getDockerContainerIdByName (name) {
    name = name.toLowerCase()
    const command = `docker ps -qf "name=${name}"`
    logger.debug({
      message: `Getting Docker Container ID by name=${name}`,
      command: command,
      arguments: arguments
    })
    try {
      const val = await exec(command)
      var split = val.stdout.split(os.EOL)
      if (split.length <= 1) {
        return null
      }
      logger.debug({ message: `Container ID for name=${name} is ${split[0]}` })
      return split[0]
    } catch (err) {
      logger.warn(err)
      return null
    }
  }

  async _checkService (maxAttempts = 3, port, host, protocol) {
    protocol = protocol || 'http'
    host = host || 'localhost'
    const url = `${protocol}://${host}:${port}`
    const options = {
      url: url,
      timeout: 10000,
      followRedirect: false,
      maxAttempts: maxAttempts,
      retryDelay: 1000
    }
    logger.debug({
      message: `Checking service at ${url} for document ${this.doc._id}`
    })
    try {
      await request(options)
      logger.debug({
        message: `Service at ${url} is responsive for document ${this.doc._id}`
      })
      return
    } catch (err) {
      logger.warn(err)
      throw new Error(
        `url ${url} is not reponsive for document ${this.doc._id}`
      )
    }
  }

  async _hasExistingService () {
    const containerId = await this._getDockerContainerIdByName(this.doc._id)
    if (containerId === null) {
      return false
    }
    logger.debug({
      message:
        `Found existing Docker container ${containerId} for document` +
        ` ${this.doc._id}`
    })

    // Check digest
    const digest = await dockerLib.getImageDigestByContainerId(containerId)
    if (digest !== this.doc.digest) {
      return false
    }

    // Get host and port
    const deployment = await models.deployment.get(this.doc._id)
    this.containerName = deployment.host
    this.containerPort = deployment.port

    try {
      await this._checkService(3, this.containerPort, this.containerName)
      logger.debug({
        message: `Found an existing service for the document ${this.doc._id}`
      })
      return true
    } catch (e) {
      logger.debug({
        message: `Service for the document ${this.doc._id} is not responsive`
      })
      return false
    }
  }

  async _terminateService () {
    const containerId = await this._getDockerContainerIdByName(this.doc._id)
    if (containerId === null) {
      logger.debug({ message: `No active service found for "${this.doc._id}"` })
      return
    }

    logger.debug({
      message: `Stopping old container ${containerId} for document ${this.doc._id}`
    })
    await dockerLib.stopContainer(containerId)
    logger.debug({
      message: `Stopped old container ${containerId} for document ${this.doc._id}`
    })
  }

  async _pullImage () {
    const pullImage = !(await dockerLib.localImageExists(
      this.doc.image,
      this.doc.digest
    ))
    if (pullImage) {
      logger.debug({
        message:
          `Pulling new Image ${this.doc.image}@${this.doc.digest} ` +
          `for document ${this.doc._id}`
      })
      const maxRetry = 3
      await retry.runAsync(maxRetry, async () => {
        await dockerLib.pullImageByDigest(this.doc.image, this.doc.digest)
      })
      logger.debug({
        message:
          `Completed pulling new Image ${this.doc.image}@${this.doc.digest} ` +
          `for document ${this.doc._id}`
      })
    }
  }

  async _createNewService () {
    logger.debug({
      message: `Start creating a new service for "${this.doc._id}"`
    })

    // Create a new service
    try {
      // Container Name
      this.containerName = `${this.doc._id.toLowerCase()}-${new Date().getTime()}`
      await this._startDocContainer(
        this.doc.image,
        this.containerName,
        this.mount,
        this.env
      )
      await this._checkService(30, this.containerPort, this.containerName)
    } catch (err) {
      logger.warn(err)
      const error = new Error('Failed to create a new service')
      error.code = 1002
      throw error
    }
  }

  async _setStatusToReady () {
    const deployment = {}
    deployment.host = this.containerName
    deployment.port = this.containerPort
    deployment.status = status.READY
    logger.debug({ message: `Setting status of "${this.doc._id}" to READY` })
    return models.deployment.update(this.doc._id, deployment)
  }

  async _setStatusToPending () {
    return models.deployment.update(this.doc._id, {
      status: status.PENDING
    })
  }

  async _setStatusToNotDeployed () {
    return models.deployment.update(this.doc._id, {
      status: status.NOT_DEPLOYED
    })
  }

  async deploy () {
    logger.info({ message: `Starting deployment for ${this.doc._id}` })

    try {
      // Update deployment status to pending
      await this._setStatusToPending()

      if (!(await this._hasExistingService())) {
        // Terminate the previously created service
        await this._terminateService()

        // Pull new image if needed
        await this._pullImage()

        // Create a new service
        await this._createNewService()
      }

      // Set deployment status to ready
      const response = await this._setStatusToReady()
      logger.info({ message: `Completed deployment for ${this.doc._id}` })
      return response
    } catch (e) {
      logger.error({
        message: `Failed deployment for ${this.doc._id}`,
        stack: e.stack
      })
      // Set status to not deployed
      await this._setStatusToNotDeployed()
    }
  }

  async stop () {
    logger.info({ message: `Stopping deployment for ${this.doc._id}` })

    // Set status to not deployed
    await this._setStatusToNotDeployed()

    // Terminate the previously created service
    await this._terminateService()
  }
}

class DeploymentManagerLocal {
  constructor (authService, configs) {
    this.lockManager = new LockManager()
    this.authService = authService
    this.configs = configs
  }

  /**
   * Returns current deployment status for a given docId
   *
   * @param {String} docId
   */
  async get (docId) {
    let deployment = await this.lockManager.waitShared(docId, () => {
      return models.deployment.get(docId)
    })
    switch (deployment.status) {
      case status.READY:
      case status.NOT_DEPLOYED:
        break
      case status.PENDING:
        logger.debug({ message: `Status pending for ${docId}` })
        deployment = await this.lockManager.waitExclusive(docId, () => {
          return models.deployment.get(docId)
        })
        break
      default:
        logger.debug({ message: `Create deployment for ${docId}` })
        deployment = await this.lockManager.waitExclusive(docId, () => {
          return models.deployment.create({
            _id: docId,
            status: status.NOT_DEPLOYED
          })
        })
    }
    return deployment
  }

  /**
   * Starts a new service deployment for a given docId
   *
   * @param {String} docId
   * @param {String} image
   * @param {String} digest
   */
  async deploy (docId, image, digest) {
    logger.debug({
      message: 'Wait for exclusive lock before starting deployment'
    })
    return this.lockManager.waitExclusive(docId, async () => {
      const doc = { _id: docId, image: image, digest: digest }
      const deploymentHandler = new DeploymentHandlerLocal(
        doc,
        this.authService,
        this.configs
      )
      return deploymentHandler.deploy()
    })
  }

  /**
   * Clears deployment status to 'NOT DEPLOYED' for a given docId
   *
   * @param {String} docId
   */
  async clear (docId) {
    logger.debug({
      message: 'Wait for exclusive lock before changing deployment status'
    })
    return this.lockManager.waitExclusive(docId, () => {
      const doc = { _id: docId }
      const deploymentHandler = new DeploymentHandlerLocal(
        doc,
        this.authService,
        this.configs
      )
      return deploymentHandler.stop()
    })
  }
}

exports.DeploymentManager = DeploymentManagerLocal
exports.status = status
