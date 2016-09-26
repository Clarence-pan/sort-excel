var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var _ = require('lodash');

var readStreamToEnd = require('./read-stream-to-end');

var PLUGIN_NAME = 'stream-to-buffer';

/**
 * 将gulp中的stream文件全都转换为buffer文件
 */
module.exports = function (options) {
    options = _.extend({
        filterNull: true,
        filterUnknown: true,
    }, options || {});

    return through.obj(function (file, encoding, callback) {
        if (!file || file.isNull()) {
            if (options.filterNull){
                return callback();
            } else {
                return callback(null, file);
            }
        }

        if (file.isStream()) {
            readStreamToEnd(file.contents)
                .then(function (fileContents) {
                    console.log('[' + PLUGIN_NAME + '] converted from stream to buffer: ' + file.path);
                    file.contents = new Buffer(fileContents);
                    return callback(null, file);
                }, function (err) {
                    console.log(PLUGIN_NAME + ': error: ', err);
                    gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to deal file! file=" + file.path));
                    callback(err);
                });
        } else if (file.isBuffer()) {
            return callback(null, file);
        } else {
            if (options.filterUnknown){
                return callback();
            } else {
                return callback(null, file);
            }
        }
    });
};
