'use strict'

const express = require('express')
const _ = require('underscore')
const middleware = require('./middleware')
const logger = require('../lib/logger').create('ErrorReport')

//-----------------------------------------------------------------------------
// Router for APIs
//-----------------------------------------------------------------------------

exports.api = function (authService) {
  const routerApi = express.Router()

  routerApi.use(express.json())

  routerApi.use(middleware.createPageAuthMiddleware(authService))

  routerApi.post('/', async function (req, res) {
    const body = req.body
    body.user = req.parsedToken.user
    logger.error(body)
    res.end()
  })

  return routerApi
}
