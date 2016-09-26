var path = require('path');
var webpack = require('webpack');
var fs = require('fs');
var glob = require('glob');
var _ = require('underscore');
var Es3ifyPlugin = require('es3ify-webpack-plugin');

// 基本目录
var src_dir = path.resolve(__dirname, 'src');
var dist_dir = path.resolve(__dirname, '../public/lib');
var public_dir = path.resolve(__dirname, '../public');
var node_modules_dir = path.resolve(__dirname, '../node_modules');


// 生成webpack的配置
module.exports = {
    devtool: "source-map",
    entry: null, // 入口定义在外面

    // 有两种方式很方便地导入外部库：
    // 1. 使用alias映射到本地文件 -- 最终可以通过CommonsChunkPlugin合并到vendors.js中
    resolve: {
        alias: {
            //'jquery': path.resolve(node_modules_dir, 'jquery/jquery.js'),
            //'common': path.resolve(src_dir, 'common/common.js'),
            //'underscore': path.resolve(public_dir, 'lib/underscore.js'),
        },
        //extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js", ".jsx"]
    },
    // 2. 通过externals导入外部的全局变量：
    externals: {
        // 从window变量中导入的外部变量:
        //'jquery': 'window.jQuery',
        //'underscore': 'window._',
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
        process.env.MINIFY_LIB && new webpack.optimize.UglifyJsPlugin({
            compress: { warnings: false },
            output: { comments: false }
        }),
        new Es3ifyPlugin(),
    ].filter(function(x){ return !!x; })
};

//console.log(module.exports);
