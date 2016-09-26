var path = require('path');
var webpack = require('webpack');
var fs = require('fs');
var glob = require('glob');
var _ = require('underscore');
var Es3ifyPlugin = require('es3ify-webpack-plugin');

// 基本目录
var src_dir = path.resolve(__dirname, 'src');
var dist_dir = path.resolve(__dirname, 'public/dist');
var public_dir = path.resolve(__dirname, 'public');
var node_modules_dir = path.resolve(__dirname, 'node_modules');

//// 单独的每个页面的入口文件
//var individualEntries = (function () {
//    var entries = {};
//
//    resolveEntries('index.js');
//    resolveEntries('index.jsx');
//    resolveEntries('index.ts');
//    resolveEntries('index.tsx');
//
//    return entries;
//
//    function resolveEntries(entryName) {
//        var entriesFiles = glob(path.join(src_dir, '**/' + entryName), {sync: true});
//        entriesFiles.forEach(function (entry) {
//            var targetFile = path.dirname(entry.substring(src_dir.length + 1));
//            entries[targetFile] = entry;
//        });
//    }
//})();

if (!/gulp/.test(process.argv.join(' '))){
    console.log("Error: this webpack should be run via gulp!");
    process.exit(1);
}

// 生成webpack的配置
module.exports = {
    devtool: "source-map",
    //entry: individualEntries,

    // 有两种方式很方便地导入外部库：
    // 1. 使用alias映射到本地文件 -- 最终可以通过CommonsChunkPlugin合并到vendors.js中
    resolve: {
        alias: {
            //'common': path.resolve(src_dir, 'common/common.js'),
            //'jquery': path.resolve(public_dir, 'lib/jquery.js'),
            //'underscore': path.resolve(public_dir, 'lib/underscore.js'),
        },
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js", ".jsx"]
    },
    // 2. 通过externals导入外部的全局变量：
    externals: {
        // 从window变量中导入的外部变量:
        'jquery': 'window.jQuery',
        'underscore': 'window._',
        'common': 'window.Common',
        'app/common': 'window.Common',
        'requirejs': 'window.require',
        'amd-require': 'window.require',
        'amd-define': 'window.define',
        'react': 'window.React',
        'react-dom': 'window.ReactDOM',
        'promise': 'window.Promise',
    },
    output: {
        path: dist_dir,
        filename: '[name]_[hash].js'
    },
    module: {
        preLoaders: [
            {test: /\.js$/, loader: "source-map-loader"},
        ],
        loaders: [
            { test: /\.(js|ts)$/, loader: 'babel' },
            { test: /\.jsx$/, loader: 'babel?presets=react' },
            { test: /\.tsx$/, loader: 'ts-loader' },
            { test: /\.jade$/, loader: 'jade' },
            { test: /\.json$/, loader: 'json' },
            { test: /\.yaml$/, loader: 'json!yaml' },
            { test: /\.png$/, loader: 'url-loader?mimetype=image/png' },
            { test: /\.jpg$/, loader: 'url-loader?mimetype=image/jpg' },
            { test: /\.gif$/, loader: 'url-loader?mimetype=image/gif' },
            { test: /\.css$/, loader: 'style!css' },
            { test: /\.less$/, loader: 'style!css!less' },
        ]
    },
    plugins: [
        process.env.MINIFY_SRC && new webpack.optimize.UglifyJsPlugin({
            compress: { warnings: false },
            output: { comments: false }
        }),
        new Es3ifyPlugin(),
    ].filter(function(x){ return !!x; })
};

//console.log(module.exports);
