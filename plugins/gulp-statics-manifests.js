var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var child_process = require('child_process');
var request = require('request');
var _ = require('lodash');
var fs = require('fs');

var pfs = require('./promise-fs');

// 默认全局的manifest
var defaultStaticsManifests = {};

module.exports = {
    get: function(file, manifests){
        if (typeof manifests === 'undefined'){
            manifests = defaultStaticsManifests;
        }

        return manifests[file.replace(/\\/g, '/')];
    },
    set: function(file, hash, manifests){
        if (typeof manifests === 'undefined'){
            manifests = defaultStaticsManifests;
        }

        manifests[file.replace(/\\/g, '/')] = hash;
    },
    getDefaultManifests: function(){
        return defaultStaticsManifests;
    },
    gather: gatherStaticsManifests,
    save: saveStaticsManifests,
    load: loadStaticsManifests,
    reset: resetStaticsManifests,
    empty: resetStaticsManifests
};


/**
 * 收集hash的插件  -- 默认hash存放在文件名中： file_xxxx.js 这样的形式。
 * @param options 收集hash保存到哪个map中
 */
function gatherStaticsManifests(options) {
    options = _.extend({
        to: defaultStaticsManifests,
        ignoreFilePatterns: null, // 排除某些文件 -- 通过正则表达式
        ignoreFileTypes: ['.map', '.js.map'], // 排除某些文件 -- 通过后缀名
        addPathPrefix: '', // 文件名的前缀
    }, options);

    if (!options.to) {
        console.error("Invalid parameter <options.to>! It must be a valid object");
    }

    var hashRegex = /_([a-zA-Z0-9]+)\./;
    var manifests = options.to;
    var PLUGIN_NAME = 'statics-manifest:gather';

    return through.obj(function (file, encoding, callback) {
        if (file.isNull()) {
            // nothing to do
            return callback(null, file);
        }

        //gutil.log(PLUGIN_NAME + " called! File.path=", file.path);
        var relativePath = path.relative(file.base, file.path);
        var m = relativePath.match(hashRegex);
        if (!m) {
            this.emit('error', new gutil.PluginError(PLUGIN_NAME, "cannot resolve the hash from " + file.path));
            return callback(null, file);
        }

        var hash = m[1];
        var urlPath = relativePath.replace(m[0].substring(0, m[0].length - 1), '').replace(/\\/g, '/');
        var fileType = path.extname(file.path).toLowerCase();

        // 只有不需要忽略的文件类型才需要收集hash信息
        if (options.ignoreFileTypes.indexOf(fileType) < 0
            && !(options.ignoreFilePatterns && options.ignoreFilePatterns.test(file.path))) {
            manifests[options.addPathPrefix + urlPath] = hash;
        }

        return callback(null, file);
    });
}

/**
 * 加载manifest文件
 * @param options
 * @returns {Promise|Object}
 */
function loadStaticsManifests(options)
{
    options = _.extend({
        to: defaultStaticsManifests,
        fromDir: '',
        async: true
    }, options || {});

    if (!options.fromDir){
        throw new Error("You must specify fromDir!");
    }

    var manifestFile = path.resolve(options.fromDir, 'manifest.json');

    if (options.async){
        return pfs.readFile(manifestFile + '', 'utf8')
            .then(function(data){
                return data;
            }, function(err){
                // 忽略不存在的文件
                if (err.code === 'ENOENT') {
                    return '{}';
                } else {
                    throw err;
                }
            })
            .then(function(data){
                var manifestData = {};

                try {
                    manifestData = JSON.parse(data) || {};
                } catch (e) {
                    console.log("Warning: failed to parse manifest data. Empty object assumed.");
                }

                return manifestData;
            })
            .then(function(data){
                return _.extend(options.to, data || {});
            });
    } else {
        var loadedData = {};

        try {
            loadedData = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        } catch (e) {
            console.log("Warning: failed to parse manifest data. Empty object assumed.");
            console.log(e);
        }

        return _.extend(options.to, loadedData || {});
    }
}

/**
 * 保存到当前工程
 * @param newManifests
 * @param destDir
 * @returns {*}
 */
function saveStaticsManifestsToThisProject(newManifests, destDir){
    var manifestFile = path.resolve(destDir, 'manifest.json');
    var manifestJsonpFile = path.resolve(destDir, 'manifest.js');

    return pfs.readFile(manifestFile + '', 'utf8')
        .then(function(data){
            return data;
        }, function(err){
            // 忽略不存在的文件
            if (err.code === 'ENOENT') {
                return '{}';
            } else {
                throw err;
            }
        })
        .then(function(data){
            var manifestData = {};

            try {
                manifestData = JSON.parse(data) || {};
            } catch (e) {
                console.log("Warning: failed to parse old manifest data. Empty object assumed.");
            }

            _.each(newManifests, function(hash, file){
                manifestData[file] = hash;
            });

            return JSON.stringify(manifestData, null, ' ');
        })
        .then(function(manifestText){
            // 除了保存一份json的，顺便保存一份jsonp版本的，方便跨域查询
            var manifestJsonpCode = 'window.manifestJsonpCallback && window.manifestJsonpCallback(' + manifestText + ');';

            return Promise.all([
                pfs.writeFile(manifestFile, manifestText, 'utf8'),
                pfs.writeFile(manifestJsonpFile, manifestJsonpCode, 'utf8')
            ])
        });
}

