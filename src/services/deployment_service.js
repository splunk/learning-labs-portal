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

const logger = require('../lib/logger').create('Deployment')
const { DeploymentManager } = require('../lib/deployment_manager')

class DeploymentService {
  constructor (authService, configs) {
    this.deploymentManager = new DeploymentManager(authService, configs)
  }

  async getDeploymentInfo (docId) {
    return this.deploymentManager.get(docId)
  }

  async startDoc (docId, image, digest) {
    return this.deploymentManager.deploy(docId, image, digest)
  }

  async stopDoc (docId) {
    return this.deploymentManager.clear(docId)
  }

  async restartDocs (catalogs) {
    logger.info({ message: 'Restarting all docs' })
    for (const catalog of catalogs) {
      await this.stopDoc(catalog._id)
      await this.startDoc(catalog._id, catalog.image, catalog.imageDigest)
    }
  }
}

exports.DeploymentService = DeploymentService
