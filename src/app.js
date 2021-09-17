'use strict'

const { normalize, join, resolve } = require('path')
const express = require('express')
const https = require('https')
const http = require('http')
const { readFile, pathExists } = require('fs-extra')
const { promisify } = require('util')
const merge = require('deepmerge')
const { isEmpty } = require('underscore')

const models = require('./models')
const middleware = require('./routers/middleware')
const CONST = require('./lib/constant')
const logger = require('./lib/logger').create()
const YAML = require('yaml')

const { AuthService } = require('./services/auth_service')
const { DeploymentService } = require('./services/deployment_service')


/**
 * Initialize global configurations
 */
 async function initializeGlobal () {
  // Set Global Event Handlers
  process.once('uncaughtException', err => {
    logger.critical({ message: err.message, stack: err.stack })
    //process.exit(1);
  })

  function terminate () {
    logger.info({ message: 'Received termination request. terminating...' })
    process.exit(0)
  }

  process.once('SIGINT', terminate)
  process.once('SIGTERM', terminate)
}

/**
 * Load configuration files
 * 
 * TODO: Make a separate library for this.
 */
async function loadConfigs () {
  let configs = {}
  const configDir = process.env.CONFIG_DIR
  
  // Conditionally load base configuration file
  const baseConfigPath = resolve(join(configDir, 'base.yml'))
  if (await pathExists(baseConfigPath)) {
    try {
      logger.info({message: 'Loading base configuration file'})
      const baseConfigStr = (await readFile(baseConfigPath)).toString()
      configs = YAML.parse(baseConfigStr)
    } catch (e) {
      throw new Error(`File at ${baseConfigPath} is not a valid YAML file`)
    }
  }

  // Load environment specific configuration file
  const env = process.env.DEPLOYMENT_ENV
  const envConfigPath = resolve(join(configDir, `${env}.yml`))
  if (await pathExists(envConfigPath)) {
    try {
      logger.info({message: 'Loading environment specific config file'})
      const ChildConfigStr = (await readFile(envConfigPath)).toString()
      configs = merge(configs,  YAML.parse(ChildConfigStr))
    } catch (e) {
      throw new Error(`File at ${envConfigPath} is not a valid YAML file`)
    }
  }

  if (isEmpty(configs)) {
    // TODO: Use a pre-defined base configuration when configurations are 
    // not provided
    throw new Error('No configurations loaded')
  }
  return configs
}

/**
 * Instantiate all services and run initializations
 * 
 * TODO: Make a separate library for this.
 */
async function initSerivces (configs) {
  // TODO: Move the init function out of the catalog router.
  // This should move to a Catalog Service
  await require('./routers/catalog').init()

  // Initialize services
  const authService = new AuthService(configs)
  await authService.initAdminUser()
  const deploymentService = new DeploymentService(authService, configs)
  if (CONST.CONFIG.RESTART_DOCS) {
    const catalogs = await models.catalog.getAll()
    await deploymentService.restartDocs(catalogs)
  }

  return { authService, deploymentService }
}

/**
 * Configure Express Template Engines and Middlewares
 *
 * @param {Object} app - Express app
 */
 function configureExpress (app, configs) {
  //-----------------------------------------------------------------------------
  // Add App Configuration Object
  //-----------------------------------------------------------------------------
  app.set('appConfig', configs)

  //-----------------------------------------------------------------------------
  // Configure Templete Engine
  //-----------------------------------------------------------------------------
  app.set('views', normalize(join(__dirname, 'templates')))
  app.set('view engine', 'ejs')

  //-----------------------------------------------------------------------------
  // Register Global Middlewares
  //-----------------------------------------------------------------------------
  app.use(middleware.access)
  app.use(middleware.ssl)
}

/**
 * Register Express Routers
 *
 * @param {Object} app - Express app
 * @param {object} services
 * @param {object} configs
 */
