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

var DIST_DIR = './server/packed';
var SRC_DIR = './server';
var SRC_FILE = './server/index.js';

// 通过webpack构建server入口
gulp.task('build-server-webpack', function () {
    var config = require('./webpack.config.js');

    config = _.extend({}, config, {externals: {}, output: {path: path.resolve(DIST_DIR), filename: 'index.js'}});

    return gulp.src(SRC_FILE, {base: SRC_DIR})
        .pipe(named())
        .pipe(optimize({
            dest: function (file) {
                return [path.resolve(DIST_DIR, file.named + '.js')];
            },
            depends: function (file) {
                return cache.get("webpack_depends_of_" + file.path) || [];
            }
        }))
        .pipe(webpackIndividuals(config, null, function (err, stats, file) {
            if (err || !stats || !file) {
                return;
            }

            cache.set("webpack_depends_of_" + file.path, unique([file.path].concat(stats.compilation.fileDependencies)));
        }))
        .pipe(gulp.dest(DIST_DIR));
});

gulp.task('build-server', function(done){
    runSequence('build-server-webpack', done);
});

gulp.task('clean-server', function(){
    return del([
        DIST_DIR + '/**/*'
    ]);
});

gulp.task('rebuild-server', function(done){
    runSequence('clean-server', 'build-server-webpack', done);
});