/**
 * 通知动态服务器manifests有更新
 * @param manifests
 * @param options {*}
 * @return {Promise}
 */
function notifyDynamicAboutManifests(manifests, options) {
    options = _.extend({
        apiType: process.env.UPDATE_STATICS_MAP_API_TYPE,
        apiUrl: process.env.UPDATE_STATICS_MAP_API_URL,
        apiKey: process.env.UPDATE_STATICS_MAP_API_KEY,
        apiShellCmd: process.env.UPDATE_STATICS_MAP_SHELL_CMD,
        apiShellCwd: process.env.UPDATE_STATICS_MAP_SHELL_CWD,
        timeout: 30 * 1000, // ms
        oldManifests: null,
    }, options || {});

    if (Object.keys(manifests).length <= 0){
        gutil.log("No files updated.");
        return Promise.resolve();
    }

    gutil.log("Updated files: " + formatUpdatedFilesManifests(diffObjectPreserveKey(manifests, options.oldManifests || {})));

    if (options.apiType === 'shell') {
        return new Promise(function(resolve, reject){
            var manifestJsonFile = path.resolve(options.destDir, 'manifest.json');
            var cmd = options.apiShellCmd;

            gutil.log('> ' + cmd);

            var apiCall = child_process.exec(cmd, {
                cwd: options.apiShellCwd,
                timeout: options.timeout,
                shell: true,
            }, function(error, stdout, stderr){
                if (error !== null){
                    gutil.log("Finished update manifest with error: ", error, " StdOut: ", stdout, " StdErr: ", stderr);
                    return reject(error);
                } else {
                    gutil.log("Finished update manifest successfully. StdOut: ", stdout, " StdErr: ", stderr);
                    return resolve(stdout);
                }
            });

            gutil.log('--> pid: ' + apiCall.pid);

            // 如果有stdin, 一定要关闭stdin, 否则会卡住
            if (apiCall.stdin){
                apiCall.stdin.end(JSON.stringify(manifests));
            }
        });
    } else if (options.apiType === 'http') {
        return new Promise(function(resolve, reject){
            request({
                method: 'POST',
                url: options.apiUrl,
                headers: {
                    'X-API-Key': options.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': '*/json,*/*',
                },
                body: JSON.stringify(manifests)
            }, function(error, response, body){
                if (error){
                    gutil.log("Finished update statics manifest with error: ", error, " response-body: ", body);
                    return reject(error);
                } else {
                    try{
                        var responseData = JSON.parse(body);
                        if (responseData.success){
                            gutil.log("Finished update manifest successfully. response-body: ", body);
                            return resolve(responseData);
                        } else {
                            error = new Error(responseData.message);
                            gutil.log("Finished update manifest with internal error: ", error, " response-body: ", body);
                            return reject(error);
                        }
                    } catch (e){
                        error = e;
                        gutil.log("Finished update manifest with data format error: ", error, " response-body: ", body);
                        return reject(error);
                    }
                }
            });
        });
    } else {
        gutil.log("Warning: Invalid API TYPE for statics manifest! Type=" + options.apiType);
    }
}

/**
 * 保存静态资源的维护信息
 * @param options {*}
 * @param done {function}
 */
function saveStaticsManifests(options, done) {
    if (arguments.length === 1){
        options = {data: defaultStaticsManifests};
        done = arguments[0];
    } else if (arguments.length === 2){
        options = _.extend({data: defaultStaticsManifests}, options || {});
        //done = done;
    } else {
        throw new Error("Invalid arguments! You can use one of these forms: (done), or (options, done)");
    }

    if (!options.destDir){
        throw new Error("You must specify a destDir in options.");
    }

    return saveStaticsManifestsToThisProject(options.data, options.destDir)
        .then(function(){
            return notifyDynamicAboutManifests(options.data, options);
        })
        .then(done.bind(null, null), done);
}

function formatUpdatedFilesManifests(files){
    var type = typeof files;
    if (type === 'undefined'){
        return 'undefined';
    } else if (type === 'object' && files === null){
        return 'null';
    }

    var output = [];
    var filesCount = 0;

    for (var file in files){
        if (!files.hasOwnProperty(file)){
            continue;
        }

        output.push('    ' + file + ': ' + files[file]);
        filesCount++;
    }

    output.unshift(filesCount + " files updated:");

    return output.join("\n");
}

/**
 * 重置manifest
 */
function resetStaticsManifests(manifests){
    if (typeof manifests === 'undefined'){
        manifests = defaultStaticsManifests;
    }

    for (var k in manifests){
        if (manifests.hasOwnProperty(k)){
            delete manifests[k];
        }
    }
}

function diffObjectPreserveKey(a, b) {
    var ret = [];

    for (var k in a){
        if (a.hasOwnProperty(k) && a[k] !== b[k]){
            ret[k] = a[k];
        }
    }

    return ret;
}
