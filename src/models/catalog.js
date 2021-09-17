'use strict';

const _ = require('underscore');
const CONST = require('../lib/constant');
const BaseModel = require('./base');

class CatalogModel extends BaseModel {
    constructor(){
        super(CONST.MODEL.CATALOG);
        this._schema = [
            {name: '_id',           type:'String',  required:false},
            {name: 'title',         type:'String',  required:true},
            {name: 'description',   type:'String',  required:true},
            {name: 'maintainer',    type:'Array',   required:true},
            {name: 'image',         type:'String',  required:true},
            {name: 'imageDigest',   type:'String',  required:true},
            {name: 'requirements',  type:'Array',   required:false},
            {name: 'rating',        type:'Number',  required:false},
            {name: 'state',         type:'String',  required:true},
            {name: 'alias',        type:'String',  required:false}
        ];
    }
}

module.exports = new CatalogModel();