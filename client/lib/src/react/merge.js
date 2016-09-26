/**
 * React 2.x 之后的版本都是把React和ReactDOM分开了，这样很不方便 -- so，为了便于在前台使用我们还是把这两个东东合在一起吧：
 */
(function (require, define) {
    // begin wrapper of merge.

    $include('react');
    $include('react-dom');

    // end wrapper of merge

    (function (g) {
        // 将ReactDOM的常用方法搞到React上，比较方便:
        (function (React, ReactDOM){
            if (ReactDOM && React) {
                var methods = ['render', 'findDOMNode'];
                for (var i = 0; i < methods.length; i++){
                    var method = methods[i];
                    if (!React[method] && ReactDOM[method]){
                        React[method] = ReactDOM[method].bind(ReactDOM);
                    }
                }
            }
        })(g.React, g.ReactDOM);
    })(typeof window !== 'undefined' ? window : {});
}).call(null); // 故意地，让require和define都没有，这样子react就会乖乖地定义到了window对象上了 -- 我们就是要这样.
