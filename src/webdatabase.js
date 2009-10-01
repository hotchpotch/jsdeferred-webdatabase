
(function() {
    var extend = function(to, from) {
        if (!from) return to;
        for (var key in from) to[key] = from[key];
        return to;
    }

    var Database = window.WebDatabase = {
        _conenctions: {},
        global: null,
        openDatabase: function(dbName, options) {
            if (!dbName) dbName = 'default-wdb';
            if (this._conenctions[dbName]) return this._conenctions[dbName];

            options = extend({
                version: '1.0',
                displayName: dbName,
                estimatedSize: 10 * 1024 * 1024
            }, options);

            var db = (this.global || window).openDatabase(dbName, options.version, options.displayName, options.estimatedSize);
            this._conenctions[dbName] = db;
            return db;
        }
    };

    var Model = Database.Model = function(schema) {
        var klass = function() {
            this._fields = fields;
            this._table = schema.table;
            return this;
        };
        extend(klass, Model.classMethods);
        klass.prototype = Model.classPrototype;
        return klass;
    };

    Model.classMethods = {
        createTable: function(callback, errorback) {
        }
    };

    Model.instancePrototype = {
    };

})();

