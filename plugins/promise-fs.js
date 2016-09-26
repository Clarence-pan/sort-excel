var fs = require('fs');
var callbackStyleToPromiseStyle = require('./async-callback-to-promise');

/*
 * 默认情况下，fs等工具是使用回调函数的方式的异步，非常不方便，因此转换为promise的方式的异步：
 */

exports.readFile = callbackStyleToPromiseStyle(fs.readFile, fs);
exports.writeFile = callbackStyleToPromiseStyle(fs.writeFile, fs);

