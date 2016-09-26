var _ = require('lodash');

module.exports = function(stream, options){
    options = _.extend({
        timeout: 5000, //ms
        merge: function(chunks){
            return chunks.join('');
        }
    }, options || {});

    return new Promise(function(resolve, reject){
        var got = [];
        var start = new Date();
        var isDone = false;
        var timer = setTimeout(function(){
            var now = new Date();
            var delta = +now - +start;
            isDone = true;
            reject(_.extend(new Error("Timeout after " + delta + "ms."), {type: 'timeout', start: start, now: now, delta: delta}));
        }, options.timeout);

        stream.on('data', function(data){
            if (!isDone){
                got.push(data);
            }
        });

        stream.on('end', function(){
            if (!isDone){
                isDone = true;
                clearTimeout(timer);
                resolve(options.merge(got));
            }
        });

        stream.on('error', function(err){
            if (!isDone){
                isDone = true;
                reject(_.extend(new Error('Error: internal error: ' + err), {type: 'error', previous: err}));
            }
        });

        stream.on('close', function(){
            if (!isDone){
                isDone = true;
                reject(_.extend(new Error('Error: closed before end.'), {type: 'close'}));
            }
        });

    });
};
