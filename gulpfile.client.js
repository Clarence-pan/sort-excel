// 加载库模块
var gulp = require('gulp');
var runSequence = require('run-sequence');
var minify = require('gulp-minify');
var cleanCss = require('gulp-clean-css');
var rename = require('gulp-rename');
var concat = require('gulp-concat');
var gutil = require('gulp-util');
var del = require('del');
var named = require('vinyl-named');
var _ = require('lodash');
var path = require('path');
var md5 = require('gulp-md5');
var glob = require('glob');
var unique = require('array-unique');
var fs = require('fs');
var Promise = require('promise');

// 加载自定义模块
var webpackIndividuals = require('./plugins/gulp-webpack-individuals');
var staticsManifests = require('./plugins/gulp-statics-manifests');
var optimize = require('./plugins/gulp-dependency-optimize');
var replaceConsts = require('./plugins/gulp-replace-consts');

var sourceConsts = require('./plugins/define-source-consts');
var SimpleFileCache = require('./plugins/simple-file-cache');

// 构建系统的文件
var buildSystemFiles = [
    './.env',
    './*.js',
    './*.json',
    './plugins/*.*'
];

// 默认依赖关系：
optimize.setDefaultDepends(buildSystemFiles);

// 文件缓存
var cache = SimpleFileCache.instance({file: path.resolve('./storage/simple-cache.json')});

// 主要内容的目录
var SRC_DIR = './client/src';

// 构建完成的目录
var DIST_DIR = './client/public/dist';

// 维护文件的目录
var MANIFEST_DIR = './client/public';

var oldManifests = _.clone(staticsManifests.load({fromDir: MANIFEST_DIR, async: false}));

var sourceScripts = [
    './client/src/**/index.js',
    './client/src/**/index.jsx',
    './client/src/**/index.ts',
    './client/src/**/index.tsx',
];

var sourceCssFiles = [
    './client/src/**/index.css'
];

// 通过webpack构建src目录下东东
gulp.task('build-client-src-webpack', function () {
    var config = require('./webpack.config.js');
    return gulp.src(sourceScripts, {base: SRC_DIR})
        .pipe(named(function (file) {
            file.baseDir = path.resolve(file.base);
            file.destPath = path.resolve(path.dirname(file.path) + path.extname(file.path));
            file.destName = path.relative(file.baseDir, file.destPath).replace(/\.\w+$/, '');
            return file.destName;
        }))
        .pipe(optimize({
            dest: function (file) {
                return [path.resolve(DIST_DIR, file.named + '_' + staticsManifests.get(file.named + '.js') + '.js')];
            },
            depends: function (file) {
                var depends = cache.get("webpack_depends_of_" + file.path);
                return depends ? depends : [];
            }
        }))
        .pipe(webpackIndividuals(config, null, function (err, stats, file) {
            if (err || !stats || !file) {
                return;
            }

            cache.set("webpack_depends_of_" + file.path, unique([file.path].concat(stats.compilation.fileDependencies)));
        }))
        .pipe(replaceConsts({
            only: /\.js$/,
            extraConsts: function(){
                return sourceConsts;
            }
        }))
        .pipe(gulp.dest(DIST_DIR))
        .pipe(staticsManifests.gather());
});

// css单独构建
gulp.task('build-client-css-files', function () {
    return gulp
        .src(sourceCssFiles, {base: SRC_DIR})
        .pipe(named(function (file) {
            file.baseDir = path.resolve(file.base);
            file.destPath = path.resolve(path.dirname(file.path) + path.extname(file.path));
            file.destName = path.relative(file.baseDir, file.destPath).replace(/\.\w+$/, '');
            return file.destName;
        }))
        .pipe(optimize({
            dest: function (file) {
                return [path.resolve(DIST_DIR, file.named + '_' + staticsManifests.get(file.named + '.css') + '.css')];
            },
            depends: function (file) {
                return [file.path];
            }
        }))
        .pipe(cleanCss({compatibility: 'ie8'}))
        .pipe(rename(function (file) {
            // remove duplicated "/index"
            // rename "product/detail/index.css" to "product/detail.css"
            var fileDirName = file.dirname;
            file.dirname = path.dirname(fileDirName);
            file.basename = path.basename(fileDirName);
        }))
        .pipe(md5(20))
        .pipe(gulp.dest(DIST_DIR))
        .pipe(staticsManifests.gather());
});

