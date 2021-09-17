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