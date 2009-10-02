
(function() {
    Deferred.define(this);

    var $D = Deferred;
    var Database, Transaction, SQL, Model;

    var extend = function(to, from) {
        if (!from) return to;
        for (var key in from) to[key] = from[key];
        return to;
    }

    Database = window.WebDatabase = function(dbName, options) {
        if (!dbName) dbName = 'default-wdb';

        if (Database._instances[dbName]) return Database._instances[dbName];

        options = extend({
            version: '1.0',
            displayName: dbName,
            estimatedSize: 10 * 1024 * 1024
        }, options);

        this.dbName = dbName;
        this.db = (this.global || window).openDatabase(dbName, options.version, options.displayName, options.estimatedSize);
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
                t._execute();
            }, function(e) { d.fail(e); }, function(e) { d.call(e); });
            return d;
        }
    }

    Transaction = Database.Transaction = function(tx) {
        this.queue = [];
        this.tx = tx;
        return this;
    }

    Transaction.prototype = {
        _execute: function() {
        },
        executeSql: function(sql, args) {
            this.queue.push(['sql', sql, args]);
            return this;
        }
    };

    (function() {
        // for (var name in JSDeferred.prototype) {
        for (var name in ['cancel', 'call', 'fail', 'error']) {
            var method = JSDeferred.prototype[name];
            if (typeof method == 'function' && Transaction.prototype[name] == 'undefined') {
                Transaction.prototype[name] = function() {
                    this.queue.push(['deferred', Array.prototype.slice.call(arguments, 0)]);
                }
            }
        }
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

