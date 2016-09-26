var Promise = require('promise');

/*
 * 默认情况下，fs等工具是使用回调函数的方式的异步，非常不方便，因此转换为promise的方式的异步：
 */


module.exports = convertCallbackStyleFunctionToPromiseStyle;
module.exports.makeCallbackForPromise = makeCallbackForPromise;

function convertCallbackStyleFunctionToPromiseStyle(method, context){
    return function (){
        var args = Array.prototype.slice.call(arguments, 0);
        return new Promise(function(resolve, reject){
            args.push(makeCallbackForPromise(resolve, reject));
            method.apply(context, args);
        });
    };
}

function makeCallbackForPromise(resolve, reject){
    return function (err, data){
        if (err){
            if (data && !('data' in err)){
                err.data = data;
            }

            reject(err);
        } else {
            resolve(data);
        }
    };
}
