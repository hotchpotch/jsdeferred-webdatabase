
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

var syntaxCheck = function(stmt, bind, noError) {
    if (!syntaxCheck.db) syntaxCheck.db = new Database('syntaxcheck');

    syntaxCheck.db.execute(stmt, bind).
            next(function(aa) {
                if (noError) {
                    ok(true, 'Syntax OK');
                } else {
                    ok(false, 'don"t call this');
                }
            }).
            error(function(er) {
                // Syntax Error Check
                var sqlerror = er[0];
                if (noError) {
                    ok(false, 'don"t call this:' + sqlerror.message);
                } else {
                    if (sqlerror.message.indexOf('syntax error') != -1) {
                        ok(false, 'web database syntax fail: ' + stmt + ' (' + sqlerror.message + ')');
                    } else {
                        ok(true, 'web database syntax OK: ' +  stmt + ' (' + sqlerror.message + ')');
                    }
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

    whereOK('WHERE uid = ?', [10], {
        uid: 10
    });

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
}, 48, 3500).

test('SQL Select', function(d) {
    var sql = new SQL({});

    var selectOK = function(stmt, bind, table, fields, where, options) {
        var wRes = sql.select(table, fields, where, options);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    selectOK('select * from table1', [], 'table1');

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
}, 18, 3000).

test('SQL Insert/Update/Delete', function(d) {
    var sql = new SQL({});

    var insertOK = function(stmt, bind, table, data) {
        var wRes = sql.insert(table, data);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    var updateOK = function(stmt, bind, table, data, where) {
        var wRes = sql.update(table, data, where);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    var deleteOK = function(stmt, bind, table, where) {
        var wRes = sql.deleteSql(table, where);
        equals(stmt.toUpperCase(), wRes[0].toUpperCase());
        equals(String(bind), String(wRes[1]));
        syntaxCheck(wRes[0], wRes[1]);
    }

    insertOK('insert into table1 (user, status) values (?, ?)', ['nadeko', 'completed'], 'table1', {
        user: 'nadeko',
        status: 'completed',
    });

    insertOK('insert into table1 (user, status) values (?, ?)', ['nadeko', 'completed'], 'table1', {
        user: 'nadeko',
        status: 'completed',
        foo: undefined,
    });

    updateOK('update table1 SET user = ?, status = ?', ['nadeko', 'completed'], 'table1', {
        user: 'nadeko',
        status: 'completed',
    });

    updateOK('update table1 SET user = ?, status = ?', ['nadeko', 'completed'], 'table1', {
        user: 'nadeko',
        status: 'completed',
        foo: undefined,
    });

    updateOK('update table1 SET user = ?, status = ? WHERE id = ?', ['nadeko', 'completed', 3], 'table1', {
        user: 'nadeko',
        status: 'completed',
    }, {
        id: 3
    });

    deleteOK('delete from table1', [], 'table1');

    deleteOK('delete from table1 WHERE id = ?', [3], 'table1', {
        id: 3
    });

    setTimeout(function() {
        d.call();
    }, 2500);
}, 21, 3000).

test('SQL Tables', function(d) {
    var sql = new SQL({});

    var dropOK = function(stmt, table, force) {
        var wRes = sql.drop(table, force);
        equals(wRes, stmt);
        syntaxCheck(wRes, [], true);
    }
    dropOK('DROP TABLE IF EXISTS table1', 'table1');

    var createOK = function(stmt, table, fields, force) {
        var wRes = sql.create(table, fields, force);
        // equals(stmt.toUpperCase(), wRes.toUpperCase());
        ok(1);
        syntaxCheck(wRes, [], true);
    }

    var fields = {
        'id'      : 'INTEGER PRIMARY KEY',
        url       : 'TEXT UNIQUE NOT NULL',
        search    : 'TEXT',
        date      : 'INTEGER NOT NULL'
    };
    var res = [];
    for (var key in fields) {
        res.push(key + ' ' + fields[key]);
    }
    createOK('CREATE TABLE IF NOT EXISTS table1 (id INTEGER PRIMARY KEY, url TEXT UNIQUE NOT NULL, search TEXT, data INTEGER NOT NULL)', 'table1', fields);

    dropOK('DROP TABLE IF EXISTS table1', 'table1');
    setTimeout(function() {
        d.call();
    }, 900);
}, 6, 2000).

test('Model', function(d) {
    var is = function(a, b, mes) {
        equals(a.toString(), b.toString(), mes);
    }
    var User = Model({
        table: 'users',
        primaryKeys: ['uid'],
        fields: {
            'uid'         : 'INTEGER PRIMARY KEY',
            name         : 'TEXT UNIQUE NOT NULL',
            data         : 'TEXT',
            updated_at   : 'INTEGER'
        }
    });
    is(User.columns, ['uid', 'name', 'data', 'updated_at']);
    Database.debugMessage = true;
    var db = new Database('testuserdb');
    User.__defineGetter__('database', function() { return db; });
    User.dropTable(function() {
        ok(true, 'drop table');
    }).next(function() {
        User.createTable(function() {

            ok(true, 'create table');
            var u = new User({
                name: 'nadek'
            });
            equals(u.uid, undefined, 'uid');
            equals(u.name, 'nadek', 'name');
            u.save(function() {
                equals(u.uid, 1, 'uid');
                equals(u.name, 'nadek', 'name');
                u.name = 'nadeko';
                u.save(function(r) {
                    equals(r.name, 'nadeko', 'update name');
                    equals(r.uid, 1, 'uid');
                    var u2 = new User({
                        name: 'nadeko'
                    });
                    u2.save().next(function(r) {
                        ok(false, 'don"t call this');
                    }).error(function(e) {
                        ok(true, 'name is UNIQUE (ok)');
                        var u3 = new User({
                            name: 'yuno'
                        });
                        u3.save(function() {
                            equals(u3.uid, 2, 'uid');
                            equals(u3.name, 'yuno', 'name');
                            User.find({
                                where: { name: 'yuno' }
                            }).next(function(res) {
                                ok(res.length == 1)
                                var r = res[0];
                                ok(r instanceof User);
                                equals(r.uid, 2);
                                equals(r.name, 'yuno');
                            });
                            d.call();
                        });
                    });
                }); // u.save
            }); // u.save
        });
    });
}, 16, 3000).

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


