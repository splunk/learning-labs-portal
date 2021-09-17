'use strict'
const { parse } = require('url')
const proxy = require('http-proxy-middleware')
const express = require('express')
const https = require('https')
const _ = require('underscore')

const logger = require('../lib/logger').create('WorkshopScheduler')
const models = require('../models')
const CONST = require('../lib/constant')

// -----------------------------------------------------------------------------
// Router for PAGEs : /learn
// -----------------------------------------------------------------------------

const routerPage = express.Router()

const targets = {
  WORKSHOP: {
    pathType: 'doc'
  },
  TRACK: {
    pathType: 'track'
  }
}

// Add trailing slash
routerPage.get(/\/(\w+)$/, function (req, res) {
  const parsed = parse(req.originalUrl)
  let redirectUrl = `${parsed.pathname}/`
  if (parsed.search) {
    redirectUrl += parsed.search
  }
  return res.redirect(301, redirectUrl)
})

routerPage.get(/\/(\w+)\//, async function (req, res) {
  try {
    const appConfig = req.app.get('appConfig')
    const isSslEnabled = appConfig.ssl && appConfig.ssl.enabled
    const path = req.params[0]
    const alias = await models.alias.get(path)
    if (_.isEmpty(alias)) {
      const error = `${path} is not a valid alias.`
      return res.status(400).json({ error })
    }

    const targetType = alias.target

    if (!targets[targetType]) {
      const error = `"${targetType}" is not a valid aliased object`
      return res.status(400).json({ error })
    }
    const uuid = alias.uuid
    const port = isSslEnabled ? CONST.CONFIG.PORT_HTTPS : CONST.CONFIG.PORT
    const protocol = isSslEnabled ? 'https' : 'http'
    const host = 'localhost'
    const pathType = targets[targetType].pathType
    req.redirect = `${protocol}://${host}:${port}/${pathType}/${uuid}`
    await proxyToWorkshop(req, res)
  } catch (err) {
    const statusCode = 400
    err.extra = { api: req.originalUrl }
    logger.error(err)
    res.status(statusCode).json({ error: err.message })
  }
})

function proxyToWorkshop (req, res) {
  return new Promise((resolve, reject) => {
    const appConfig = req.app.get('appConfig')
    const isSslEnabled = appConfig.ssl && appConfig.ssl.enabled
    const options = {
      target: req.redirect,
      changeOrigin: true,
      logLevel: 'silent',
      pathRewrite: (path, req) => {
        const newPath = path.replace(/\/learn\/(\w+)\//, '/')
        return newPath
      }
    }
    if (isSslEnabled) {
      const ignoreSslWarnings =
        appConfig.httpsAgent && appConfig.httpsAgent.ignoreSslWarnings
      options.agent = new https.Agent({
        rejectUnauthorized: !ignoreSslWarnings
      })
    }

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

exports.page = routerPage

// -----------------------------------------------------------------------------
// Router for APIs : /api/alias
// -----------------------------------------------------------------------------

const routerApi = express.Router()

routerApi.use(express.json())

routerApi.get('/', async function (req, res) {
  if (req.query.uuid) {
    // allows users to find alias by uuid with endpoint /api/alias?uuid=<UUID>
    const uuid = req.query.uuid
    const doc = await models.alias.getByUuid(uuid)
    return res.json({ data: doc })
  }
  try {
    const docs = await models.alias.getAll()
    res.json({ data: docs })
  } catch (err) {
    err.extra = { api: req.originalUrl }
    logger.error(err)
    res.json({ error: err.message })
  }
})

routerApi.get('/:id', async function (req, res) {
  const id = req.params.id
  try {
    const docs = await models.alias.get(id)
    res.json({ data: docs })
  } catch (err) {
    err.extra = { api: req.originalUrl }
    logger.error(err)
    res.json({ error: err.message })
  }
})

exports.api = routerApi
