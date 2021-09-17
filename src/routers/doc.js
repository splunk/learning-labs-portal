'use strict'

const { parse } = require('url')
const proxy = require('http-proxy-middleware')
const request = require('request-promise-native')
const express = require('express')
const _ = require('underscore')
const logger = require('../lib/logger').create('WorkshopScheduler')
const retry = require('../lib/retry')
const models = require('../models')
const middleware = require('./middleware')
const { populateRequirements } = require('./common')

//-----------------------------------------------
// Errors
//-----------------------------------------------
class ErrorRequirementNotMet extends Error {
  constructor (message) {
    super(message)
  }
}

class ErrorInvalidDocId extends Error {
  constructor (message) {
    super(message)
  }
}

//-----------------------------------------------
// Client library to Deployment Service
//-----------------------------------------------
function createDeploymentServiceClient (configs) {
  async function sendRequestToDeployment (method, docId, data) {
    let body
    const ignoreSslWarnings =
      configs.httpsAgent && configs.httpsAgent.ignoreSslWarnings
    try {
      const url = `${configs.services.deployment}/${docId}`
      let options = {
        method: method,
        rejectUnauthorized: !ignoreSslWarnings,
        json: true
      }
      if (data) {
        options.body = data
      }
      body = await request(url, options)
    } catch (err) {
      const error = new Error('Service Access Failed')
      error.original = err
      throw error
    }
    if (body.error) {
      const error = new Error(body.error)
      throw error
    }
    return body.data
  }

  function getDeployment (docId) {
    return sendRequestToDeployment('GET', docId)
  }

  function startDeployment (docId, image, digest) {
    const body = {
      image: image,
      imageDigest: digest
    }
    return sendRequestToDeployment('POST', docId, body)
  }

  async function clearDeployment (docId) {
    return sendRequestToDeployment('DELETE', docId)
  }

  return { getDeployment, startDeployment, clearDeployment }
}

//-----------------------------------------------------------------------------
// Router for PAGEs : /doc
//-----------------------------------------------------------------------------

function proxyToDocService (req, res, deployment) {
  return new Promise((resolve, reject) => {
    let options = {
      target: `http://${deployment.host}:${deployment.port}`,
      changeOrigin: true,
      logLevel: 'silent',
      pathRewrite: (path, req) => {
        return path.replace(/\/doc\/(\w+)\//, '/')
      }
    }
    // Add event handlers
    options.onError = () => {
      reject(new Error(`${options.target} is not reponsive`))
    }
    options.onClose = () => {
      resolve()
    }
    options.onProxyRes = (proxyRes, req, res) => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }

    proxy(options)(req, res)
  })
}

exports.page = function (authService, configs) {
  const {
    getDeployment,
    startDeployment,
    clearDeployment
  } = createDeploymentServiceClient(configs)

  async function checkDocAndAuth (req, res, next) {
    const id = req.params[0]
    req.catalog = await models.catalog.get(id)
    if (!req.catalog) {
      return next()
    }

    // If login is disabled, skip authentication
    if (req.catalog.features && req.catalog.features.login === false) {
      return next()
    }

    // Continue authentication
    const pageAuthMiddleware = middleware.createPageAuthMiddleware(authService)
    pageAuthMiddleware(req, res, next)
  }

  const router = express.Router()

  // Add trailing slash
  router.get(/\/(\w+)$/, function (req, res) {
    const parsed = parse(req.originalUrl)
    let redirectUrl = `${parsed.pathname}/`
    if (parsed.search) {
      redirectUrl += parsed.search
    }
    return res.redirect(301, redirectUrl)
  })

  router.all(/\/(\w+)\//, checkDocAndAuth, async function (req, res) {
    try {
      const id = req.params[0]

      const email = req.parsedToken ? req.parsedToken.user : 'not_logged_in'
      const isAdmin = req.parsedToken ? req.parsedToken.admin : false

      // TODO : Use API request instead
      const catalog = req.catalog
      if (_.isEmpty(catalog)) {
        const error = new ErrorInvalidDocId(`Doc id = ${id} is invalid`)
        error.extra = { user: email, docId: id }
        throw error
      }

      const docId = catalog._id
      const image = catalog.image
      const digest = catalog.imageDigest

      if (catalog.requirements && !isAdmin) {
        populateRequirements([catalog], email)
        if (catalog.locked) {
          const message = `Requirements are not completed for the workshop "${catalog.title}"`
          const error = new ErrorRequirementNotMet(message)
          error.extra = { user: email, docId: id }
          throw error
        }
      }

      const maxRetry = 3
      await retry.runAsync(maxRetry, async () => {
        let deployment = await getDeployment(docId)
        if (deployment.status === 'NOT DEPLOYED') {
          logger.warn({ message: `Workshop service for ${docId} is not READY` })
          deployment = await startDeployment(docId, image, digest)
        }
        try {
          await proxyToDocService(req, res, deployment)
        } catch (err) {
          logger.warn(err)
          await clearDeployment(docId)
          throw err
        }
      })
    } catch (err) {
      if (err instanceof ErrorRequirementNotMet) {
        const renderObj = {
          message: err.message
        }
        res.status(403).renderWithNavbar('error_requirement', renderObj)
      } else if (err instanceof ErrorInvalidDocId) {
        logger.warn(err)
        res.status(404).send(err.message)
      } else {
        err.extra = { api: req.originalUrl }
        logger.error(err)
        res.status(404).send('page not available')
      }
    }
  })
  return router
}
