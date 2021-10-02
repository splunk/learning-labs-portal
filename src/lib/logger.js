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

const _ = require('underscore');
const { Console } = require('console');

class NewConsole  {
    constructor(options, serviceName){
        this._console = new Console(options);
        this.serviceName = serviceName;
        if (options.levels){
            this.levels = options.levels;
        }
        else {
            this.levels = ['info','event','debug','warn','error','critical'];
        }
        this._build();
    }

    _build(){
        this.levels.forEach((level) => {
            const levelStr = level.toUpperCase();
            this[level] = function(obj){
                this._common(levelStr, obj);
            };
        });
    }

    _common(level, obj){
        if (!_.isObject(obj)){
            const message = obj;
            obj = {
                message : message
            };
        }
        else if (obj instanceof Error){
            const errObj = obj;
            obj = {
                message : errObj.message,
                stack : errObj.stack
            };
            if (_.isObject(errObj.extra)){
                _.extend(obj, errObj.extra);
            }
        }

        if (!_.isUndefined(this.serviceName)){
            obj.service = this.serviceName;
        }
        obj.level = level;
        this._console.log(JSON.stringify(obj));
    }
}

exports.create = function(serviceName){
    const options = {
        stdout:process.stdout, 
        stderr:process.stderr, 
        colorMode: false
    };
    const newConsole = new NewConsole(options, serviceName);
    return newConsole;
};