
(function() {
    Deferred.define(this);

    var $D = Deferred;
    var Database, Transaction, SQL, Model;

    var p = function() {
        console.log(Array.prototype.slice.call(arguments, 0));
    }

    var extend = function(to, from) {
        if (!from) return to;
        for (var key in from) to[key] = from[key];
        return to;
    }

    Database = window.WebDatabase = function(dbName, options) {
        if (!dbName) dbName = 'default-wdb';

        if (Database._instances[dbName]) return Database._instances[dbName];

        this.options = extend({
            version: '1.0',
            displayName: dbName,
            estimatedSize: 1 * 1024 * 1024
        }, options);

        this.dbName = dbName;
        this.db = this.getDatabase();
        Database._instances[dbName] = this;
        return this;
    }

    extend(Database, {
        _instances: {},
        global: null
    });

    Database.prototype = {
        transaction: function(callback) {
            var d = new $D, db = this.db;
            db.transaction(function(tx) {
                var t = new Transaction(tx);
                callback(t);
                t.commit().call();
            }, function(e) { d.fail(e); }, function(e) { d.call(e); });
            return d;
        },
        getDatabase: function() {
            var options = this.options;
            return (Database.global || window).openDatabase(this.dbName, options.version, options.displayName, options.estimatedSize);
        }
    }

    Transaction = Database.Transaction = function(tx) {
        this.queue = [];
        this.tx = tx;
        return this;
    }

    Transaction.prototype = {
        commit: function() {
            var d = new $D;
            this.shiftDefererd(d);
            return d;
        },
        shiftDefererd: function(d) {
            if (this.queue.length == 0) return;

            var self = this;
            var que = this.queue.shift(); // , d = new $D;
            if (que[0] == 'deferred') {
                return d[que[1]].apply(d, que[2]);
            } else if (que[0] == 'sql') {
                var sql = que[1], args = que[2];
                if (typeof sql == 'function') {
                    if (!self._lastResult) {
                        throw new Error('no last result');
                    } else {
                        sql = sql(self._lastResult);
                        if (sql instanceof Array) {
                            sql = sql[0], args = sql[1];
                        }
                    }
                }
                self.tx.executeSql(sql, args, function(_tx, res) {
                    self.tx = _tx;
                    self._lastResult = res;
                    self.shiftDefererd(d);
                    d.call(res);
                }, function(_tx, error) {
                    p('SQL ERROR: ', error, sql, args);
                    self.tx = _tx;
                    self.lastError = error;
                    self.shiftDefererd(d);
                    d.fail(error);
                });
                return d;
            }
        },
        /*
         * tx.executeSql('SELECT * from users').next(result) {
         * };
         * tx.executeSql('SELECT * from users').executeSql(function(result) {
         *     var name = result.rows.item(0).name;
         *     return ['SELECT * from users where name = ?', name];
         * });
         */
        executeSql: function(sql, args) {
            this.queue.push(['sql', sql, args]);
            return this;
        }
    };

    (function() {
        // for (var name in JSDeferred.prototype) {
        ['next', 'cancel', 'call', 'fail', 'error'].forEach(function(name) {
            var method = Deferred.prototype[name];
            if (typeof method == 'function' && typeof Transaction.prototype[name] == 'undefined') {
                Transaction.prototype[name] = function() {
                    this.queue.push(['deferred', name, Array.prototype.slice.call(arguments, 0)]);
                }
            }
        });
    })();

    Model = Database.Model = function(schema) {
        var klass = function() {
            this.klass = klass;
            this._fields = schema.fields;
            this._table = schema.table;
            return this;
        };

        extend(klass, {
            createTable: function() {
            },
            setConnection: function(dbName, options) {
            },
            getConnection: function() {
            },
            transition: function(func) {
                var conn = klass.getConnection();
                var d = new $D;
                // klass._transaction = true;
                // conn.transition(func, function() { d.call() },  function() { d.fail() });
                return;
            }
        });

        return klass;
    }

})();

