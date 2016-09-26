var path = require('path');
var _ = require('lodash');
var fs =require('fs');


function SimpleFileCache(options)
{
    if (typeof options !== 'object'){
        options = {file: options};
    }

    options = _.extend({
        file: null,
        autoload: true,
        initialData: {},
    }, options || {});


    if (!options.file){
        options.file = process.env.CACHE_PATH;
    }

    this.options = options;
    this.data = options.initialData || {};

    //console.log("Cache created at " + this.options.file);

    if (options.autoload){
        this.load();
    }

    return this;
}

SimpleFileCache.create = function(options){
    return new SimpleFileCache(options);
};


var instance = null;
SimpleFileCache.instance = function(){
    if (instance){
        return instance;
    }

    return (instance = this.create.apply(this, arguments));
};

SimpleFileCache.prototype.load = function(){
    try {
        this.data = JSON.parse(fs.readFileSync(this.options.file, 'utf8'));
        if (typeof this.data !== 'object'){
            this.data = {};
        }
    } catch (e) {
        this.data = {};
    }

    return this;
};

SimpleFileCache.prototype.save = function(done){
    fs.writeFile(this.options.file, JSON.stringify(this.data, null, ' '), 'utf8', function(error){
        done(error);
    });
    return this;
};

SimpleFileCache.prototype.get = function(key){
    return this.data[key];
};

SimpleFileCache.prototype.set = function(key, val){
    this.data[key] = val;
    return this;
};

SimpleFileCache.prototype.put = SimpleFileCache.prototype.set;

SimpleFileCache.prototype.fill = function(data){
    this.data = _.extend(this.data, data || {});
    return this;
};


module.exports = SimpleFileCache;
