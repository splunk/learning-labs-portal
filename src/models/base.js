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

'use strict';

const path = require('path');
const Datastore = require('nedb');
const _ = require('underscore');
const CONST = require('../lib/constant');

class BaseModel {
    /**
     * Creates a new datastore model
     * 
     * @param {String} modelName 
     */
    constructor(modelName){
        this._schema = [];
        if (CONST.DATASTORE.STORE == CONST.ENUM.DATASTORE.LOCAL){
            const databasePath = path.join(CONST.DATASTORE.URL, `${modelName}.db`);
            this.collection = new Datastore({ filename : databasePath, autoload:true });
        }
        else {
            throw new Error(`DATASTORE ${CONST.DATASTORE.STORE} IS NOT SUPPORTED`);
        }
    }

    /**
     * Filter values by schema
     * 
     * @param {Object} values 
     */
    _validate(values){
        let filteredValues = {};
        for (let schemaItem of this._schema){
            const name = schemaItem.name;
            const type = schemaItem.type;
            const value = values[name];
            if (schemaItem.required && _.isUndefined(value)){
                throw new Error(`property "${name}" is required`);
            }
            function isCorrectType(value){
                return _[`is${type}`](value);
            }
            if (!_.isUndefined(value) && !isCorrectType(value)){
                throw new Error(`property "${name}" should be type of ${type}`);
            }
            if (!_.isUndefined(value)){
                filteredValues[name] = value;
            }
        }
        return filteredValues;
    }

     /**
     * 
     * @param {String} id 
     * @param {Object} projection
     */
    async get(id, projection = {}){
        return new Promise((resolve, reject) => {
            this.collection.findOne({_id : id}, projection, function(err, doc){
                if (err){
                    err = _.extend(new Error(err.message), err);
                    reject(err);
                }
                else if (doc === null){
                    resolve({});
                }
                else {
                    resolve(doc);
                }
            });
        });
    }

    /**
     * 
     * @param {Object} query 
     * @param {Object} projection
     * @param {Object} sort
     * @param {Number|Null} skip 
     * @param {Number|Null} limit 
     */
    getAll (query = {}, projection = {}, sort = {}, skip = null, limit = null){
        return new Promise((resolve, reject) => {
            let command = this.collection.find(query, projection).sort(sort);
            if (!_.isNull(skip)){
                command = command.skip(skip);
            }
            if (!_.isNull(limit)){
                command = command.limit(limit)
            }
            command.exec((err, docs) => {
                if (err){
                    err = _.extend(new Error(err.message), err);
                    reject(err);
                }
                else if (docs === null){
                    resolve([]);
                }
                else {
                    resolve(docs);
                }
            });
        });
    }

    /**
     * Creates a new document
     * 
     * @param {Object} values 
     */
    async create(values){
        const filteredValues = this._validate(values);
        return new Promise((resolve, reject) => {
            this.collection.insert(filteredValues, (err, doc) => {
                if (err){
                    const error = new Error('Failed to insert a new document');
                    error.original = err;
                    error.code = CONST.ERRORCODE.DATABASE_INSERT_ERROR;
                    reject(error);
                }
                else {
                    resolve(doc);
                }
            });
        });
    }

    /**
     * Updates a document for a given id
     * @param {String} id 
     * @param {Object} values 
     * @param {Object} options
     */
    async update(id, values, options = {}){
        return new Promise((resolve, reject) => {
            options.returnUpdatedDocs = true;
            options.command = options.command || '$set';
            const update = {};
            update[options.command] = values;
            this.collection.update({_id:id}, update, options, function(err, numUpdated, updatedDoc){
                if (err){
                    const error = new Error('Encountered unexpeted error while updating document');
                    error.original = err;
                    error.code = CONST.ERRORCODE.DATABASE_GENERIC;
                    reject(error);
                }
                else if (numUpdated <= 0){
                    const error = new Error(`A document is not found for id = ${id}`);
                    error.code = CONST.ERRORCODE.DATABASE_DOC_NOT_FOUND;
                    reject(error);
                }
                else {
                    resolve(updatedDoc);
                }
            });
        });
    }

    /**
     * Removes a document for a given id
     * @param {Number} id 
     */
    async remove(id){
        return new Promise((resolve, reject) => {
            this.collection.remove({_id:id}, {}, function(err, numRemoved){
                if (err){
                    const error = new Error('Encountered unexpeted error while removing a document');
                    error.original = err;
                    error.code = CONST.ERRORCODE.DATABASE_GENERIC;
                    reject(error);
                }
                else if (numRemoved <= 0){
                    const error = new Error(`A document is not found for id = ${id}`);
                    error.code = CONST.ERRORCODE.DATABASE_DOC_NOT_FOUND;
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
}

module.exports = BaseModel;