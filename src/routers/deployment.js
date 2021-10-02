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

const console = require('../lib/logger').create('Deployment')
const express = require('express')

//-----------------------------------------------------------------------------
// Router for APIs : /api/deployment
//-----------------------------------------------------------------------------

exports.api = function (deploymentService) {
  const router = express.Router()

  // Register body parser
  router.use(express.json())

  router.get('/:id', async function (req, res) {
    // TODO : Check if docId is valid
    const docId = req.params.id

    try {
      const response = await deploymentService.getDeploymentInfo(docId)
      res.json({ data: response })
    } catch (err) {
      const statusCode = 500
      err.extra = { api: req.originalUrl }
      console.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  router.post('/:id', async function (req, res) {
    // TODO : Check if docId is valid
    const docId = req.params.id
    const image = req.body.image
    const digest = req.body.imageDigest
    try {
      const response = await deploymentService.startDoc(docId, image, digest)
      res.json({ data: response })
    } catch (err) {
      const statusCode = 500
      err.extra = { api: req.originalUrl }
      console.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  router.delete('/:id', async function (req, res) {
    // TODO : Check if docId is valid
    const docId = req.params.id
    try {
      const response = await deploymentService.stopDoc(docId)
      res.json({ data: response })
    } catch (err) {
      const statusCode = 500
      err.extra = { api: req.originalUrl }
      console.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  return router
}
