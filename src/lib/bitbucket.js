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