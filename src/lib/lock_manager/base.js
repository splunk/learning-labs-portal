const _ = require('underscore');

class LockManagerBase {
    lockShared(key){
        return Promise.reject(new Error('method "lockShared" is not implemented'));
    }
    unlockShared(key){
        return Promise.reject(new Error('method "unlockShared" is not implemented'));
    }
    lockExclusive(key){
        return Promise.reject(new Error('method "lockExclusive" is not implemented'));
    }
    unlockExclusive(key){
        return Promise.reject(new Error('method "unlockExclusive" is not implemented'));
    }

    /**
     * Executes a function while holding a shared lock of a given key
     * 
     * @param {String} key 
     * @param {Function} func 
     */
    async waitShared(key, func){
        if (!_.isString(key)){
            throw new Error('Invalid Argument : "key" is not type of String');
        }
        if (!_.isFunction(func)){
            throw new Error('Invalid Argument : "func" is not type of Function');
        }
        await this.lockShared(key);
        try {
            const val = await func();
            await this.unlockShared(key);
            return val;
        }
        catch (err){
            await this.unlockShared(key);
            throw err;
        }
    }

    /**
     * Executes a function while holding a shared lock of a given key
     * 
     * @param {String} key 
     * @param {Number} limit
     * @param {Function} func 
     */
    async waitSharedLimit(key, limit, func){
        if (!_.isString(key)){
            throw new Error('Invalid Argument : "key" is not type of String');
        }
        if (!_.isNumber(limit)){
            throw new Error('Invalid Argument : "key" is not type of String');
        }
        if (!_.isFunction(func)){
            throw new Error('Invalid Argument : "func" is not type of Function');
        }
        await this.lockShared(key, limit);
        try {
            const val = await func();
            await this.unlockShared(key);
            return val;
        }
        catch (err){
            await this.unlockShared(key);
            throw err;
        }
    }

    /**
     * Executes a function while holding a exclusive lock of a given key
     * 
     * @param {String} key 
     * @param {Function} func 
     */
    async waitExclusive(key, func){
        if (!_.isString(key)){
            throw new Error('Invalid Argument : "key" is not type of String');
        }
        if (!_.isFunction(func)){
            throw new Error('Invalid Argument : "func" is not type of Function');
        }
        await this.lockExclusive(key);
        try {
            const val = await func();
            await this.unlockExclusive(key);
            return val;
        }
        catch (err){
            await this.unlockExclusive(key);
            throw err;
        }
    }
}

exports.LockManagerBase = LockManagerBase;