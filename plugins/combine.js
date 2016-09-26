module.exports = function combine(keys, values) {
    var obj = {};

    for (var i = 0, len = keys.length; i < len; i++) {
        obj[keys[i]] = values[i];
    }

    return obj;
};
