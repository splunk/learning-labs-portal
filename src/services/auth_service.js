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

const util = require('util')
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const _ = require('underscore')
const fs = require('fs-extra')
const passGenerator = require('generate-password')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const jwtSign = util.promisify(jwt.sign)
const jwtVerify = util.promisify(jwt.verify)

const logger = require('../lib/logger').create('Auth')
const ldap = require('../lib/ldap')
const { BitBucket } = require('../lib/bitbucket')
const model = require('../models')

class LocalAuthError extends Error {
  constructor (message) {
    super(message)
    this.name = 'LocalAuthError'
  }
}

class AuthService {
  constructor ({ auth }) {
    this.authConfigs = auth
    this.LocalAuthError = LocalAuthError
    try {
      this.jwtSecret = fs
        .readFileSync(this.authConfigs.token.secretPath)
        .toString()
        .trim()
    } catch (e) {
      throw new Error('Failed to load JWT secret')
    }
  }

  /**
   * create an admin user if not configured before.
   */
  async initAdminUser () {
    // TODO : Combine try / catch

    // Check if admin user already exists
    const adminUser = this.authConfigs.local.admin.username
    const adminUserDoc = await model.auth.get(adminUser)

    const passwordPath = this.authConfigs.local.admin.passwordPath
    if (!_.isEmpty(adminUserDoc) && !(await fs.pathExists(passwordPath))) {
      logger.info({
        message: 'Admin password has been deleted. Recreating an admin user'
      })
      await model.auth.remove(adminUserDoc._id)
    } else if (!_.isEmpty(adminUserDoc)) {
      logger.info({ message: 'Admin user is already configured' })
      return
    } else {
      logger.info({
        message: 'Admin user is not configured. Starting configuration'
      })
    }

    // Read or generate password for admin
    let password
    try {
      await fs.ensureFile(passwordPath)
      password = (await fs.readFile(passwordPath)).toString()
      // NOTE: never use special characters. when $ is included in a password,
      // it can cause a HUGE trouble when used it as a Gitlab CI variable.
      password = passGenerator.generate({
        length: 20,
        uppercase: true,
        symbols: false,
        numbers: true
      })
      await fs.writeFile(passwordPath, password)
      logger.info({
        message: `Generated password file for admin user at ${passwordPath}`
      })
    } catch (err) {
      const error = new Error(
        `Failed to generate password file at ${passwordPath}`
      )
      error.extra = err
      throw error
    }

    // Confirm password file
    const passwordWritten = (await fs.readFile(passwordPath)).toString()
    if (passwordWritten != password) {
      throw new Error(
        `Password written at ${passwordPath} doesn't match with original password`
      )
    }

    // Generate password has using bcrypt
    let passwordHash
    try {
      const saltRounds = this.authConfigs.local.saltRounds
      passwordHash = await bcrypt.hash(password, saltRounds)
      logger.info({
        message: `Generated password hash for admin user using bcrypt`
      })
    } catch (err) {
      const error = new Error(
        `Failed to generate password hash for "${adminUser}"`
      )
      error.extra = err
      throw error
    }

    // Create a new user object for admin
    try {
      const newUser = {
        _id: adminUser,
        admin: true,
        username: adminUser,
        name: 'Administrator',
        email: `${adminUser}@${this.authConfigs.local.domain}`,
        local: true,
        localPasswordHash: passwordHash
      }
      const adminUserObj = await model.auth.create(newUser)
      logger.info({ message: `Created admin user "${adminUser}"` })
    } catch (err) {
      const error = new Error(`Failed to create admin user "${adminUser}"`)
      error.extra = err
      throw error
    }
  }

  /**
   * Authenticates a user using username and password
   *
   * @param {String} username
   * @param {String} password
   * @returns {Promise<Object>}
   */
  async authenticate (username, password) {
    const token = {
      validationKey: this.authConfigs.token.validationKey,
      username: username
    }

    let authInfo = await model.auth.get(username)

    if (this.authConfigs.ldap && (_.isEmpty(authInfo) || !authInfo.local)) {
      // Authenticate using LDAP
      const ldapInfo = await ldap.authenticateLdapts(
        this.authConfigs.ldap,
        username,
        password
      )
      token.user = ldapInfo.mail
      token.name = ldapInfo.displayName

      // create user auth document for new users
      if (_.isEmpty(authInfo)) {
        const authObj = {
          _id: username,
          email: token.user,
          name: token.name,
          username: token.username
        }
        _.extend(authInfo, await model.auth.create(authObj))
        logger.info({ message: `created auth document for ${username}` })
      }
    } else {
      // Authenticate using local password hash
      const matched = await bcrypt.compare(password, authInfo.localPasswordHash)
      if (!matched) {
        throw new LocalAuthError(
          `User credential didn't match for user "${username}"`
        )
      }
      token.user = `${username}@${this.authConfigs.local.domain}`
      token.name = 'Administrator'
      token.admin = authInfo.admin
    }

    //-------------------------------------------------------------------------
    // IMPORTANT : Populate user data for backward data compatibility
    //
    // TODO: Get a service account for AD, and run an initialization task to
    // update username, email, name for all users registered
    //-------------------------------------------------------------------------
    const hasMissingField =
      _.isUndefined(authInfo.username) ||
      _.isUndefined(authInfo.email) ||
      _.isUndefined(authInfo.name)
    if (hasMissingField) {
      const updateObj = {
        email: token.user,
        name: token.name,
        username: token.username
      }
      await model.auth.update(username, updateObj)
      logger.info({ message: `Updated auth document for ${username}` })
    }

    //-------------------------------------------------------------------------
    // Check BitBucket token
    //
    // NOTE: We should use OAuth flow instead. This only works when a user's
    // AD credentials are directly received.
    //-------------------------------------------------------------------------
    if (this.authConfigs.bitbucket.enabled) {
      await this.getBitbucketToken(password, token, authInfo)
    }

    // Create a signed JWT token
    const signedToken = await jwtSign(token, this.jwtSecret)

    return { signedToken, token }
  }

