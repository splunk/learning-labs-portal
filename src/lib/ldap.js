const _ = require('underscore');

class LdapAuthError extends Error {
    constructor(message){
        super(message);
        this.name = 'LdapAuthError';
    }
}

exports.LdapAuthError = LdapAuthError;

exports.authenticateLdapSearch = async function (ldapConfig, username, password){
    const { promisify } = require('util');
    const exec = promisify(require('child_process').exec);

    const bindDN = `${username}@${ldapConfig.domain}`;
    const filter = `(${ldapConfig.usernameField}=${username})`;
    const fields = _.unique((ldapConfig.fields || []).concat(['displayName', 'mail']));
    const command = `ldapsearch -H ${ldapConfig.url} -D ${bindDN} ` +
        `-w "${password}" -b ${ldapConfig.searchBase} "${filter}" ${fields.join(' ')}`;

    let stdout;
    try {
        const res = await exec(command);
        stdout = res.stdout;
    }
    catch(err){
        const message = `LDAP authentication failed with ${username}, stderr: ${err.stderr}`;
        const error = new LdapAuthError(message);
        throw error;
    }

    try {
        const ldapInfo = {};
        if (fields.indexOf('displayName') >= 0){
            ldapInfo.displayName = stdout.match(/displayName: (.*)/)[1];
        }
        if (fields.indexOf('mail') >= 0){
            ldapInfo.mail = stdout.match(/mail: (.*)/)[1];
        }
        return ldapInfo;
    }
    catch(err){
        const message = `Failed to parse LDAP info with ${username}, message: ${err.message}, stdout: ${stdout}`;
        const error = new LdapAuthError(message);
        throw error;
    }
};

exports.authenticateLdapts = async function(ldapConfig, username, password){
    const { Client } = require('ldapts');
    const bindDN = `${username}@${ldapConfig.domain}`;
    const filter = `(${ldapConfig.usernameField}=${username})`;
    const fields = _.unique((ldapConfig.fields || []).concat(['displayName', 'mail']));
     
    const client = new Client({
        url: ldapConfig.url
    });
    
    let ldapInfo;
    try {
        await client.bind(bindDN, password);
        
        const { searchEntries } = await client.search(ldapConfig.searchBase, {
            attributes: ldapConfig.searchAttributes,
            filter: filter
        });
        ldapInfo =  _.pick(searchEntries[0], ldapConfig.searchAttributes);
    } 
    catch (err) {
        const message = `LDAP authentication failed with ${username}, message: ${err.message}`;
        const error = new LdapAuthError(message);
        throw error;
    } 
    finally {
        await client.unbind();
    }
    return ldapInfo;
}

exports.authenticateLdapAuth = function (ldapConfig, username, password){
    const LdapAuth = require('ldapauth-fork');
    const server = {
        url : ldapConfig.url,
        bindDN : `${username}@${ldapConfig.domain}`,
        bindCredentials : password,
        searchBase : ldapConfig.searchBase,
        searchAttributes : ldapConfig.searchAttributes,
        searchFilter : `(${ldapConfig.usernameField}=${username})`,
    };
    const auth = new LdapAuth(server);
    return new Promise((resolve, reject) => {
        auth.authenticate(username, password, (err, res)=>{
            auth.close(()=>{
                if (err){
                    const message = `LDAP authentication failed with ${username}, message: ${err.message}`;
                    const error = new LdapAuthError(message);
                    reject(error);
                }
                else {
                    const ldapInfo = _.pick(res, ldapConfig.searchAttributes);
                    resolve(ldapInfo);
                }
            });
        });
    });
}