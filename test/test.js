
Deferred.define();

Deferred.test = function(name, t, wait) {
    var d = new Deferred();
    setTimeout(function() {
        var setupDeferred = new Deferred(), teardownDeferred = new Deferred();
        var setup = Deferred.test.setup, teardown = Deferred.test.teardown;
        setupDeferred.next(function() {
            next(function() {
                test(name, function() {
                    stop((wait || 3000));
                    try {
                        t(teardownDeferred);
                        start();
                    } catch(e) {
                        ok(false, 'test error: ' + e.toString());
                        start();
                        teardownDeferred.call();
                    }
                });
            });//, 0);
            return teardownDeferred;
        }).next(function() {
            teardown(d);
        });
        setup(setupDeferred);
    }, 0);
    return d;
};

var i = 0;
Deferred.test.setup = function(d) {
    console.log('setup' + (++i));
    d.call();
};

Deferred.test.teardown = function(d) {
    console.log('teardown' + i);
    d.call();
};

Deferred.prototype.method = function(name) {
    return d[name]();
};

Deferred.register('test', Deferred.test);

var Database = WebDatabase, Model = WebDatabase.Model;

Deferred.
test("Database instance", function(d){
    var db = new Database();
    ok(db, 'db');
    var db1 = new Database();
    equals(db.db, db1.db, 'db cache');
    var db2 = new Database('foo');
    ok(db2, 'db2');
    ok(db != db2, 'db2');
    d.call();
}).

test("transaction", function(d) {
    var db = new Database;
    db.transaction(function(sql) {
        ok(true, 'transaction');
    }).next(function() {
        ok(true, 'finish transaction');
    }).error(function() {
        ok(null, 'error transaction');
    }).next(function() {
        db.transaction(function(sql) {
            noMethodError();
        }).next(function() {
            ok(null, 'error: finish transaction');
        }).error(function(e) {
            ok(e.toString(), 'success: error transaction');
            d.call();
        });
    });
}).

test("executeSql", function(d) {
    var db = new Database;
    db.transaction(function(tx) {
        tx.
          executeSql('drop table if not exists Test').
          executeSql(function(result) {
              ok(true, 'result callback');
              return 'create table if not exists Test (name text UNIQUE)';
          });
    }).next(function() {
        d.call();
    });
}).

test('Model init', function(d) {
    window.User = Model({
        table: 'users',
        fields: {
            'id'      : 'INTEGER PRIMARY KEY',
            url       : 'TEXT UNIQUE NOT NULL',
            title     : 'TEXT',
            comment   : 'TEXT',
            search    : 'TEXT',
            date      : 'TIMESTAMP NOT NULL'
        }
    });
    User.createTable(function() {
        ok(true, 'createTable');
        d.call();
    });
}).

test('3', function(d) {
    // d.call();
}).

test('finished', function(d) {
    ok(true, 'finished');
    d.call();
}).

error(function(e) {
    console.log('error' + e.toString());
    throw(e);
});


