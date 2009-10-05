
(function() {
    Deferred.define(this);

    var $D = Deferred;
    var $F = function() {};
    var Database, Transaction, SQL, Model;

    var p = function() {
        console.log(Array.prototype.slice.call(arguments, 0));
    }

    var extend = function(to, from) {
        if (!from) return to;
        for (var key in from) to[key] = from[key];
        return to;
    }

    Database = Deferred.WebDatabase = function(dbName, options) {
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
        /*,
        executeSql: function(sql, args) {
            var self = this;
            return next(function() {
                var d = new $D;
                if (!(sql instanceof Array)) {
                    sql = [[sql, args]];
                }
                var nRes, nError;
                self.transaction(function(tx) {
                    var str, arg;
                    for (var i = 0, len = sql.length; i < len; i++) {
                        if (sql[i] instanceof Array) {
                            str = sql[i][0], arg = sql[i][1];
                        } else {
                            str = sql[i], arg = null;
                        }
                        tx.executeSql(str, arg);
                    }
                    tx.error(function(res) {
                        nError = res;
                    }).next(function(res) {
                        nRes = res;
                    });
                }).error(function(e) {
                    d.fail(e || nError);
                }).next(function() {
                    if (nError) {
                        d.fail(nError);
                    } else {
                        d.call(nRes);
                    }
                });
                return d;
            });
        }
        */
    }

    Transaction = Database.Transaction = function(tx) {
        this.queue = [];
        this.tx = tx;
        return this;
    }

    Transaction.prototype = {
        commit: function() {
            var d = new $D;
            this.chains(d);
            return d;
        },
        chains: function(d) {
            if (this.queue.length == 0) return;

            var self = this;
            var que = this.queue.shift();
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
                    self.chains(d);
                    d.call(res);
                }, function(_tx, error) {
                    self.tx = _tx;
                    self.lastError = [error, sql, args];
                    self.chains(d);
                    d.fail([error, sql, args]);
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
                    return this;
                }
            }
        });
    })();

    // SQL queryclass like SQL::Abstract.
    SQL = Database.SQL = function(options) {
        this.options = extend({
        }, options);
        return this;
    }

    extend(SQL, {
        isString: function(obj) {
            return typeof obj === 'string' || obj instanceof String;
        },
        NOT_NULL: "0x01NOTNULL",
        NULL: null
    });

    SQL.prototype = {
        select: function(table, fields, obj, options) {
            var wheres = this.where(obj);
            var stmt = 'SELECT ' + fields + ' FROM ' + table + ' ' + wheres[0];
            var bind = wheres[1];
            if (options) {
                if (options.order) {
                    stmt += ' ORDER BY ' + options.order;
                }
                if (options.group) {
                    stmt += ' GROUP BY ' + options.group;
                }
                if (typeof options.limit != 'undefined') {
                    stmt += ' LIMIT ?'; bind.push(parseInt(options.limit));
                }
                if (typeof options.offset != 'undefined') {
                    stmt += ' OFFSET ?'; bind.push(parseInt(options.offset));
                }
            }
            return [stmt, bind];
        },
        where: function(obj) {
            if (SQL.isString(obj)) {
                return [obj, null];
            } else if (obj instanceof Array) {
                if (obj[1] instanceof Array) {
                    return ['WHERE ' + obj[0], obj[1]];
                } else if (SQL.isString(obj[1])) {
                    return ['WHERE ' + obj[0], obj.slice(1)];
                } else {
                    var stmt = obj[0];
                    var hash = obj[1];
                    var re = /:(\w(:?[\w_]+)?)/g;
                    var bind = [];
                    stmt = stmt.replace(re, function(m) {
                        var key = RegExp.$1;
                        if (hash[key]) {
                            bind.push(hash[key]);
                        } else {
                            throw new Error('name not found: ' + key);
                        }
                        return '?';
                    });
                    return ['WHERE ' + stmt, bind];
                }
            } else {
                return this.whereHash(obj);
            }
        },
        whereHash: function(hash) {
            var stmt = [], bind = [];
            for (var key in hash) {
                var val = hash[key];
                if (val instanceof Array) {
                    bind = bind.concat(val);
                    var len = val.length;
                    var tmp = [];
                    while (len--) {
                        tmp.push(this.holder(key)[0]);
                    }
                    stmt.push('(' + tmp.join(' OR ') + ')');
                // } else if (SQL.isString(val)) {
                //     bind.push(val);
                //     stmt.push(this.holder(key)[0]);
                } else {
                    var r = this.holder(key, val);
                    if (typeof r[1] != 'undefined')
                        bind = bind.concat(r[1]);
                    stmt.push(r[0]);
                }
            }
            return ['WHERE ' + stmt.join(' AND '), bind];
        },
        holder: function(key, hash) {
            var stmt, bind;
            if (typeof hash == 'undefined') {
                stmt = key + ' = ?';
            } else if (hash == null) {
                stmt = key + ' IS NULL';
            } else if (hash == SQL.NOT_NULL) {
                stmt = key + ' IS NOT NULL';
            } else if (SQL.isString(hash)) {
                stmt = key + ' = ?';
                bind = [hash];
            } else if (hash instanceof Array) {
                throw new Error('holder error' + hash);
            } else {
                var st = [], bind = [];
                for (var cmp in hash) {
                    st.push(cmp);
                    bind.push(hash[cmp]);
                }
                if (st.length > 1) {
                    stmt = st.map(function(e) { return '(' + key + ' ' + e + ' ?)' }).join(' OR ');
                } else {
                    stmt = '' + key + ' ' + st[0] + ' ?';
                }
            }
            return [stmt, bind];
        },
    }

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

