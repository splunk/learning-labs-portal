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

const express = require('express')
const bodyParser = require('body-parser')
const _ = require('underscore')
const models = require('../models')
const middleware = require('./middleware')
const CONST = require('../lib/constant')
const logger = require('../lib/logger').create('Catalog')
const { populateRequirements } = require('./common')
const { setAlias } = require('../services/aliasServices')

// -----------------------------------------------------------------------------
// INIT function
// -----------------------------------------------------------------------------

exports.init = async function () {
  // Initialize States
  logger.info({ message: 'Initializing Catalog' })
  const query = { state: { $exists: false } }
  const docsWithoutState = await models.catalog.getAll(query)
  for (let doc of docsWithoutState) {
    const updateObj = { state: CONST.ENUM.CATALOG_STATE.PUBLISHED }
    await models.catalog.update(doc._id, updateObj)
    const message = `Updated state of doc ${doc._id} to "Published"`
    logger.info({ message })
  }
}

// -----------------------------------------------------------------------------
// HELPER functions
// -----------------------------------------------------------------------------

async function isMaintainer (req) {
  const email = req.parsedToken.user
  if (req.parsedToken.admin) {
    return true
  }
  const query = { maintainer: email }
  return !_.isEmpty(await models.catalog.getAll(query))
}

// -----------------------------------------------------------------------------
// Router for PAGEs : /catalog
// -----------------------------------------------------------------------------

exports.page = function (authService) {
  const routerPage = express.Router()

  routerPage.use(middleware.createPageAuthMiddleware(authService))

  routerPage.get('/', async function (req, res) {
    const email = req.parsedToken.user
    const query = { state: CONST.ENUM.CATALOG_STATE.PUBLISHED }
    const docs = await models.catalog.getAll(query, {}, { title: 1 })
    await populateRequirements(docs, email)
    let links = []
    if (await isMaintainer(req)) {
      links.push({
        href: '/catalog/edit',
        text: 'Manage Workshops',
        icon: 'fa-wrench'
      })
    }
    const renderObj = { links: links, docs: docs }
    res.renderWithNavbar('catalog', renderObj)
  })

  routerPage.get('/edit', async function (req, res) {
    const admin = req.parsedToken.admin
    const email = req.parsedToken.user

    const docs = (
      await models.catalog.getAll({}, {}, { description: 1 })
    ).filter(doc => admin || doc.maintainer.includes(email))

    const renderObj = {}
    res.renderWithNavbar('catalog_edit', renderObj)
  })

  routerPage.get('/add', function (req, res) {
    const renderObj = { message: false }
    res.renderWithNavbar('catalog_add', renderObj)
  })

  routerPage.post('/add', function (req, res) {
    function renderErrorPage (message) {
      const redirectUrl = req.query.redirect_from || '/'
      const renderObj = { message: message }
      res.renderWithNavbar('catalog_add', renderObj)
    }

    if (!req.body.title) {
      return renderErrorPage()
    }
    if (!req.body.description) {
      return renderErrorPage()
    }

    res.redirect('/catalog')
  })

  return routerPage
}

// -----------------------------------------------------------------------------
// Router for APIs : /api/catalog
// -----------------------------------------------------------------------------

exports.api = function (authService) {
  const routerApi = express.Router()

  routerApi.use(express.json())

  routerApi.use(middleware.createApiAuthMiddleware(authService))

  routerApi.get('/', async function (req, res) {
    if (req.query.maintainer) {
      const maintainer = req.query.maintainer
      const isAdmin = maintainer == authService.getAdminEmail()
      const docs = (
        await models.catalog.getAll({}, {}, { description: 1 })
      ).filter(doc => {
        const isDocMaintainer = doc.maintainer.includes(maintainer)
        return isAdmin || isDocMaintainer
      })
      return res.json({ data: docs })
    }

    try {
      const docs = await models.catalog.getAll()
      res.json({ data: docs })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.get('/:id', async function (req, res) {
    const id = req.params.id
    try {
      const doc = await models.catalog.get(id)
      res.json({ data: doc })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.post('/', async function (req, res) {
    const body = req.body

    // TODO : White-list contents from body
    // TODO : Check authentication and authorization

    try {
      body.state = CONST.ENUM.CATALOG_STATE.PUBLISHED
      const doc = await models.catalog.create(body)
      res.json({ data: doc })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.put('/:id', async function (req, res) {
    const id = req.params.id
    const body = req.body

    // TODO : White-list contents from body
    // TODO : Check authentication and authorization

    try {
      if (body.requirements) {
        const query = { _id: { $in: body.requirements } }
        const docs = await models.catalog.getAll(query, {})
        const ids = _.pluck(docs, '_id')
        const diff = _.difference(body.requirements, ids)
        if (diff.length > 0) {
          throw new Error(`Invalid requirement ${diff.join(',')}`)
        }
      }
      const doc = await models.catalog.update(id, body)
      res.json({ data: doc })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.put('/:id/state', async function (req, res) {
    const id = req.params.id
    const body = req.body

    if (!req.parsedToken) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    if (!req.body.state) {
      const error = 'Required property "state" is not provided'
      return res.status(400).json({ error })
    }

    const state = body.state
    if (!Object.values(CONST.ENUM.CATALOG_STATE).includes(state)) {
      const error = `"${state}" is not a valid value for property "state"`
      return res.status(400).json({ error })
    }

    const email = req.parsedToken.user
    const admin = req.parsedToken.admin

    try {
      const doc = await models.catalog.get(id)
      if (_.isEmpty(doc)) {
        return res.status(400).json({ error: `"${id}" is not a valid ID` })
      }
      if (!(admin || doc.maintainer.includes(email))) {
        const error = 'Not authorized to change the state of this workshop'
        return res.status(403).json({ error })
      }
      const result = await models.catalog.update(id, { state })
      res.json({ data: result })
    } catch (err) {
      const statusCode = 500
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.put('/:id/alias', async function (req, res) {
    const workshopId = req.params.id
    const alias = req.body.alias

    // TODO : Check authentication and authorization

    try {
      const catalogAlias = await setAlias(alias, workshopId, 'WORKSHOP', logger)
      await models.catalog.update(workshopId, { alias })
      res.json({ data: catalogAlias })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.put('/:id/maintainer', async function (req, res) {
    const id = req.params.id
    const maintainer = req.body.maintainer

    // TODO : Check authentication and authorization

    try {
      const doc = await models.catalog.get(id)
      if (!doc) {
        return res.status(400).json({ error: `"${id}" is not a valid ID` })
      } else {
        const catalogResult = await models.catalog.update(id, { maintainer })
        res.json({ data: catalogResult })
      }
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.delete('/:id', async function (req, res) {
    const id = req.params.id

    // TODO : Check authentication and authorization

    try {
      await models.catalog.remove(id)
      res.json({ data: `Successfully removed a catalog for id = ${id}` })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  return routerApi
}
