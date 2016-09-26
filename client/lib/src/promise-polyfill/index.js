if (!window.Promise){
    var polyfill = require('es6-promise-polyfill');
    if (polyfill && polyfill.Promise){
        window.Promise = polyfill.Promise;
    }
}
