
Deferred.define();

Deferred.test = function(name, t, count, wait) {
    var d = new Deferred();
    setTimeout(function() {
        var setupDeferred = new Deferred(), teardownDeferred = new Deferred();
        var setup = Deferred.test.setup, teardown = Deferred.test.teardown;
        setupDeferred.next(function() {
            next(function() {
                var args = [name, function() {
                    stop(wait || 3000);
                    try {
                        t(teardownDeferred);
                    } catch(e) {
                        ok(false, 'test error: ' + e.toString());
                        teardownDeferred.call();
                    }
                }];
                if (count) args.push(count)
                test.apply(test, args);
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
    start(); // XXX
    console.log('teardown' + i);
    d.call();
};

Deferred.prototype.method = function(name) {
    return d[name]();
};

Deferred.register('test', Deferred.test);

var Database = Deferred.WebDatabase;
var Model = Database.Model, SQL = Database.SQL;

Deferred.
test("Database instance", function(d){
    var db = new Database();
    ok(db, 'db');
    var db1 = new Database();
    equals(db.db, db1.db, 'db cache');
    var db2 = new Database('foo');
    ok(db2, 'db2');
    ok(db != db2, 'db not eq');
    ok(db.db != db2.db, 'db not eq raw db');
    d.call();
}, 5).

test('SQL', function(d) {
    var whereOK = function(stmt, bind, obj) {
        var wRes = SQL.where(obj);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
    }
    whereOK('WHERE user = ? AND status = ?', ['nwiger', 'completed'], {
        user: 'nwiger',
        status: 'completed',
    });
    var sql = new SQL('mytable');
    ok(sql instanceof SQL, 'SQL instance');
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
            ok(e.toString(), 'success: catch noMethodError() transaction');
            d.call();
        });
    });
}, 3).

test("executeSql", function(d) {
    var db = new Database;
    parallel([
        db.transaction(function(tx) {
            tx.
              executeSql('drop table if exists `Test`').
              executeSql(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (id INT UNIQUE, name TEXT UNIQUE)';
              }).
              executeSql("insert into Test values (1, 'first')").
              executeSql("insert into Test values (?, ?)", [2,"second"]).
              executeSql("select * from Test order by id").
              next(function(result) {
                  equals(result.rows.length, 2);
                  equals(result.rows.item(0).name, 'first');
                  equals(result.rows.item(1).name, 'second');
              });
        }),
        db.transaction(function(tx) {
            tx.
              executeSql('drop table if exists `Test`').
              executeSql(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (eid INTEGER PRIMARY KEY, name TEXT)';
              }).
              executeSql("insert into Test (name) values ('first')").
              executeSql("insert into Test (name) values ('second')").
              executeSql("insert into Test (name) values ('third')").
              executeSql("select * from Test order by eid").
              next(function(result) {
                  equals(result.rows.length, 3);
                  equals(result.rows.item(0).name, 'first');
                  equals(result.rows.item(0).eid , 1);
                  equals(result.rows.item(2).name, 'third');
                  equals(result.rows.item(2).eid , 3);
              });
        }),
        db.transaction(function(tx) {
            var eSql = 'create table `Test`';
            tx.
              executeSql('create table if not exists `Test`').
              executeSql(eSql).
              error(function(e) {
                  ok(e[0], 'get transaction errorback');
                  equals(e[1], eSql);
              });
        }),
        db.transaction(function(tx) {
            tx.
              executeSql('drop table if exists `Test`').
              executeSql(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (id INT UNIQUE, name TEXT UNIQUE)';
              }).
              executeSql("insert into Test values (1, 'first')").
              executeSql("insert into Test values (?, ?)", [3,"third"]).
              executeSql("insert into Test values (?, ?)", [2,"second"]).
              executeSql("select * from Test order by id").
              next(function(result) {
                  equals(result.rows.length, 3);
                  equals(result.rows.item(0).name, 'first');
                  equals(result.rows.item(1).name, 'second');
                  equals(result.rows.item(2).name, 'third');
              });
        }),
        db.executeSql(
            'drop table if exists `Test3`'
        ).next(function(res) {
            ok(res, 'no transaction executeSql');
        }).next(function() {
            var d = new Deferred();
            db.executeSql([
                'create table if not exists Test3 (id INT UNIQUE, name TEXT UNIQUE)',
                "insert into Test3 values (3, 'third')",
                ["insert into Test3 values (?, ?)", [2, 'second']],
                ["select * from Test3 where id = ?", [3]]
            ]).next(function(res) {
                ok(res, 'no transaction executeSql(ary)');
                equals(res.rows.length, 1);
                equals(res.rows.item(0).name, 'third');
                d.call();
            });
            return d;
        })
    ]).next(function() {
        d.call();
    });
}, 21).

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


