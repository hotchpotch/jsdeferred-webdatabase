
Deferred.define();

var p = function() {
    console.log(Array.prototype.slice.call(arguments, 0));
}

Deferred.test = function(name, t, count, wait) {
    var d = new Deferred();
    var search = location.search;
    var func = function() {
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
    }
    if (search.indexOf('?') == 0) {
        if (decodeURIComponent(search.substring(1)) != name) {
            setTimeout(function() {
                d.call();
            }, 0);
        } else {
            func();
        }
    } else {
        func();
    }
    return d;
};

// var i = 0;
Deferred.test.setup = function(d) {
//    console.log('setup' + (++i));
    d.call();
};

Deferred.test.teardown = function(d) {
    start(); // XXX
//    console.log('teardown' + i);
    d.call();
};

Deferred.prototype.method = function(name) {
    return d[name]();
};

Deferred.register('test', Deferred.test);

var Database = Deferred.WebDatabase;
var Model = Database.Model, SQL = Database.SQL;

var syntaxCheck = function(stmt, bind) {
    if (!syntaxCheck.db) syntaxCheck.db = new Database('syntaxcheck');

    syntaxCheck.db.execute(stmt, bind).
            next(function(aa) {
                ok(false, 'don"t call this');
            }).
            error(function(er) {
                // Syntax Error Check
                var sqlerror = er[0];
                if (sqlerror.message.indexOf('syntax error') != -1) {
                    ok(false, 'web database syntax fail: ' + stmt + ' (' + sqlerror.message + ')');
                } else {
                    ok(true, 'web database syntax OK: ' +  stmt + ' (' + sqlerror.message + ')');
                }
            });
}

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

test("execute", function(d) {
    var db = new Database;
    parallel([
        db.transaction(function(tx) {
            tx.
              execute('drop table if exists `Test`').
              execute(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (id INT UNIQUE, name TEXT UNIQUE)';
              }).
              execute("insert into Test values (1, 'first')").
              execute("insert into Test values (?, ?)", [2,"second"]).
              execute("select * from Test order by id").
              next(function(result) {
                  equals(result.rows.length, 2);
                  equals(result.rows.item(0).name, 'first');
                  equals(result.rows.item(1).name, 'second');
              });
        }),
        db.transaction(function(tx) {
            tx.
              execute('drop table if exists `Test`').
              execute(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (eid INTEGER PRIMARY KEY, name TEXT)';
              }).
              execute("insert into Test (name) values ('first')").
              execute("insert into Test (name) values ('second')").
              execute("insert into Test (name) values ('third')").
              execute("select * from Test order by eid").
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
              execute('create table if not exists `Test`').
              execute(eSql).
              next(function(res) {
                  ok(false, 'don"t call this');
              }).
              error(function(e) {
                  ok(e[0], 'get transaction errorback');
                  equals(e[1], eSql);
              });
        }),
        db.transaction(function(tx) {
            tx.
              execute('drop table if exists `Test`').
              execute(function(result) {
                  ok(result, 'callback with result');
                  return 'create table if not exists Test (id INT UNIQUE, name TEXT UNIQUE)';
              }).
              execute("insert into Test values (1, 'first')").
              execute("insert into Test values (?, ?)", [3,"third"]).
              execute("insert into Test values (?, ?)", [2,"second"]).
              execute("select * from Test order by id").
              next(function(result) {
                  equals(result.rows.length, 3);
                  equals(result.rows.item(0).name, 'first');
                  equals(result.rows.item(1).name, 'second');
                  equals(result.rows.item(2).name, 'third');
              });
        })
        ,
        db.execute(
            'drop table if exists `Test3`'
        ).next(function(res) {
            ok(res, 'no transaction execute');
        }).next(function() {
            var d = new Deferred();
            db.execute([
                'create table if not exists Test3 (id INT UNIQUE, name TEXT UNIQUE)',
                "insert into Test3 values (3, 'third')",
                ["insert into Test3 values (?, ?)", [2, 'second']],
                ["select * from Test3 where id = ?", [3]]
            ]).next(function(res) {
                ok(res, 'no transaction execute(ary)');
                equals(res.rows.length, 1);
                equals(res.rows.item(0).name, 'third');
                d.call();
            });
            return d;
        })
    ]).next(function() {
        d.call();
    });
}, 21, 3000).

