'use strict';

const CONST = require('../lib/constant');
const BaseModel = require('./base');

class AuthModel extends BaseModel {
    constructor(){
        super(CONST.MODEL.AUTH);
        this._schema = [
            {name: '_id',               type:'String',  required:true}, // Currently using username as _id
            {name: 'name',              type:'String',  required:true},
            {name: 'email',             type:'String',  required:true},
            {name: 'username',          type:'String',  required:true},
            {name: 'bitbucketToken',    type:'String',  required:false},
            {name: 'admin',             type:'Boolean', required:false},
            {name: 'local',             type:'Boolean', required:false},
            {name: 'localPasswordHash', type:'String',  required:false}
        ];
    }
}

module.exports = new AuthModel();