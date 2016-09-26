// 定义浏览器中的环境变量

// 从node环境中继承而来的环境变量，默认以逗号或空白字符分割
var inheritsFromProcessEnvVars = (process.env.BROWSER_ENV_VARS || '').split(/(,)|(,?\s+)/);

var browserEnv = {};

for (var i = 0; i < inheritsFromProcessEnvVars.length; i++){
    var varName = inheritsFromProcessEnvVars[i];
    if (varName){
        browserEnv[varName] = process.env[varName];
    }
}

// 暂时不支持以其他方式定义

module.exports = browserEnv;