test('SQL where', function(d) {
    ok(SQL.isString('a'), 'isString');
    ok(SQL.isString(new String('a')), 'isString');
    ok(!SQL.isString({}), 'isString');
    ok(!SQL.isString([]), 'isString');

    var sql = new SQL({});
    ok(sql instanceof SQL, 'SQL instance');

    var holderOK = function(stmt, bind, key, obj) {
        var wRes = sql.holder(key, obj);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
    }
    holderOK('status != ?', ['completed'], 'status', {'!=': 'completed'});
    holderOK('(date < ?) OR (date > ?)', [10, 100], 'date', {'<': '10', '>': 100});

    var whereOK = function(stmt, bind, obj) {
        var wRes = sql.where(obj);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck('select * from table1 ' + wRes[0], wRes[1]);
    }
    var sTmp = "WHERE user = 'nadeko' AND status = 'completed'";
    whereOK(sTmp, null, sTmp);

    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], ['user = ? AND status = ?', ['nadeko', 'completed']]);
    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], ['user = ? AND status = ?', 'nadeko', 'completed']);
    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], ['user = :user AND status = :status', {
        user: 'nadeko',
        status: 'completed',
    }]);

    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], ['user = :u AND status = :s_atus', {
        u: 'nadeko',
        s_atus: 'completed',
    }]);

    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], ['user = :user AND status = :status', {
        user: 'nadeko',
        status: 'completed',
    }]);

    whereOK('WHERE user = ? AND status = ?', ['nadeko', 'completed'], {
        user: 'nadeko',
        status: 'completed',
    });

    whereOK('WHERE user IS NULL AND status = ?', ['completed'], {
        user: null,
        status: 'completed',
    });

    whereOK('WHERE user IS NULL AND status = ?', ['completed'], {
        user: SQL.NULL,
        status: 'completed',
    });

    whereOK('WHERE user IS NOT NULL AND status = ?', ['completed'], {
        user: SQL.NOT_NULL,
        status: 'completed',
    });

    whereOK('WHERE user = ? AND (status = ? OR status = ? OR status = ?)', ['nadeko', 'assigned', 'in-progress', 'pending'], {
        user: 'nadeko',
        status: ['assigned', 'in-progress', 'pending']
    });

    whereOK('WHERE user = ? AND status != ?', ['nadeko', 'completed'], {
        user: 'nadeko',
        status: {'!=': 'completed'}
    });

    setTimeout(function() {
    d.call();
    }, 3000);
}, 45, 3500).

test('SQL Select', function(d) {
    var sql = new SQL({});

    var selectOK = function(stmt, bind, table, fields, where, options) {
        var wRes = sql.select(table, fields, where, options);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    selectOK('select * from table1 WHERE user = ? AND status = ?', ['nadeko', 'completed'], 'table1', '*', ['user = :user AND status = :status', {
        user: 'nadeko',
        status: 'completed',
    }]);

    selectOK('select * from table1 WHERE user IS NULL AND status = ? LIMIT ?', ['completed', 1], 'table1', '*', {
        user: null,
        status: 'completed',
    }, {
        limit: 1
    });

    selectOK('select * from table1 WHERE user IS NULL AND status = ? ORDER BY user desc', ['completed'], 'table1', '*', {
        user: null,
        status: 'completed',
    }, {
        order: 'user desc'
    });

    selectOK('select * from table1 WHERE user IS NULL AND status = ? GROUP BY age', ['completed'], 'table1', '*', {
        user: null,
        status: 'completed',
    }, {
        group: 'age'
    });

    selectOK('select * from table1 WHERE user IS NULL AND status = ? LIMIT ? OFFSET ?', ['completed', 20, 10], 'table1', '*', {
        user: null,
        status: 'completed',
    }, {
        limit: 20,
        offset: 10
    });

    setTimeout(function() {
        d.call();
    }, 2500);
}, 15, 3000).

test('SQL Insert/Update', function(d) {
    var sql = new SQL({});

    var insertOK = function(stmt, bind, table, data) {
        var wRes = sql.insert(table, data);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    var updateOK = function(stmt, bind, table, data, where, options) {
        var wRes = sql.update(table, where, options);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    insertOK('insert into table1 (user, status) values (?, ?)', ['nadeko', 'completed'], 'table1', {
        user: 'nadeko',
        status: 'completed',
    });

    setTimeout(function() {
        d.call();
    }, 2500);
}, 3, 3000).

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


