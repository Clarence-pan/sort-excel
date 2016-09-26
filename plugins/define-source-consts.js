// 定义源文件中的常量
var browserEnv = require('./define-browser-env');

module.exports = {
    __DEBUG_REACT__: JSON.stringify(process.env.DEBUG_REACT),
    __ENV__: JSON.stringify(browserEnv)
};

