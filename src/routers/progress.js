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
const _ = require('underscore')
const logger = require('../lib/logger').create('Progress')
const models = require('../models')
const CONST = require('../lib/constant')

//-----------------------------------------------------------------------------
// Router for APIs
//-----------------------------------------------------------------------------

exports.api = function () {
  const routerApi = express.Router()

  routerApi.use(express.json())

  routerApi.get('/', async function (req, res) {
    try {
      const docs = await models.progress.getAll()
      res.json({ data: docs })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(400).json({ error: err.message })
    }
  })

  routerApi.get('/:id', async function (req, res) {
    const id = req.params.id
    try {
      const doc = await models.progress.get(id)
      res.json({ data: doc })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(400).json({ error: err.message })
    }
  })

  routerApi.post('/', async function (req, res) {
    const body = req.body
    try {
      if (_.isUndefined(body._id)) {
        throw new Error('field "_id" is missing')
      }
      const data = {
        _id: body._id,
        attempted: [],
        completed: []
      }
      const doc = await models.progress.create(data)
      res.json({ data: doc })
    } catch (err) {
      let statusCode = 400
      if (err.original.errorType == 'uniqueViolated') {
        statusCode = 409
      }
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.put('/:id/attempted', async function (req, res) {
    const id = req.params.id
    const body = req.body

    try {
      if (_.isUndefined(body.docId)) {
        throw new Error('field "docId" is missing')
      }
      const update = { attempted: body.docId }
      const options = { command: '$addToSet' }
      const doc = await models.progress.update(id, update, options)
      res.json({ data: doc })
    } catch (err) {
      let statusCode = 400
      if (err.code == CONST.ERRORCODE.DATABASE_DOC_NOT_FOUND) {
        statusCode = 404
      }
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.put('/:id/completed', async function (req, res) {
    const id = req.params.id
    const body = req.body
    try {
      if (_.isUndefined(body.docId)) {
        throw new Error('field "docId" is missing')
      }
      const update = { completed: body.docId }
      const options = { command: '$addToSet' }
      const doc = await models.progress.update(id, update, options)
      res.json({ data: doc })
    } catch (err) {
      let statusCode = 400
      if (err.code == CONST.ERRORCODE.DATABASE_DOC_NOT_FOUND) {
        statusCode = 404
      }
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  routerApi.delete('/:id', async function (req, res) {
    const id = req.params.id
    try {
      await models.progress.remove(id)
      res.json({ data: `Successfully removed ${id}` })
    } catch (err) {
      let statusCode = 400
      if (err.code == CONST.ERRORCODE.DATABASE_DOC_NOT_FOUND) {
        statusCode = 404
      }
      err.extra = { api: req.originalUrl }
      logger.warn(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  return routerApi
}
