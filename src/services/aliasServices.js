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
