var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var _ = require('lodash');
var streamBuffers = require('stream-buffers');
var fs = require('fs');
var Promise = require('promise');

var readStreamToEnd = require('./read-stream-to-end');
var combine = require('./combine.js');

var PLUGIN_NAME = 'raw-include';

/**
 * 替换包含的内容
 */
module.exports = function (options) {
    options = _.extend({
        // include指令的正则表达式，要求第1个分组应该是文件名
        // 注意1：如果raw-include是在uglify/minify之后进行的，请保证源文件中的include语句不会被压缩，否则会无法识别而无法替换
        //       -- 建议uglify的时候加上reserved参数：uglifyjs --reserved 'include' -o test-min.js test.js
        // 注意2：默认的正则表达式比较弱 -- 如果注释中也有include语句则也会被匹配替换，所以建议先去注释再用raw-include
        // 注意3: 匹配到的文件名必须是字面常量，不能含"+"等其他任何操作，不要有转义字符
        regex: /\$include\(\s*['"](.+?)['"]\s*\)/g,
        basePath: '', // 基础路径
        paths: {}, // 路径映射表
        wrapIIFE: true, // 是否包裹一个IIFE语句以成为一个独立的表达式
        recursive: false, // 是否递归处理
        // 如何解析文件路径
        resolveFilePath: function (fileName) {
            if (fileName in options.paths){
                fileName = options.paths[fileName];
            }

            return path.resolve(options.basePath, fileName + (path.extname(fileName) ? '' : '.js')); // 自动追加后缀名
        },
        // 如何解析文件内容
        resolveFileContent: function (file) {
            return new Promise(function (resolve, reject) {
                fs.readFile(file.path, 'utf8', function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
        }
    }, options);

    // 一个处理文件的自定义函数
    function doDealFileContents(content) {
        //console.log(PLUGIN_NAME + ': dealing file contents....');
        var fileNames = [], matches;

        while ((matches = options.regex.exec(content)) !== null) {
            fileNames.push(matches[1]);
        }

        if (fileNames.length <= 0) {
            return Promise.resolve(content);
        }

        return Promise.all(fileNames.map(function (fileName) {
            //console.log(PLUGIN_NAME + ': resolve file contents of ' + fileName);
            var resolving = options.resolveFileContent({
                base: options.basePath,
                name: fileName,
                path: options.resolveFilePath(fileName)
            });

            if (options.recursive){
                return resolving.then(function(fileContent){
                    return doDealFileContents(fileContent);
                });
            } else {
                return resolving;
            }
        })).then(function (fileContents) {
            //console.log(PLUGIN_NAME + ': replacing file contents of ' + fileNames);

            var mapFileNameToContents = combine(fileNames, fileContents);

            return content.replace(options.regex, function (whole, fileName) {
                if (options.wrapIIFE){
                    return "\n//include " + fileName + ":\n(function(){\n" + mapFileNameToContents[fileName] + "\n})()\n";
                } else {
                    return mapFileNameToContents[fileName];
                }
            });
        });
    }

    // 一个处理文件的基本框架
    return through.obj(function (file, encoding, callback) {
        var dealing;

        if (!file || file.isNull()) {
            return callback(null, file);
        }

        // 判断是否只匹配某些文件
        if (options.only && !options.only.test(file.path)) {
            return callback(null, file);
        }

        // 判断是否排除某些文件
        if (options.except && options.except.test(file.path)) {
            return callback(null, file);
        }


        if (file.isStream()) {
            dealing = readStreamToEnd(file.contents)
                .then(function (data) {
                    return doDealFileContents(data.toString());
                });
        } else {
            dealing = doDealFileContents(file.contents.toString());
        }

        dealing.then(function (dealtContents) {
            if (file.isStream()) {
                file.contents = new streamBuffers.ReadableStreamBuffer({
                    frequency: 10,
                    chunkSize: 4096
                });

                file.contents.put(dealtContents, 'utf8');
                file.contents.stop();
            } else {
                file.contents = new Buffer(dealtContents);
            }

            return callback(null, file);
        }, function (err) {
            console.log(PLUGIN_NAME + ': error: ', err);
            gutil.emit('error', new gutil.PluginError(PLUGIN_NAME, "Failed to deal file! file=" + file.path));
            callback(err);
        });
    });
};

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
