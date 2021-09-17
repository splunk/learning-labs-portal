'use strict'

const express = require('express')
const _ = require('underscore')
const logger = require('../lib/logger').create('Track')
const models = require('../models')
const middleware = require('./middleware')
const CONST = require('../lib/constant')
const { populateRequirements } = require('./common')
const { setAlias } = require('../services/aliasServices')

//-----------------------------------------------------------------------------
// Helper functions
//-----------------------------------------------------------------------------
async function populeWorkshops (track) {
  const docs = await models.catalog.getAll({ _id: { $in: track.docs } })
  const docsById = _.indexBy(docs, '_id')
  const docIds = track.docsWithExtra
    ? _.union(track.docsWithExtra, track.docs)
    : track.docs
  track.docs = docIds
    // Make sure workshop IDs within requirements are valid
    .filter(docId => {
      if (docId.includes('#')) {
        return track.extraItems[docId]
      } else {
        return docsById[docId]
      }
    })
    // Populate workshop object
    .map(docId => {
      if (docId.includes('#')) {
        return track.extraItems[docId]
      } else {
        return docsById[docId]
      }
    })
}

async function populateMaintainers (track) {
  const users = await models.auth.getAll({ email: { $in: track.maintainer } })
  const usersByEmail = _.indexBy(users, 'email')
  track.maintainer = track.maintainer
    .filter(email => {
      return usersByEmail[email]
    })
    .map(email => {
      return usersByEmail[email]
    })
  track.usersByEmail = usersByEmail
}

async function checkTrackId (req, res, next) {
  const id = req.params.id
  const track = await models.track.get(id)
  if (_.isEmpty(track)) {
    return res.status(404).send('Page Not Found')
  }
  req.track = track
  next()
}

async function checkPermission (req, res, next) {
  if (isMaintainer(req)) {
    return next()
  }
  return res.status(403).send('You do not have permission to access this page')
}

function isMaintainer (req) {
  const email = req.parsedToken.user
  if (req.parsedToken.admin) {
    return true
  }
  if (req.track.maintainer.includes(email)) {
    return true
  }
  return false
}

//-----------------------------------------------------------------------------
// Router for PAGEs : /track
//-----------------------------------------------------------------------------

exports.page = function (authService) {
  const routerPage = express.Router()

  routerPage.use(middleware.createPageAuthMiddleware(authService))

  routerPage.get('/', async function (req, res) {
    const tracks = await models.track.getAll({})
    const renderObj = { tracks: tracks }
    res.renderWithNavbar('track_all', renderObj)
  })

  routerPage.get('/:id', checkTrackId, async function (req, res) {
    const track = req.track
    const email = req.parsedToken.user

    await populeWorkshops(track)
    await populateRequirements(track.docs, email)

    let links = []
    if (isMaintainer(req)) {
      links.push({
        href: `/track/${track._id}/edit`,
        text: 'Manage Track',
        icon: 'fa-wrench'
      })
    }

    const renderObj = { links: links, track: track }
    res.renderWithNavbar('track', renderObj)
  })

  routerPage.get('/:id/edit', checkTrackId, checkPermission, async function (
    req,
    res
  ) {
    const name = req.parsedToken.name
    const track = req.track

    const links = [
      {
        text: 'Change Workshops',
        icon: 'fa-flask',
        href: `/track/${track._id}/edit/workshop`
      },
      {
        text: 'Change Maintainers',
        icon: 'fa-users',
        href: `/track/${track._id}/edit/maintainer`
      },
      {
        text: 'Change Properties',
        icon: 'fa-gear',
        href: `/track/${track._id}/edit/property`
      }
    ]
    const renderObj = { track: track, links: links }
    res.renderWithNavbar('track_edit', renderObj)
  })

  routerPage.get('/:id/edit/workshop', checkTrackId, async function (req, res) {
    const name = req.parsedToken.name
    const track = req.track
    await populeWorkshops(track)

    const renderObj = { track: track }
    res.renderWithNavbar('track_edit_workshop', renderObj)
  })

  routerPage.get('/:id/edit/maintainer', checkTrackId, async function (
    req,
    res
  ) {
    const name = req.parsedToken.name
    const track = req.track
    await populateMaintainers(track)

    const renderObj = { track: track }
    res.renderWithNavbar('track_edit_maintainer', renderObj)
  })

  routerPage.get('/:id/edit/property', checkTrackId, async function (req, res) {
    const name = req.parsedToken.name
    const track = req.track

    const renderObj = { track: track }
    res.renderWithNavbar('track_edit_property', renderObj)
  })

  return routerPage
}

//-----------------------------------------------------------------------------
// Router for APIs : /api/track
//-----------------------------------------------------------------------------

exports.api = function () {
  const routerApi = express.Router()

  routerApi.use(express.json())

  routerApi.get('/', async function (req, res) {
    try {
      const docs = await models.track.getAll()
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
      const doc = await models.track.get(id)
      res.json({ data: doc })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.post('/', async function (req, res) {
    const body = req.body
    try {
      const track = await models.track.create(body)
      logger.event({
        trackId: track._id,
        title: track.name,
        message: `Track "${track.name}" is created`,
        type: 'Track',
        status: 'Created',
        docs: track.docs,
        docsWithExtra: track.docsWithExtra
      })
      res.json({ data: track })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.put('/:id', async function (req, res) {
    const id = req.params.id
    const body = req.body
    try {
      const track = await models.track.update(id, body)
      logger.event({
        trackId: track._id,
        title: track.name,
        message: `Track "${track.name}" is updated`,
        type: 'Track',
        status: 'Updated',
        docs: track.docs,
        docsWithExtra: track.docsWithExtra
      })
      res.json({ data: track })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.put('/:id/alias', async function (req, res) {
    const trackId = req.params.id
    const alias = req.body.alias
    try {
      const trackAlias = await setAlias(alias, trackId, 'TRACK', logger)
      await models.track.update(trackId, { alias })
      res.json({ data: trackAlias })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.put('/:id/maintainer', async function (req, res) {
    const id = req.params.id
    const maintainer = req.body.maintainer
    try {
      const track = await models.track.get(id)
      if (track) {
        const catalogResult = await models.track.update(id, { maintainer })
        res.json({ data: catalogResult })
      } else {
        return res.status(400).json({ error: `"${id}" is not a valid ID` })
      }
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  routerApi.delete('/:id', async function (req, res) {
    const id = req.params.id
    try {
      await models.track.remove(id)
      logger.event({
        trackId: id,
        message: `Track is deleted`,
        type: 'Track',
        status: 'Deleted'
      })
      res.json({ data: `Successfully removed a track for id = ${id}` })
    } catch (err) {
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.json({ error: err.message })
    }
  })

  return routerApi
}
