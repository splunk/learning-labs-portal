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
const path = require('path')
const yn = require('yn')
const fs = require('fs')

//-------------------------------------------------------------------
//
// CONSTANTS : ENUMS
//
//-------------------------------------------------------------------
const ENUM_DATASTORE = {
  LOCAL: 'local',
  MONGO: 'mongo'
}

const ENUM_CATALOG_STATE = {
  PUBLISHED: 'published',
  STAGED: 'staged',
  DRAFTED: 'drafted'
}

const ENUM = {
  DATASTORE: Object.freeze(ENUM_DATASTORE),
  CATALOG_STATE: Object.freeze(ENUM_CATALOG_STATE)
}

//-------------------------------------------------------------------
//
// CONSTANTS : CONFIG
//
//-------------------------------------------------------------------
const CONFIG = {
  LOG_SPLUNK: process.env.LOG_DRIVER || false,
  LOG_SPLUNK_TOKEN: process.env.LOG_SPLUNK_TOKEN || null,
  LOG_SPLUNK_URL: process.env.LOG_SPLUNK_URL || null,
  LOG_SPLUNK_INDEX: process.env.LOG_SPLUNK_INDEX || null,
  LOG_SPLUNK_SOURCE: process.env.LOG_SPLUNK_SOURCE || null,
  LOG_SPLUNK_SOURCETYPE: process.env.LOG_SPLUNK_SOURCETYPE || null,
  PORT: Number(process.env.PORT) || 80,
  PORT_HTTPS: Number(process.env.PORT_HTTPS) || 443,
  DOMAIN: process.env.DOMAIN,
  RESTART_DOCS: process.env.RESTART_DOCS == 'yes'
}

//-------------------------------------------------------------------
//
// CONSTANTS : DATASTORE
//
//-------------------------------------------------------------------
const DATASTORE = {
  STORE: process.env.DATASTORE || ENUM.DATASTORE.LOCAL,
  URL:
    process.env.DATASTORE_URL || path.join(process.env.HOME, '/mount/datastore')
}

//-------------------------------------------------------------------
//
// CONSTANTS : DEPLOYMENT_LOCAL
//
//-------------------------------------------------------------------
const DEPLOYMENT_LOCAL = {
  VOLUME: path.normalize(
    process.env.VOLUME || path.join(process.env.HOME, 'mount')
  ),
  BRIDGE: process.env.BRIDGE || false,
  PORT: 4000
}

//-------------------------------------------------------------------
//
// CONSTANTS : ERRORCODE
//
//-------------------------------------------------------------------
const ERRORCODE = {
  DATABASE_GENERIC: 1000,
  DATABASE_DOC_NOT_FOUND: 1001
}

//-------------------------------------------------------------------
//
// CONSTANTS : MODEL
//
//-------------------------------------------------------------------
const MODEL = {
  AUTH: 'auth',
  DEPLOYMENT: 'deployment',
  CATALOG: 'catalog',
  TRACK: 'track',
  PROGRESS: 'progress'
}

//-------------------------------------------------------------------
//
// CONSTANTS : SERVICES
//
//-------------------------------------------------------------------
const SERVICES = {
  DEPLOYMENT: `${
    CONFIG.SSL_ENABLED ? 'https' : 'http'
  }://ws-svc/api/deployment`,
  PROGRESS: `${CONFIG.SSL_ENABLED ? 'https' : 'http'}://ws-svc/api/progress`,
  CATALOG: `${CONFIG.SSL_ENABLED ? 'https' : 'http'}://ws-svc/api/catalog`
}

const constant = {
  CONFIG: Object.freeze(CONFIG),
  DEPLOYMENT_LOCAL: Object.freeze(DEPLOYMENT_LOCAL),
  DATASTORE: Object.freeze(DATASTORE),
  ENUM: Object.freeze(ENUM),
  ERRORCODE: Object.freeze(ERRORCODE),
  MODEL: Object.freeze(MODEL),
  SERVICES: Object.freeze(SERVICES)
}

module.exports = Object.freeze(constant)