// 构建完成后保存manifest信息
gulp.task('save-client-manifest', function (done) {
    staticsManifests.save({
        destDir: MANIFEST_DIR,
        oldManifests: oldManifests
    }, function (error) {
        done(error);
    });
});

// 保存缓存的内容
gulp.task('save-client-caches', function (done) {
    cache.save(function (error) {
        done(error);
    });
});

// 构建任务
gulp.task('build-client', function (done) {
    return runSequence(
        ['build-client-src-webpack', 'build-client-css-files'],
        ['save-client-caches', 'save-client-manifest'],
        done);
});

var SIGNAL_WATCH_WORKER_RESTART = 99;

// 监听文件改动的处理 -- 使用子进程以便有更好的容错性并能正确地处理构建系统的更新
gulp.task('watch-client', function () {
    var child_process = require('child_process');
    return new Promise(function(resolve, reject){
        return startWorker();

        function startWorker(){

            // 假定PATH中已经存在了gulp...
            var workerSpawnOptions = {
                stdio: 'inherit',
                env: _.extend(process.env, require('dotenv').load() || {}), // 重新加载下环境变量否则老是不变会出问题的
                shell: true
            };
            var worker = child_process.spawn('gulp', ['watch-client-worker'], workerSpawnOptions);
            if (!worker){
                return reject("Error: Cannot start gulp watch-worker!");
            }

            // 子进程使用了继承stdio，不需要再单独处理stdio即可。

            worker.on('exit', function(code){
                if (parseInt(code) === SIGNAL_WATCH_WORKER_RESTART){
                    console.log("Worker requested restart. So restart it: ");
                    startWorker();
                } else {
                    console.log("Worker quit with code: " + code + ". There may be something wrong. Let's restart it:");
                    startWorker();
                }
            });
        }
    });
});

// 监听文件改动的工作进程
gulp.task('watch-client-worker', function(){
    TaskQueue = require('./plugins/task-queue');

    // 使用工作队列来保证顺序，并且允许合并队列
    var taskQueue = new TaskQueue({
        timeout: 30 * 1000, //ms
        execute: function(task, done){
            runSequence(task, done);
        }
    });

    gutil.log('-----------------------------------------------');
    gutil.log('begin watching...');

    gulp.watch(['./src/**/*', './typings/**/*'], runTask('build-client'));
    gulp.watch(['./lib/**/*'], runTask('build-client-lib'));
    gulp.watch(buildSystemFiles, runTask('restart-watch-client'));

    taskQueue.enqueue('build-client-lib');
    taskQueue.enqueue('build-client');

    taskQueue.run();

    // 为了让进程不要退出，返回个永远不会结束的promise...
    return new Promise(function () {});

    // 执行任务的工厂方法
    function runTask(task){
        return function (event) {
            console.log('File ' + event.path + ' was ' + event.type + ', running ' + task +' task...');

            // 更新manifests
            oldManifests = _.clone(staticsManifests.getDefaultManifests());

            // 清理缓存
            optimize.cleanCache({file: event.path});

            // 开始构建
            taskQueue.enqueue(task);
        };
    }
});

// 重启监听
gulp.task('restart-client-watch', function(){
    process.exit(SIGNAL_WATCH_WORKER_RESTART);
});


// 清理构建后的文件
gulp.task('clean-client', function () {
    return del([
        'public/dist/**/*',
    ]);
});


// 重新构建
gulp.task('rebuild-client', function (done) {
    return runSequence('clean-client', 'build-client', done);
});

// 引入lib的构建配置
require('./gulpfile.client.lib.js');

// 全部构建
gulp.task('build-client-all', function(done){
    return runSequence(['build-client', 'build-client-lib'], done);
});

// 重新构建
gulp.task('rebuild-client-all', function (done) {
    return runSequence(['rebuild-client', 'rebuild-client-lib'], done);
});

