var gutil = require('gulp-util');
var through = require('through2');
var uglifyJs = require('uglify-js');
var streamBuffers = require('stream-buffers');
var readStreamToEnd = require('./read-stream-to-end');
var _ = require('lodash');

var PLUGIN_NAME = 'uglify-inplace';

/**
 * 压缩文件，但是不修改文件名 (自动忽略已经压缩的文件)
 * @param options
 */
module.exports = function(options){
    var uglifyOptions = _.extend({}, options || {}, {
        fromString: true
    });

    return through.obj(function(file, encoding, callback){
        if (!file || file.isNull()){
            return callback(null, file);
        }

        if (/min\.js$/.test(file.path)){
            return callback(null, file);
        }

        if (file.isBuffer()){
            var res = uglifyJs.minify(file.contents.toString(), uglifyOptions);
            if (res && res.code){
                file.contents = new Buffer(res.code);
            } else {
                gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to minify file! file=" + file.path));
            }
            return callback(null, file);
        } else if (file.isStream()){
            readStreamToEnd(file.contents).then(function(data){
                var res = uglifyJs.minify(data.toString(), uglifyOptions);
                if (res && res.code){
                    file.contents = new streamBuffers.ReadableStreamBuffer({
                        frequency: 10,
                        chunkSize: 4096,
                    });

                    file.contents.put(res.code, 'utf8');
                    file.contents.stop();
                } else {
                    gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to minify file! file=" + file.path));
                }

                return callback(null, file);
            }, function(err){
                gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to minify file! file=" + file.path + ' error: ' + err));
                return callback(err, file);
            });

            return null;
        } else {
            gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Invalid file type! file=" + file.path));
            return callback(null, file);
        }
    })
};