  async createToken (username, email, name) {
    const token = {
      validationKey: this.authConfigs.token.validationKey,
      username,
      user: email,
      name
    }

    // Create a new user profile if needed
    let authInfo = await model.auth.get(username)
    if (_.isEmpty(authInfo)) {
      const authObj = {
        _id: username,
        email: token.user,
        name: token.name,
        username: token.username
      }
      _.extend(authInfo, await model.auth.create(authObj))
    }

    const hasMissingField =
      _.isUndefined(authInfo.username) ||
      _.isUndefined(authInfo.email) ||
      _.isUndefined(authInfo.name)
    if (hasMissingField) {
      const updateObj = {
        email: token.user,
        name: token.name,
        username: token.username
      }
      await model.auth.update(username, updateObj)
      logger.info({ message: `Updated auth document for ${username}` })
    }

    // Create a signed JWT token
    const signedToken = await jwtSign(token, this.jwtSecret)

    return { signedToken, token }
  }

  isAuthSupported () {
    const authSupported =
      !_.isUndefined(this.jwtSecret) &&
      !_.isUndefined(this.authConfigs.loginUrl)
    return authSupported
  }

  getLoginUrl () {
    return this.authConfigs.loginUrl
  }

  getLogoutUrl () {
    return this.authConfigs.logoutUrl
  }

  getJwtSecret () {
    return this.jwtSecret
  }

  getAdminEmail () {
    const adminUsername = this.authConfigs.local.admin.username
    const localDomain = this.authConfigs.local.domain
    return `${adminUsername}@${localDomain}`
  }

  async parseToken (token) {
    if (_.isUndefined(token) || _.isEmpty(token)) {
      throw new Error('JWT token not supplied')
    }

    const parsedToken = await jwtVerify(token, this.jwtSecret)
    if (parsedToken.validationKey != this.authConfigs.token.validationKey) {
      throw new Error('JWT invalidated by server for forced login')
    }
    if (this.authConfigs.bitbucket.enabled && !parsedToken.bitbucketToken) {
      throw new Error("property 'bitbucketToken' not found from JWT")
    }
    if (!parsedToken.user) {
      throw new Error("property 'user' not found from JWT")
    }
    if (!parsedToken.username) {
      throw new Error("property 'username' not found from JWT")
    }
    return parsedToken
  }

  async getBitbucketToken (password, token, authInfo) {
    const username = token.username

    // Skip getting bitbucket token for local users or when LDAP is not enabled.
    if (authInfo.local || !this.authConfigs.ldap) {
      token.bitbucketToken = 'not available'
      return
    }

    // Check BitBucket token
    if (authInfo.bitbucketToken) {
      const bitbucketToken = authInfo.bitbucketToken
      const bitbucket = new BitBucket(
        this.authConfigs.bitbucket.url,
        bitbucketToken
      )
      try {
        await bitbucket.getUserSettings(username)
      } catch (err) {
        logger.warn({ message: `Invalid BitBucket token for ${username}` })
        delete authInfo.bitbucketToken
      }
    }

    // Create BitBucket token if bitbucketToken does not exist in authInfo
    if (!authInfo.bitbucketToken) {
      const bitbucket = new BitBucket(this.authConfigs.bitbucket.url, password)
      const bitbucketInfo = await bitbucket.createAccessToken(
        username,
        this.authConfigs.bitbucket.tokenInfo
      )
      logger.info({ message: `created BitBucket token for ${username}` })
      _.extend(
        authInfo,
        await model.auth.update(username, {
          bitbucketToken: bitbucketInfo.token
        })
      )
      logger.info({
        message: `updated auth document for ${username} with BitBucket token`
      })
    }
    token.bitbucketToken = authInfo.bitbucketToken
  }
}

exports.AuthService = AuthService
