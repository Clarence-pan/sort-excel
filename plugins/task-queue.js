var _ = require('lodash');

module.exports = TaskQueue;


/**
 * 任务队列，序列化运行，支持合并
 * @returns {TaskQueue}
 * @constructor
 */
function TaskQueue(options) {
    this._options = _.extend({
        autostart: false,   // 是否自动启动
        mergeDirection: 'backward',
        timeout: null,
        compareTasks: compareTasks,
        execute: function (task, done) {
            done();
        }
    }, options);

    this._queue = [];
    this._eventHandlers = {'ready': [], 'error': [], 'complete': []};
    this._isStarted = false;
    this._runningTask = null;

    if (this._options.autostart) {
        this.start();
    }

    return this;
}

/**
 * 入队列
 * @param task
 */
TaskQueue.prototype.enqueue = function (task) {
    for (var i = 0, len = this._queue.length; i < len; i++) {
        var t = this._queue[i];
        if (this._options.compareTasks.call(null, t, task) === 0) {
            if (this._options.mergeDirection === 'backward') {
                this._queue.splice(i, 1, task);
                return;
            } else {
                return;
            }
        }
    }

    this._queue.push(task);

    executeTask.call(this);
};

/**
 * 开始队列
 */
TaskQueue.prototype.start = function () {
    if (this._isStarted) {
        return;
    }

    this._isStarted = true;

    executeTask.call(this);
};

TaskQueue.prototype.run = TaskQueue.prototype.start;

TaskQueue.prototype.on = function (type, handler) {
    if (!this._eventHandlers[type]) {
        throw new Error("Invalid event type: " + type);
    }

    this._eventHandlers[type].push(handler);
};

/**
 * 运行任务
 * @returns {boolean}
 */
function executeTask() {
    if (this._runningTask) {
        return false;
    }

    setTimeout(function () {
        if (this._runningTask) {
            return;
        }

        if (this._queue.length <= 0) {
            return;
        }

        var task = this._runningTask = this._queue.splice(0, 1)[0];
        if (!task) {
            executeTask.call(this);
            return;
        }

        var isOver = false;
        var timeoutTimer = null;

        try {
            triggerEvent('ready', task);
            this._options.execute(task, function (err) {
                if (task === this._runningTask){
                    this._runningTask = null;
                }

                isOver = true;
                if (timeoutTimer){
                    clearTimeout(timeoutTimer);
                }


                if (err) {
                    try {
                        triggerEvent.call(this, 'error', err);
                    } catch (e) {
                    }
                } else {
                    triggerEvent('complete', task);
                }

                executeTask.call(this);
            }.bind(this));

            if (!isOver && this._options.timeout){
                timeoutTimer = setTimeout(function(){
                    if (task === this._runningTask){
                        this._runningTask = null;
                    }

                    isOver = true;
                    clearTimeout(timeoutTimer);

                    try {
                        triggerEvent.call(this, 'error', _.extend(new Error('Task timeout!'), {task: task}));
                    } catch (e) {
                    }

                    executeTask.call(this);
                }.bind(this), this._options.timeout);
            }
        } catch (e) {
            try {
                triggerEvent.call(this, 'error', e);
            } catch (e) {
            }
            executeTask.call(this);
        }
    }.bind(this));
}

function triggerEvent(type, data) {
    if (this._eventHandlers && this._eventHandlers[type]) {
        _.each(this._eventHandlers, function (handler) {
            if (handler && handler.call) {
                handler.call(this, data);
            }
        }.bind(this));
    }
}

/**
 * 比较两个任务
 * @param task1
 * @param task2
 * @returns {number}
 */
function compareTasks(task1, task2) {
    if (task1 === task2) {
        return 0;
    }

    return 1;
}

