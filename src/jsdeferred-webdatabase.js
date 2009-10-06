
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
        for (var key in from) {
            to[key] = from[key];
            var getter, setter;
            if (getter = from.__lookupGetter__(key)) {
                if (getter) to.__defineGetter__(key, getter);
            }
            if (setter = from.__lookupSetter__(key)) {
                if (setter) to.__defineSetter__(key, setter);
            }
        }
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
        debug: p,
        global: null
    });

    Database.prototype = {
        transaction: function(callback) {
            var d = new $D, db = this.db;
            db.transaction(function(tx) {
                var t = new Transaction(tx);
                callback(t);
                return t.commit();
            }, function(e) { p(e);d.fail(e); }, function(e) { d.call(e); });
            return d;
        },
        getDatabase: function() {
            var options = this.options;
            return (Database.global || window).openDatabase(this.dbName, options.version, options.displayName, options.estimatedSize);
        },
        execute: function(sql, args) {
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
                        tx.execute(str, arg);
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
                d = d[que[1]].apply(d, que[2]);
                while (this.queue.length && this.queue[0][0] == 'deferred') {
                    // 次も deferred ならここで繋げておかずに return を返すと進行してしまう
                    que = this.queue.shift();
                    d = d[que[1]].apply(d, que[2]);
                }
                return d;
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
                    if (Database.debugMessage) Database.debug(res, sql, args);
                    d.call(res);
                }, function(_tx, error) {
                    self.tx = _tx;
                    self.lastError = [error, sql, args];
                    self.chains(d);
                    if (Database.debugMessage) Database.debug(error, sql, args);
                    d.fail([error, sql, args]);
                });
                return d;
            }
        },
        /*
         * tx.execute('SELECT * from users').next(result) {
         * };
         * tx.execute('SELECT * from users').execute(function(result) {
         *     var name = result.rows.item(0).name;
         *     return ['SELECT * from users where name = ?', name];
         * });
         */
        execute: function(sql, args) {
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
        select: function(table, fields, where, options) {
            if (!fields) fields = '*';
            var stmt, bind = [];
            stmt = 'SELECT ' + (fields || '*') + ' FROM ' + table;
            if (where) {
                var wheres = this.where(where);
                stmt += ' ' + wheres[0];
                bind = wheres[1];
            }
            if (options) {
                var opt = this.optionsToSQL(options);
                stmt += opt[0];
                bind = bind.concat(opt[1]);
            }
            return [stmt, bind];
        },
        insert: function(table, data) {
            var keys = [], bind = [], values = [];
            for (var key in data) {
                if (typeof data[key] != 'undefined') {
                    keys.push(key);
                    bind.push(data[key]);
                    values.push('?');
                }
            }
            var stmt = 'INSERT INTO ' + table + ' (' + keys.join(', ') + ') VALUES (' + values.join(', ') + ')';
            return [stmt, bind];
        },
        update: function(table, data, where) {
            var wheres, keys = [], bind = [];
            if (where) wheres = this.where(where);
            for (var key in data) {
                if (typeof data[key] != 'undefined') {
                    keys.push(key + ' = ?');
                    bind.push(data[key]);
                }
            }
            var stmt = 'UPDATE ' + table + ' SET ' + keys.join(', ');
            if (wheres) {
                stmt += ' ' + wheres[0];
                bind = bind.concat(wheres[1]);
            }
            /* SQLite not support update limit/order ...
            if (options) {
                var opt = this.optionsToSQL(options);
                stmt += opt[0];
                bind = bind.concat(opt[1]);
            }
            */
            return [stmt, bind];
        },
        'deleteSql': function(table, where) {
            var wheres, bind = [];
            if (where) wheres = this.where(where);
            var stmt = 'DELETE FROM ' + table;
            if (wheres) {
                stmt += ' ' + wheres[0];
                bind = bind.concat(wheres[1]);
            }
            return [stmt, bind];
        },
        optionsToSQL: function(options) {
            var stmt = '', bind = [];
            if (options) {
                if (options.order) {
                    stmt += ' ORDER BY ' + options.order;
                }
                if (options.group) {
                    stmt += ' GROUP BY ' + options.group;
                }
                if (typeof options.limit != 'undefined') {
                    stmt += ' LIMIT ?';
                    bind.push(parseInt(options.limit));
                }
                if (typeof options.offset != 'undefined') {
                    stmt += ' OFFSET ?';
                    bind.push(parseInt(options.offset));
                }
            }
            return [stmt, bind];
        },
        create: function(table, fields, force) {
            var stmt = 'CREATE TABLE ' + (!force ? 'IF NOT EXISTS ' : '' ) + table + ' ';
            var bind = [];
            var values = [];
            for (var key in fields) {
                bind.push(key + ' ' + fields[key]);
            }
            stmt += ' (' + bind.join(', ') + ')';
            // stmt += ' IF NOT EXISTS ' + table;
            return stmt;
        },
        drop: function(table, force) {
            return 'DROP TABLE ' + (!force ? 'IF EXISTS ' : '' ) + table;
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
            } else if (SQL.isString(hash) || !isNaN(hash)) {
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
        var klass = function(data) {
            if (!data) data = {};
            this._klass = klass;
            this._data = {};
            this.setAttributes(data);
            if (data._created) {
                this._created = data._created;
            }
            return this;
        };

        var sql = klass.sql = new SQL();
        klass.table = schema.table;

        extend(klass, {
            setColumns: function() {
                klass._columns = [];
                var f = klass._fields;
                for (var key in f) {
                    klass._columns.push(key);
                }
            },
            defineGetterSetters: function() {
                for (var i = 0;  i < klass.columns.length; i++) {
                    klass.defineGetterSetter(klass.columns[i]);
                }
            },
            defineGetterSetter: function(key) {
                klass.prototype.__defineSetter__(key, function(value) {
                    this.set(key, value);
                });
                klass.prototype.__defineGetter__(key, function() {
                    return this.get(key);
                });
            },
            setPrimaryKeysHash: function() {
                klass.pKeyHash = {};
                for (var i = 0;  i < klass.primaryKeys.length; i++) {
                    var key = klass.primaryKeys[i];
                    klass.pKeyHash[key] = true;
                }
            },
            get columns() {
                return klass._columns;
            },
            set fields (fields) {
                klass._fields = fields;
                klass.setColumns();
            },
            get fields () {
                return klass._fields;
            },
            set primaryKeys (primaryKeys) {
                klass._primaryKeys = primaryKeys;
                klass.setPrimaryKeysHash();
            },
            get primaryKeys () {
                return klass._primaryKeys;
            },
            set database (db) {
                klass._db = _db;
            },
            get database () {
                return klass._db;
            },
            getInfo: function(name) {
                if (klass._infoCache) {
                    return klass._infoCache[name];
                }
                return;
            },
            isTableCreated: function() {
                if (klass.getInfo(name)) {
                    return $D.next(function() {
                        return true;
                    });
                } else {
                    return klass.updateInfo().next(function() {
                        return klass.getInfo(name) ? true : false;
                    });
                }
            },
            execute: function(sql) {
                if (sql instanceof Array) {
                    return klass.database.execute(sql[0], sql[1]);
                } else {
                    throw new Error ('execute(stmt, bind');
                }
            },
            find: function(options) {
                var d = klass.execute(klass.select(options.where, options.fields, options));
                d = d.next(function(res) {
                    return klass.resultSet(res, options.resultType);
                });
                return d;
            },
            resultSet: function(res, type) {
                // default
                return klass.resultSetInstance(res);
            },
            resultSetInstance: function(res) {
                var result = [], rows = res.rows;
                var len = rows.length;
                for (var i = 0;  i < len; i++) {
                    var r = new klass(rows.item(i));
                    r._created = true;
                    result.push(r);
                }
                return result;
            },
            select: function(where, fields, options) {
                return sql.select(klass.table, fields, where, options);
            },
            createTable: function(fun) {
                var d = klass.database.execute(sql.create(klass.table, klass.fields));
                d = d.next(klass.afterCreateTable);
                if (typeof fun == 'function') return d.next(fun);
                return d;
            },
            afterCreateTable: function(r) {
                if (!this._infoCache) klass.updateInfo().call();
                return r;
            },
            updateInfo: function() {
                return klass.execute(sql.select('sqlite_master', '*', {
                    type: 'table',
                    name: klass.table
                })).next(function(res) {
                    if (res.rows && res.rows.length) {
                        var item = res.rows.item(0);
                        klass._infoCache = item;
                    }
                });
            },
            dropTable: function(fun) {
                var d = klass.database.execute(sql.drop(klass.table));
                d = d.next(klass.afterDropTable);
                if (typeof fun == 'function') return d.next(fun);
                return d;
            },
            afterDropTable: function(res) {
                delete klass._infoCache;
                return res;
            }
        });

        klass.fields = schema.fields;
        klass.primaryKeys = schema.primaryKeys;
        if (!schema.primaryKeys) throw new Error('primaryKeys required.');
        if (!(schema.primaryKeys instanceof Array)) throw new Error('primaryKeys(Array) required.');

        klass.prototype = {
            set: function(key, value) {
                this._data[key] = value;
            },
            get: function(key) {
                return this._data[key];
            },
            getFieldData: function() {
                var data = {};
                for (var i = 0;  i < klass.columns.length; i++) {
                    var key = klass.columns[i];
                    if (!klass.pKeyHash[key]) data[key] = this.get(key);
                }
                return data;
            },
            getPrimaryWhere: function() {
                var where = {};
                for (var i = 0;  i < klass.primaryKeys.length; i++) {
                    var key = klass.primaryKeys[i];
                    where[key] = this.get(key);
                    if (typeof where[key] == 'undefined') {
                        throw new Error('primary keys values is required.' +  key);
                    }
                }
                return where;
            },
            setAttributes: function(data) {
                if (data) {
                    for (var i = 0;  i < klass.columns.length; i++) {
                        var key = klass.columns[i];
                        if (typeof data[key] != 'undefined') {
                            this.set(key, data[key]);
                        }
                    }
                }
            },
            reload: function() {
            },
            _updateFromResult: function(res) {
                if (res.insertId && klass.primaryKeys.length == 1) {
                    this.set(klass.primaryKeys[0], res.insertId);
                    this._created = true;
                }
            },
            save: function(fun) {
                var d;
                var self = this;
                if (this._created) {
                    var data = this.getFieldData();
                    d = klass.execute(sql.update(klass.table, data, this.getPrimaryWhere()));
                } else {
                    var data = this.getFieldData();
                    d = klass.execute(sql.insert(klass.table, data));
                }
                d = d.next(function(res) {
                    if (!self._created)
                        self._updateFromResult(res);
                    return self;
                });
                if (typeof fun == 'function') return d.next(fun);
                return d;
            }
        }
        klass.defineGetterSetters();

        return klass;
    }

})();

