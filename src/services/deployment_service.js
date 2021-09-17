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