async function registerRouter (
  app,
  { authService, deploymentService },
  configs
) {
  // Adds res.renderWithNavbar
  app.use(middleware.createNavbarRenderer(authService, configs))

  // Register API Dispatchers
  app.use('/api/auth', require('./routers/auth').api(authService))
  app.use(
    '/api/deployment',
    require('./routers/deployment').api(deploymentService)
  )
  app.use('/deployment', require('./routers/deployment').api(deploymentService)) // For backward compatibility
  app.use('/api/catalog', require('./routers/catalog').api(authService))
  app.use('/api/track', require('./routers/track').api())
  app.use('/api/progress', require('./routers/progress').api())
  app.use('/api/error_report', require('./routers/error_report').api)
  app.use('/api/aliases', require('./routers/aliases').api)

  // Register Static File Server
  app.use(express.static(normalize(join(__dirname, 'public'))))

  // Register Page Dispatchers
  app.use('/auth', await require('./routers/auth').page(authService, configs))
  app.use('/doc', require('./routers/doc').page(authService, configs))
  app.use('/catalog', require('./routers/catalog').page(authService))
  app.use('/track', require('./routers/track').page(authService))
  app.use('/learn', require('./routers/aliases').page)

  // Set Default Redirect
  app.get('/', function (err, res) {
    return res.redirect('/catalog/')
  })
}

/**
 * Create HTTP and HTTPS servers
 *
 * @param {Object} app - Express app
 */
async function initializeServers (app, configs) {
  // Start HTTP Server
  const httpServer = http.createServer(app)
  const listenHttp = promisify(httpServer.listen.bind(httpServer))
  await listenHttp(CONST.CONFIG.PORT)
  logger.info({ message: `HTTP : Listening on port ${CONST.CONFIG.PORT}` })

  if (!configs.ssl || !configs.ssl.enabled) {
    return
  }

  // Start HTTPS Server when SSL is enabled
  let options = {
    cert: (await readFile(configs.ssl.certificatePath)).toString(),
    key: (await readFile(configs.ssl.privateKeyPath)).toString()
  }
  if (configs.ssl.passphrasePath) {
    options.passphrase = (await readFile(configs.ssl.passphrasePath)).toString()
  }

  const httpsServer = https.createServer(options, app)
  const listenHttps = promisify(httpsServer.listen.bind(httpsServer))
  await listenHttps(CONST.CONFIG.PORT_HTTPS)
  logger.info({
    message: `HTTPS : Listening on port ${CONST.CONFIG.PORT_HTTPS}`
  })
}

// TODO: Unused, but let's keep it here because we are not going to delete
// all commit histories when open-sourcing this codebase.
//
// async function checkDeployedWorkshops () {
//   const request = require('request-promise-native')
//   const urlCatalog = configs.services.catalog

//   const options = {
//     url: urlCatalog,
//     method: 'GET',
//     json: true
//   }
//   const result = await request(options)
//   for (let catalog of result.data) {
//     const urlDeployment = `${configs.services.deployment}/${catalog._id}`
//     const deploymentData = {
//       image: catalog.image,
//       imageDigest: catalog.imageDigest
//     }
//     const options = {
//       url: urlDeployment,
//       method: 'POST',
//       json: true,
//       body: deploymentData
//     }
//     try {
//       await request(options)
//     } catch (err) {
//       const error = new Error(`Failed to load workshop ${catalog.title}`)
//       error.extra = {
//         originalStack: err.stack
//       }
//       logger.error(error)
//     }
//   }
// }

/**
 * Initialize Appication
 */
async function initialize () {
  await initializeGlobal()

  const configs = await loadConfigs()
  const services = await initSerivces(configs)

  // TODO: Create an App class
  const app = express()
  configureExpress(app, configs)
  await registerRouter(app, services, configs)
  await initializeServers(app, configs)
}

/*!
 *  Start Application
 */
initialize()
  .then(() => {
    logger.info({ message: 'Successfully Started Service' })
  })
  .catch(err => {
    logger.critical(err)
    process.exit(1)
  })
