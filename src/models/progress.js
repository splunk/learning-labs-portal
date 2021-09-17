'use strict';

const _ = require('underscore');
const CONST = require('../lib/constant');
const BaseModel = require('./base');

class ProgressModel extends BaseModel {
    constructor(){
        super(CONST.MODEL.PROGRESS);
        this._schema = [
            {name: '_id',        type:'String', required:true},
            {name: 'attempted',  type:'Array',  required:true},
            {name: 'completed',  type:'Array',  required:true}
        ];
    }
}

module.exports = new ProgressModel();