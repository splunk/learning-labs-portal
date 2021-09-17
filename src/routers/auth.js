const express = require('express')
const cookieParser = require('cookie-parser')

const logger = require('../lib/logger').create('Auth')
const ldap = require('../lib/ldap')
const model = require('../models')
const middleware = require('./middleware')

exports.page = async function (authService, configs) {
  const auth = configs.auth
  const router = express.Router()

  router.use(cookieParser())

  router.use(express.urlencoded({ extended: false }))

  if (auth.saml) {
    router.use(await middleware.createSamlMiddleware(authService, configs))
  }

  router.get('/', function (req, res) {
    const redirectUrl = req.query.redirect_from || '/'
    const loginUrl = auth.local.loginUrl || auth.loginUrl
    const action = `${loginUrl}?redirect_from=${redirectUrl}`
    const isLdapSupported = !!auth.ldap
    const message = []
    if (isLdapSupported) {
      message.push(
        'Please ensure to use your Corporate AD username and password'
      )
    } else {
      message.push('Please use the admin credentials')
    }
    const renderObj = {
      action,
      method: 'post',
      showSsoButton: false,
      message
    }
    res.render('auth', renderObj)
  })

  router.get(
    '/logout',
    middleware.createApiAuthMiddleware(authService),
    function (req, res) {
      if (!req.parsedToken) {
        return res.sendStatus(403)
      }
      res.cookie('JWT', '')

      // Show Okta login UI when Okta is enabled and the current user isn't admin
      const { user } = req.parsedToken
      const showSsoButton = auth.saml && !user.endsWith('localuser')
      const action = showSsoButton
        ? auth.loginUrl
        : auth.local.loginUrl || auth.loginUrl
      const method = showSsoButton ? 'get' : 'post'
      const renderObj = {
        action,
        method,
        showSsoButton,
        message: ['You have been logged out. Log in to return to the system.']
      }
      res.render('auth', renderObj)
    }
  )

  router.post('/', async function (req, res) {
    const redirectUrl = req.query.redirect_from || '/'

    function renderErrorPage (statusCode) {
      const redirectUrl = req.query.redirect_from || '/'
      const loginUrl = auth.local.loginUrl || auth.loginUrl
      const isLdapSupported = !!auth.ldap
      const action = `${loginUrl}?redirect_from=${redirectUrl}`
      const message = []
      if (isLdapSupported) {
        message.push(
          'Please ensure to use your Corporate AD username and password'
        )
        message.push(
          'If you are having trouble logging in, please visit Slack channel #go-workshop-users.'
        )
      } else {
        message.push('Please check the admin credentials are correct')
      }
      const renderObj = {
        action,
        method: 'post',
        showSsoButton: false,
        message
      }
      res.status(statusCode).render('auth', renderObj)
    }

    if (!req.body.username) {
      return renderErrorPage(400)
    }
    if (!req.body.password) {
      return renderErrorPage(400)
    }

    const username = req.body.username.split('@')[0]
    const password = req.body.password

    try {
      // Authenticate
      const { signedToken, token } = await authService.authenticate(
        username,
        password
      )
      res.cookie('JWT', signedToken)
      logger.debug({
        message: `${username} logged in successfully`,
        user: token.user,
        name: token.name
      })
      res.redirect(redirectUrl)
    } catch (err) {
      if (
        err instanceof ldap.LdapAuthError ||
        err instanceof authService.LocalAuthError
      ) {
        logger.warn({ message: err.message, user: username })
      } else {
        logger.error(err)
      }
      renderErrorPage(401)
    }
  })

  return router
}

//-----------------------------------------------------------------------------
// Router for APIs : /auth
//-----------------------------------------------------------------------------

exports.api = function (authService) {
  const router = express.Router()

  router.use(express.json())

  router.use(middleware.createApiAuthMiddleware(authService))

  router.get('/', async function (req, res) {
    // gets info for all active users
    try {
      const query = { $or: [{ local: false }, { local: { $exists: false } }] }
      const projection = { _id: 1, name: 1, email: 1 }
      const sort = { _id: 1 }

      // Filter out users registered before email and name fields are available
      const docs = (await model.auth.getAll(query, projection, sort)).filter(
        item => {
          return item.email && item.name
        }
      )
      res.json({ data: docs })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  router.get('/me', async function (req, res) {
    // gets info related to current user
    if (!req.parsedToken) {
      return res.sendStatus(403)
    }
    try {
      const name = req.parsedToken.name
      const username = req.parsedToken.username
      const email = req.parsedToken.user
      res.json({
        name: name,
        username: username,
        email: email
      })
    } catch (err) {
      const statusCode = 400
      err.extra = { api: req.originalUrl }
      logger.error(err)
      res.status(statusCode).json({ error: err.message })
    }
  })

  router.post('/', async function (req, res) {
    if (!req.body.username) {
      return res.status(400).json({ error: '"username" is missing' })
    }
    if (!req.body.password) {
      return res.status(400).json({ error: '"password" is missing' })
    }

    const username = req.body.username.split('@')[0]
    const password = req.body.password

    try {
      // Authenticate
      const { signedToken, token } = await authService.authenticate(
        username,
        password
      )
      logger.debug({
        event: 'authenticated',
        message: `${username} authenticated successfully`,
        user: token.user,
        name: token.name
      })

      res.json({ data: { token: signedToken } })
    } catch (err) {
      if (
        err instanceof ldap.LdapAuthError ||
        err instanceof authService.LocalAuthError
      ) {
        logger.warn({ message: err.message, user: username })
        res.status(401).json({ error: err.message })
      } else {
        logger.error(err)
        res.status(500).json({ error: err.message })
      }
    }
  })
  return router
}
