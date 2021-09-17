'use strict'

const express = require('express')
const cookieParser = require('cookie-parser')
const { urlencoded } = require('body-parser')
const { createPrivateKey } = require('crypto')
const { readFile } = require('fs-extra')
const { promisify } = require('util')
const { Router } = require('express')
const { ServiceProvider, IdentityProvider } = require('saml2-js')

const CONST = require('../lib/constant')
const logger = require('../lib/logger').create('ApiGateway')

//-----------------------------------------------------------------------------
// Middleware : Auth midleware for pages
//-----------------------------------------------------------------------------

exports.createPageAuthMiddleware = function (authService) {
  const router = express.Router()

  router.use(cookieParser())

  router.use(async function (req, res, next) {
    if (!authService.isAuthSupported()) {
      return next()
    }

    const token = req.cookies.JWT
    const loginUrl = authService.getLoginUrl()
    const loginUrlWithRedirect = `${loginUrl}?redirect_from=${req.originalUrl}`

    try {
      req.parsedToken = await authService.parseToken(token)
      next()
    } catch (err) {
      err.message = `Token Verificaiton Failed, error: ${err.message}`
      err.extra = { api: req.originalUrl }
      logger.debug(err)
      res.redirect(loginUrlWithRedirect)
    }
  })

  return router
}

//-----------------------------------------------------------------------------
// Middleware : Auth middlware for API
//-----------------------------------------------------------------------------

exports.createApiAuthMiddleware = authService => {
  const router = express.Router()

  router.use(cookieParser())

  router.use(async function (req, res, next) {
    try {
      let token = req.cookies.JWT
      if (!token) {
        const header = req.get('authorization') || ''
        const [type, key] = header.split(' ')
        if (type === 'Bearer') {
          token = key
        }
      }
      req.parsedToken = await authService.parseToken(token)
    } catch (err) {
      logger.debug(err)
      req.parsedToken = null
    }
    next()
  })

  return router
}

//-----------------------------------------------------------------------------
// Middleware : Access Logger
//-----------------------------------------------------------------------------

const routerAccess = express.Router()

routerAccess.use(function (req, res, next) {
  const userAgent = req.get('user-agent')
  logger.debug({
    message: 'HTTP Access',
    method: req.method,
    url: req.originalUrl,
    userAgent: userAgent
  })
  next()
})

exports.access = routerAccess

//-----------------------------------------------------------------------------
// Middleware : Page Renderer for Pages with Navbar
//-----------------------------------------------------------------------------

exports.createNavbarRenderer = function (authService, configs) {
  const navItems = configs.navbar || []

  return (req, res, next) => {
    res.renderWithNavbar = (template, renderObj) => {
      renderObj = {
        name: req.parsedToken.name,
        authLogout: authService.getLogoutUrl(),
        navItems,
        ...renderObj
      }
      res.render(template, renderObj)
    }
    next()
  }
}

//-----------------------------------------------------------------------------
// Middleware : SSL Redirect
//-----------------------------------------------------------------------------

const routerSsl = express.Router()

routerSsl.use(function (req, res, next) {
  const appConfig = req.app.get('appConfig')
  const isSslEnabled = appConfig.ssl && appConfig.ssl.enabled
  if (!isSslEnabled) {
    return next()
  }

  const requestedUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
  const domain = CONST.CONFIG.DOMAIN
  if (domain && requestedUrl.indexOf(domain) < 0) {
    const redirectUrl = `${req.protocol}://${domain}${req.originalUrl}`
    logger.info({ message: `Redirecting ${requestedUrl} to ${redirectUrl}` })
    return res.redirect(redirectUrl)
  }
  if (!req.secure) {
    const portStr =
      CONST.CONFIG.PORT_HTTPS === 443 ? '' : `:${CONST.CONFIG.PORT_HTTPS}`
    const redirectUrl = `https://${req.hostname}${portStr}${req.originalUrl}`
    logger.info({ message: `Redirecting HTTP to ${redirectUrl}` })
    return res.redirect(redirectUrl)
  } else {
    next()
  }
})

exports.ssl = routerSsl

