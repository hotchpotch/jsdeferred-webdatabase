
Deferred.define();
Deferred.prototype._fire = function (okng, value) {
    var next = "ok";
    try {
        value = this.callback[okng].call(this, value);
    } catch (e) {
        next  = "ng";
        if (Deferred.debug) console.error(e);
        value = e;
    }
    if (value instanceof Deferred) {
        value._next = this._next;
    } else {
        if (this._next) this._next._fire(next, value);
    }
    return this;
}

var p = function() {
    console.log(Array.prototype.slice.call(arguments, 0));
}

var is = function(a, b, mes) {
    equals(a.toString(), b.toString(), mes);
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

test('ModelOther', function(d) {
    var User = Model({
        table: 'users',
        primaryKeys: ['uid'],
        fields: {
            'uid'        : 'INTEGER PRIMARY KEY',
            name         : 'TEXT UNIQUE NOT NULL',
            other        : 'TEXT',
            num          : 'INTEGER',
            data         : 'TEXT',
            timestamp    : 'INTEGER'
        }
    }, (new Database('testuserdb2')));
    // Database.debugMessage = true;
    User.proxyColumns({
        timestamp  : 'Date',
        data       : 'JSON'
    });
    User.beforeSave = function(user) {
        ok(user, 'before-save');
        user.other = 'hogehoge';
    }
    User.afterSave = function(user) {
        ok(user, 'afterSave');
    }
    User.dropTable().next(User.initialize).next(function() {
        var date = new Date(1254816382000);
        var u = new User({
            name: 'yuno',
            timestamp: date,
        });
        is(u.timestamp, date);
        is(u.get('timestamp'), date.getTime());
        var date2epoch = 1254816383000;
        var date2 = new Date(date2epoch);
        u.timestamp = date2;
        is(u.get('timestamp'), date2epoch);
        /*
        ok(!u.data);
        u.data = {'hoge': 'huga'};
        is(u.data.hoge, 'huga');
        */
        u.save().next(function() {
            is(u.other, 'hogehoge');
            d.call();
        });
    }).error(function(e) { console.log(e) });
}, 6, 1000).

test('Model transaction', function(d) {
    var User = Model({
        table: 'users',
        primaryKeys: ['uid'],
        fields: {
            'uid'        : 'INTEGER PRIMARY KEY',
            name : 'TEXT UNIQUE',
            num : 'INTEGER'
        }
    }, (new Database('testuserdb3')));
    User.dropTable().next(User.initialize).next(function() {
        // Database.debugMessage = true;
        var num = 0, afterSaveNum = 0, beforeSaveNum = 0;
        var now = Date.now();
        User.afterSave = function() {
            afterSaveNum++;
        }
        User.beforeSave = function() {
            beforeSaveNum++;
        }
        User.transaction(function() {
            for (var i = 0;  i < 10; i++) {
                var u = new User({num: i, name: 'name' + i});
                if (i == 3) {
                    var u2 = new User({name: 'name' + 2});
                    u2.save().error(function(e) {
                        ok(e, 'catch error2');
                    });
                }
                u.save().next(function(res) {
                    num++;
                }).next(function(res) {
                    num++;
                });
            }
            var u3 = new User({name: 'name' + 3});
            u3.save().next(function(n) {
                ok(false, 'don"t call this');
            }).error(function(e) {
                ok(e, 'catch error3');
                return 'okk';
            }).next(function(r) {
                equals('okk', r, 'get chainback success');
                num++;
            }) ;
        }).next(function() {
            User.count().next(function(c) {
                equals(c, 10);
                equals(num, 21);
                equals(afterSaveNum, 10);
                equals(beforeSaveNum, 12);
                p(Date.now() - now);
                d.call();
            });
        });
    });
}, 7, 1000).

test('finished', function(d) {
    ok(true, 'finished!!!');
    d.call();
}).

error(function(e) {
    console.log('error' + e.toString());
    throw(e);
});


