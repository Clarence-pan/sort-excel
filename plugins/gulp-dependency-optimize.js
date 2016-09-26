var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var _ = require('lodash');
var fs = require('fs');
var glob = require('glob');

// 默认的依赖
var defaultDepends = [];

module.exports = dependencyOptimize;
module.exports.cleanCache = function(data) {
    if (data && data.file){
        delete mTimeCache[path.resolve(data.file)];
    } else {
        mTimeCache = {};
    }
};

/**
 * 设置默认的依赖
 * @param dependsPatterns {Array<string>|string}
 */
module.exports.setDefaultDepends = function(dependsPatterns){
    if (typeof dependsPatterns === 'string'){
        dependsPatterns = [dependsPatterns];
    }

    defaultDepends = _.flatMap(dependsPatterns, function(parttern){
        return glob(parttern, {sync: true});
    });
};

/**
 * 获取默认的依赖
 * @returns {Array}
 */
module.exports.getDefaultDepends = function(){
    return defaultDepends;
};



/**
 * 基于依赖关系进行优化gulp的构建速度 -- 像make一样，只对有改动的源代码进行构建。
 */

function dependencyOptimize(options){
    options = _.extend({
        // 构建后的目标文件，返回一个或多个文件的全路径或相对路径
        dest: function(file){
            throw new Error("dest file must be specified if you wanna to optimize!");
        },
        // 依赖文件，返回一个或多个文件
        depends: function(file){
            return [file.path];
        }
    }, options || {});

    var PLUGIN_NAME = 'dependency-optimize';

    return through.obj(function(file, encoding, callback){
        var self = this;

        //return callback(null, file);
        if (!file || file.isNull()){
            return callback(null, file);
        }

        var f = {};

        f.path = path.resolve(file.path);
        if (!f.path){
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, "Invalid file path: " + f.path));
            return callback();
        }

        f.cwd = path.resolve(file.cwd);
        if (!f.cwd){
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, "Invalid file cwd: " + f.cwd));
            return callback();
        }

        f.base = path.resolve(file.base);
        if (!f.base){
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, "Invalid file base: " + f.base));
            return callback();
        }

        f.relativePath = path.relative(f.base, f.path);
        f.named = file.named;

        var dests = strAsArray(options.dest(f));
        var depends = strAsArray(options.depends(f)).concat(defaultDepends || []);

        if (_.isEmpty(dests) || _.isEmpty(depends)){
            return callback(null, file);
        }

        getMaxFileMTime(dests, function(destFileMTime){
            isAnyNewerThan(destFileMTime, depends, function(newer){
                if (newer){
                    if (process.env.DEBUG){
                        gutil.log("["+ path.relative(file.base, file.path) + "] One or more depends are newer. Continue..." + dumpDestsDepends(dests, depends));
                    } else {
                        gutil.log("updating " + path.relative(file.base, file.path));
                    }
                    self.push(file);
                } else {
                    if (process.env.DEBUG) {
                        gutil.log("["+ path.relative(file.base, file.path) + "] All depends are older. Ignored." + dumpDestsDepends(dests, depends));
                    }
                }

                callback();
            });
        });
    });
}

function dumpDestsDepends(dests, depends)
{
    if (!process.env.DEBUG){
        return '';
    }

    return [
        "\n    dest: [ ",
        dests.join(  ",\n        "),
        " ], ",
        "\n    depends: [ ",
        depends.join(",\n        "),
        " ]",
    ].join('');
}

function strAsArray(x)
{
    return typeof(x) === 'string' ? [x] : x;
}

function getMinFileMTime(files, callback)
{
    if (!files || !files.length){
        callback(0);
    }

    var filesCount = files.length;
    var gotCnt = 0;
    var minTime = Number.MAX_VALUE;

    for (var i = 0; i < filesCount; i++) {
        getFileMTime(files[i], function(time){
            gotCnt++;
            if (time < minTime) {
                minTime = time;
            }

            if (gotCnt >= filesCount){
                callback(minTime);
            }
        });
    }
}

function getMaxFileMTime(files, callback)
{
    if (!files || !files.length){
        callback(0);
    }

    var filesCount = files.length;
    var gotCnt = 0;
    var maxTime = 0;

    for (var i = 0; i < filesCount; i++) {
        getFileMTime(files[i], function(time){
            gotCnt++;
            if (time > maxTime) {
                maxTime = time;
            }

            if (gotCnt >= filesCount){
                callback(maxTime);
            }
        });
    }
}

function isAnyNewerThan(time, files, callback)
{
    if (time <= 0){
        callback(true);
        return;
    }

    if (!files || !files.length){
        callback(false);
        return;
    }

    var filesCount = files.length;
    var gotCnt = 0;
    var isCalled = false;

    for (var i = 0; i < filesCount; i++) {
        getFileMTime(files[i], function(t){
            if (isCalled){
                return;
            }

            gotCnt++;
            if (t > time){
                isCalled = true;
                callback(true);
                return ;
            }

            if (gotCnt >= filesCount){
                isCalled = true;
                callback(false);
            }
        });
    }

}

// 保存文件修改时间的缓存
// 文件绝对路径 ==> 修改时间的时间戳
var mTimeCache = {};

function getFileMTime(file, callback, timeout){
    if (!file){
        callback(0);
        return;
    }

    if (file in mTimeCache){
        callback(mTimeCache[file]);
        return;
    }

    file = path.resolve(file);
    if (file in mTimeCache){
        callback(mTimeCache[file]);
        return;
    }

    timeout = timeout || 1000;

    var isCalled = false;
    var timer = setTimeout(function(){
        if (!isCalled){
            isCalled = true;
            callback(0);
        }
    }, timeout);

    fs.stat(file, function(err, stat){
        if (!isCalled){
            isCalled = true;
            clearTimeout(timer);

            var mtime = stat ? +stat.mtime : 0;
            if (mtime){
                mTimeCache[file] = mtime;
                callback(mtime);
            } else {
                callback(0);
            }
        }
    });
}

