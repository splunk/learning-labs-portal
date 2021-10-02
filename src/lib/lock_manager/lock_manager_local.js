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

const { MutexBase, ConditionVariableBase, LockManagerBase } = require('./base');
const _ = require('underscore');

class Mutex {
    constructor(){
        this.pending = [];
    }

    /**
     * Acquires a mutex
     */
    lock (){
        return new Promise((resolve) => {
            if (this.pending.length <= 0){
                return resolve();
            }
            this.pending.push(() => {
                setImmediate(() => {
                    resolve();
                });
            });
        });
    }

    /**
     * Releases a mutex
     */
    unlock(){
        return new Promise((resolve) => {
            if (this.pending.length > 0){
                const callback = this.pending.shift();
                callback();
            }
            resolve();
        });
    }
}

class ConditionVariable {
    constructor(){
        this.pending = [];
    }

    _waitForNotification (){
        return new Promise((resolve) => {    
            this.pending.push(() => {
                setImmediate(() => {
                    resolve();
                });
            });
        });
    }

    /**
     * Waits until notified
     * 
     * @param {Mutex} mutex 
     */
    async wait (mutex) {
        await mutex.unlock();
        await this._waitForNotification();
        await mutex.lock();
    }

    /**
     * Sends a notification to wake up a pending async function
     */
    notify (){
        return new Promise((resolve) => {
            if (this.pending.length > 0){
                const callback = this.pending.shift();
                callback();
            }
            resolve();
        });
    }
}

class LockManager extends LockManagerBase {
    constructor(){
        super();
        this.locks = {};
    }

    _init (key){
        if (!_.isUndefined(this.locks[key])){
            return;
        }
        this.locks[key] = {
            mutex : new Mutex(),
            cond : new ConditionVariable(),
            exclusive : 0,
            shared : 0
        };
    }

    /**
     * Acquires a shared lock for a specified key
     * 
     * @param {String} key 
     * @param {Number} limit
     */
    async lockShared (key, limit = Number.POSITIVE_INFINITY){
        this._init(key);
        const lockInfo = this.locks[key];
        await lockInfo.mutex.lock();
        while (lockInfo.exclusive > 0 || lockInfo.shared > limit){
            await lockInfo.cond.wait(lockInfo.mutex);
        }
        lockInfo.shared += 1;
        await lockInfo.mutex.unlock();
    }

    /**
     * Releases a shared lock for a specified key
     * 
     * @param {String} key 
     */
    async unlockShared (key){
        const lockInfo = this.locks[key];
        await lockInfo.mutex.lock();
        lockInfo.shared -= 1;
        await lockInfo.cond.notify();
        await lockInfo.mutex.unlock();
    }

    /**
     * Acquires an exclusive lock for a specified key
     * 
     * @param {String} key 
     */
    async lockExclusive (key){
        this._init(key);
        const lockInfo = this.locks[key];
        await lockInfo.mutex.lock();
        while (lockInfo.exclusive > 0 || lockInfo.shared > 0){
            await lockInfo.cond.wait(lockInfo.mutex);
        }
        lockInfo.exclusive += 1;
        await lockInfo.mutex.unlock();
    }

    /**
     * Releases an exclusive lock for a specified key
     * 
     * @param {String} key 
     */
    async unlockExclusive (key){
        const lockInfo = this.locks[key];
        await lockInfo.mutex.lock();
        lockInfo.exclusive -= 1;
        await lockInfo.cond.notify();
        await lockInfo.mutex.unlock();
    }
}

module.exports = LockManager;