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
const models = require('../models')

async function setAlias (aliasName, uuid, targetType, logger) {
  const exisingAlias = await models.alias.getByUuid(uuid)
  if (exisingAlias) {
    await models.alias.remove(exisingAlias._id)
    logger.event({
      alias: exisingAlias._id,
      message: 'Existing alias has been removed',
      type: 'Alias',
      status: 'Deleted'
    })
  }
  const alias = aliasName
  const body = {
    _id: alias,
    target: targetType,
    uuid: uuid
  }
  const newAlias = await models.alias.create(body)
  logger.event({
    alias: newAlias._id,
    targetType: newAlias.target,
    targetUuid: newAlias.uuid
  })

  return newAlias
}

exports.setAlias = setAlias
