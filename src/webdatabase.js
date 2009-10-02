
(function() {
    Deferred.define(this);
    var $D = Deferred;
    var Database, SQL, Model;

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
                callback(new SQL(tx));
            }, function(e) { d.fail(e); }, function(e) { d.call(e); });
            return d;
        }
    }

    SQL = Database.SQL = function(tx) {
        this.tx = tx;
        return this;
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

