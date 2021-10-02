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
