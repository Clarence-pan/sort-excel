// 加载process.env
require('dotenv').load() || (console.error('Abort due to failed to load .env'), process.exit(1));

// 加载库模块
var gulp = require('gulp');
var runSequence = require('run-sequence');

// 加载客户端构建的gulp配置文件
require('./gulpfile.client.js');

// 加载服务端构建的gulp配置文件
require('./gulpfile.server.js');


// 默认启动的任务
gulp.task('default', function (done) {
    return runSequence(['build-client-all', 'build-server'], done);
});


gulp.task('build', function (done) {
    return runSequence(['build-client-all', 'build-server'], done);
});


gulp.task('rebuild', function (done) {
    return runSequence(['rebuild-client', 'rebuild-server'], done);
});


gulp.task('watch', function (done) {
    return runSequence('watch-client', done);
});

