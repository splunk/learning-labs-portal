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

const vm = require('vm');
const request = require('request-promise-native');

// TODO: Make this as a separate library
function createStringBuilder(items){
    const builder = items.reduce((accum, value)=>{
        const template = value.template.replace(/\$\{/g, '${param');
        const code = `const func = () => { return \`${template}\`; }; func();`;
        accum[value.name] = function() { 
            const newArgs = {};
            for(let param in arguments){
                newArgs["param"+param] = arguments[param];
            }
            return vm.runInNewContext(code, newArgs);
        };
        return accum;
    }, {});
    return builder;
}

// DEFINE BITBUCKET API
const apiGen = createStringBuilder([
    { 
        name : 'accessTokenByUserId',
        template : "/rest/access-tokens/1.0/users/${0}"
    },
    { 
        name : 'accessTokenByUserId',
        template : "/rest/access-tokens/1.0/users/${0}"
    },
    {
        name : 'userSettings',
        template : "/rest/api/1.0/users/${0}/settings"
    }
]);

class BitBucket {
    constructor(bitbucketUrl, password){
        this.baseUrl = bitbucketUrl;
        this.password = password;
    }

    async getAccessTokens(username){
        const url = this.baseUrl + apiGen.accessTokenByUserId(username);
        const auth = {user: username, pass: this.password};
        const options = { url: url, method:'GET', json: true, auth: auth};
        const body = await request(options);
        return body.values;
    }

    async createAccessToken(username, tokenInfo){
        const url = this.baseUrl + apiGen.accessTokenByUserId(username);
        const auth = {user: username, pass: this.password};
        const options = { url: url, method:'PUT', json: true, auth: auth, body: tokenInfo};
        const body = await request(options);
        return body;
    }

    async getUserSettings(username){
        const url = this.baseUrl + apiGen.userSettings(username);
        const headers = {Authorization: `Bearer ${this.password}`};
        const options = { url: url, method:'GET', json: true, headers: headers};
        const body = await request(options);
        return body;
    }
}

exports.BitBucket = BitBucket;