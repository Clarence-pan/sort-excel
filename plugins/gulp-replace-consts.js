var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var _ = require('lodash');
var streamBuffers = require('stream-buffers');
var readStreamToEnd = require('./read-stream-to-end');

/**
 * 替换常量
 */
function replaceConsts(options) {
    options = _.extend({
        base: null, // 基础路径
        only: null, // 只匹配哪些文件 -- 用正则表达式匹配文件路径
        except: null, // 排除哪些文件 -- 正则表达式匹配文件路径
        consts: function(file) {
            var filePath = path.resolve(file.srcPath || file.path);
            var fileDir = path.dirname(filePath);
            var baseDir = options.base || path.resolve(file.base);
            var relativePath = path.relative(baseDir, filePath);
            var relativeDir = path.dirname(relativePath);
            var named = file.named;

            return {
                __FILE__: JSON.stringify(filePath),
                __DIR__: JSON.stringify(fileDir),
                __BASE_DIR__: JSON.stringify(baseDir),
                __RELATIVE_PATH__: JSON.stringify(relativePath),
                __RELATIVE_DIR__: JSON.stringify(relativeDir),
                __NAMED__: JSON.stringify(named),
                __DEBUG__: JSON.stringify(process.env.DEBUG)
            };
        },
        extraConsts: function(){}
    }, options);


    var PLUGIN_NAME = 'replace-consts';

    return through.obj(function(file, encoding, callback) {
        var self = this;

        if (!file || file.isNull()) {
            return callback(null, file);
        }

        // 判断是否只匹配某些文件
        if (options.only && !options.only.test(file.path)){
            return callback(null, file);
        }

        // 判断是否排除某些文件
        if (options.except && options.except.test(file.path)){
            return callback(null, file);
        }

        var consts = _.extend(options.consts(file), options.extraConsts(file));

        if (file.isStream()){
            readStreamToEnd(file.contents).then(function(data){
                var res =  replaceConstsOfString(data.toString(), consts);
                file.contents = new streamBuffers.ReadableStreamBuffer({
                    frequency: 10,
                    chunkSize: 4096,
                });

                file.contents.put(res, 'utf8');
                file.contents.stop();

                return callback(null, file);
            }, function(err){
                gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to replace consts in file! file=" + file.path + ' error: ' + err));
                return callback(err, file);
            });

            return null;
        }

        file.contents = new Buffer(replaceConstsOfString(file.contents.toString(), consts));

        return callback(null, file);
    });

}

function replaceConstsOfString(str, consts){
    return str.replace(/__[0-9a-zA-Z_]+__/g, function(x){
        return ((x in consts) && (consts.hasOwnProperty(x)) && (typeof consts[x] === 'string')) ? consts[x] : x;
    });
}

module.exports = replaceConsts;


function dir(obj, onlyOwned) {
    if (obj === null) {
        return '<null>';
    } else if (typeof obj === 'undefined') {
        return '<undefined>';
    }

    var keys = {};
    for (var k in obj) {
        if (!obj.hasOwnProperty(k) && onlyOwned) {
            continue;
        }

        var v = obj[k];
        if (typeof v === 'function') {
            keys[k] = '<function>';
        } else if (typeof v === 'object') {
            keys[k] = '<object>';
        } else {
            keys[k] = v;
        }
    }

    return keys;
}
