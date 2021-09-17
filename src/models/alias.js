'use strict'

const CONST = require('../lib/constant')
const _ = require('underscore')
const BaseModel = require('./base')

class AliasModel extends BaseModel {
  constructor () {
    super(CONST.MODEL.ALIAS)
    this._schema = [
      { name: '_id', type: 'String', required: true }, // alias is the id
      { name: 'target', type: 'String', required: true },
      { name: 'uuid', type: 'String', required: true }
    ]

    this.collection.ensureIndex({ fieldName: 'uuid', unique: true })
  }

  /**
*
* @param {String} id
* @param {Object} projection
*/
  async getByUuid (id, projection = {}) {
    return new Promise((resolve, reject) => {
      this.collection.findOne({ uuid: id }, projection, function (err, doc) {
        if (err) {
          err = _.extend(new Error(err.message), err)
          reject(err)
        } else {
          resolve(doc)
        }
      })
    })
  }
}

module.exports = new AliasModel()