//-----------------------------------------------------------------------------
// Middleware : Okta
//-----------------------------------------------------------------------------

exports.createSamlMiddleware = async function (authService, { auth }) {
  logger.info({ message: 'Loading SAML middleware' })

  const {
    urlPrefix,
    saml: { loginUrl, serviceProvider: spConfig, identityProvider: idpConfig }
  } = auth

  // Construct Service Provider
  const serviceProviderOptions = {
    entity_id: spConfig.entityId,
    assert_endpoint: spConfig.assertEndpoint,
    private_key: '',
    certificate: ''
  }
  if (!idpConfig.allowUnencryptedAssertion) {
    logger.info({
      message: 'Assertion is encrypted. Requires valid Provider cert.'
    })
    const spPrivateKey = createPrivateKey({
      key: await readFile(spConfig.privateKeyPath),
      passphrase: (await readFile(spConfig.privateKeyPassphrasePath)).toString()
    })
    serviceProviderOptions.private_key = spPrivateKey.export({
      type: 'pkcs1',
      format: 'pem'
    })
    serviceProviderOptions.certificate = (
      await readFile(spConfig.certPath)
    ).toString()
  }

  const sp = new ServiceProvider(serviceProviderOptions)
  const createLoginRequestUrl = promisify(sp.create_login_request_url.bind(sp))
  const postAssert = promisify(sp.post_assert.bind(sp))

  // Construct Identity Provider
  const identityProviderOptions = {
    sso_login_url: idpConfig.ssoLoginUrl,
    sso_logout_url: idpConfig.ssoLogoutUrl,
    allow_unencrypted_assertion: idpConfig.allowUnencryptedAssertion
  }
  const cert = (await readFile(idpConfig.certPath))
    .toString()
    .split('\n')
    .map(line => line.trim())
    .join('\n')
  identityProviderOptions.certificates = [cert]
  const idp = new IdentityProvider(identityProviderOptions)

  // Create a router

  const router = Router()

  router.use(urlencoded({ extended: true }))

  router.get('/saml/metadata.xml', function (req, res) {
    res.type('application/xml')
    res.send(sp.create_metadata())
  })

  const smalLoginUrl = loginUrl.replace(urlPrefix, '')
  router.get(smalLoginUrl, async (req, res) => {
    let relayState = '/'
    if (req.query.redirect_from) {
      relayState = req.query.redirect_from
    }
    try {
      const loginUrl = await createLoginRequestUrl(idp, {
        relay_state: relayState
      })
      res.redirect(loginUrl)
    } catch (err) {
      logger.critical({
        message: 'Failed to generate SAML login URL, error: ' + err.message
      })
      res.sendStatus(500)
    }
  })

  router.post('/saml/assert', async (req, res) => {
    const options = { request_body: req.body }
    try {
      const samlResponse = await postAssert(idp, options)

      // Update Session
      const nameId = samlResponse.user.name_id
      const username = nameId.split('@')[0]
      if (!samlResponse.user.attributes.firstName) {
        res.status(500).send('SAML attribute "firstName" is not configured')
      }
      if (!samlResponse.user.attributes.lastName) {
        res.status(500).send('SAML attribute "lastName" is not configured')
      }
      if (!samlResponse.user.attributes.email) {
        res.status(500).send('SAML attribute "email" is not configured')
      }
      const [firstName] = samlResponse.user.attributes.firstName
      const [lastName] = samlResponse.user.attributes.lastName
      const [email] = samlResponse.user.attributes.email
      const displayName = `${firstName} ${lastName}`

      logger.info({ message: `authenticated user ${username}` })

      const { signedToken } = await authService.createToken(
        username,
        email,
        displayName
      )
      res.cookie('JWT', signedToken)

      // Redirect to redirectUrl
      if (!req.body.RelayState) {
        return res.redirect('/')
      }
      const redirectUrl = req.body.RelayState
      res.redirect(redirectUrl)
    } catch (err) {
      logger.info({
        message: 'Failed to handle SAML post assert. Error: ' + err.message
      })
      res.sendStatus(500)
    }
  })

  return router
}
