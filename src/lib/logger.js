const _ = require('underscore');
const { Console } = require('console');

class NewConsole  {
    constructor(options, serviceName){
        this._console = new Console(options);
        this.serviceName = serviceName;
        if (options.levels){
            this.levels = options.levels;
        }
        else {
            this.levels = ['info','event','debug','warn','error','critical'];
        }
        this._build();
    }

    _build(){
        this.levels.forEach((level) => {
            const levelStr = level.toUpperCase();
            this[level] = function(obj){
                this._common(levelStr, obj);
            };
        });
    }

    _common(level, obj){
        if (!_.isObject(obj)){
            const message = obj;
            obj = {
                message : message
            };
        }
        else if (obj instanceof Error){
            const errObj = obj;
            obj = {
                message : errObj.message,
                stack : errObj.stack
            };
            if (_.isObject(errObj.extra)){
                _.extend(obj, errObj.extra);
            }
        }

        if (!_.isUndefined(this.serviceName)){
            obj.service = this.serviceName;
        }
        obj.level = level;
        this._console.log(JSON.stringify(obj));
    }
}

exports.create = function(serviceName){
    const options = {
        stdout:process.stdout, 
        stderr:process.stderr, 
        colorMode: false
    };
    const newConsole = new NewConsole(options, serviceName);
    return newConsole;
};