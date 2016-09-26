var _ = require('lodash');
var through = require('through2');
var gutil = require('gulp-util');
var webpack = require('webpack');
var MemoryFS = require('memory-fs');
var path = require('path');

function webpackIndividuals(config, specialWebpack, doneCallback) {
    var PLUGIN_NAME = 'webpack-individuals';
    var cfg = config ? _.clone(config) : {};
    var memFs = new MemoryFS();
    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            // nothing to do
            return callback(null, file);
        }

        if (process.env.DEBUG){
            gutil.log("webpackIndividuals: called!  File.path=" + file.path + " named=" + file.named + " file-type=" + getFileType(file));
        }

        cfg.entry = {};
        cfg.entry[file.named] = file.path;

        var self = this;
        var compiler = (specialWebpack || webpack).call(null, cfg);

        compiler.outputFileSystem = memFs;
        compiler.run(function (err, stats) {
            if (err) {
                self.emit('error', new gutil.PluginError(PLUGIN_NAME, err + ''));
            }

            var jsonStats = stats.toJson() || {};
            var errors = jsonStats.errors || [];
            if (errors.length) {
                var errorMessage = errors.reduce(function (resultMessage, nextError) {
                    resultMessage += nextError.toString();
                    return resultMessage;
                }, '');

                self.emit('error', new gutil.PluginError(PLUGIN_NAME, errorMessage));
            }

            //gutil.log(stats.toString({colors: gutil.colors.supportsColor}));
            gutil.log("Finished webpack " + file.named + " after " + (stats.endTime - stats.startTime) / 1000 + 's');

            _.each(stats.compilation.assets, function(val, key){
                if (!val || !val.source || !val.source.call){
                    self.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Invalid value of assets'));
                    return;
                }

                var finalName, finalExt = path.extname(val.existsAt) ;
                if (!cfg.output || !cfg.output.filename){
                    finalName = file.named + '_' + stats.hash + finalExt;
                } else {
                    finalName = cfg.output.filename.replace('[name]', file.named).replace('[hash]', stats.hash);
                }

                // 将.map文件的后缀名加上
                var curExt = path.extname(finalName);
                if (curExt !== finalExt){
                    finalName = finalName + finalExt;
                    //finalName = finalName.substring(0, finalName.length - curExt.length) + finalExt;
                }

                self.push(_.extend(new gutil.File({
                    base: file.base,
                    cwd: file.cwd,
                    path: path.join(file.base, finalName),
                    contents: new Buffer(val.source()),
                }), {
                    srcPath: file.path,
                    hash: stats.hash,
                    depends: stats.compilation.fileDependencies,
                    named: file.named,
                }));
            });

            if (doneCallback && typeof doneCallback === 'function'){
                doneCallback(err, stats, file);
            }

            callback();
        });
    });
}

function getFileType(file){
    if (file.isNull()){
        return 'null';
    } else if (file.isBuffer()){
        return 'buffer';
    } else if (file.isStream()){
        return 'stream';
    } else {
        return 'unknown';
    }
}

module.exports = webpackIndividuals;
