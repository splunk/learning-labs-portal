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

const CONST = require('../lib/constant');
const BaseModel = require('./base');

class DeploymentModel extends BaseModel {
    constructor(){
        super(CONST.MODEL.DEPLOYMENT);
        this._schema = [
            {name: '_id',    type:'String', required:true},
            {name: 'status', type:'String', required:true},
            {name: 'host',   type:'String', required:false},
            {name: 'port',   type:'String', required:false}
        ];
    }
}

module.exports = new DeploymentModel();