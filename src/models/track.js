'use strict';

const _ = require('underscore');
const CONST = require('../lib/constant');
const BaseModel = require('./base');

class TrackModel extends BaseModel {
    constructor(){
        super(CONST.MODEL.TRACK);
        this._schema = [
            {name: '_id',         type:'String', required:false},
            {name: 'name',        type:'String', required:true},
            {name: 'description', type:'String', required:true},
            {name: 'maintainer',  type:'Array',  required:true},
            {name: 'docs',        type:'Array',  required:true},
            {name: 'alias',        type:'String',  required:false}
        ];
    }
}

module.exports = new TrackModel();