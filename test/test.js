
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
    ok(db instanceof Database, 'instanceof');
    var db1 = new Database();
    equals(db.db, db1.db, 'db cache');
    var db2 = new Database('foo');
    ok(db2, 'db2');
    ok(db2 instanceof Database, 'instanceof');
    ok(db != db2, 'db not eq');
    ok(db.db != db2.db, 'db not eq raw db');
    d.call();
}, 7).

test("utils", function(d){
    var Util = Database.Util;
    var i = 0;
    var obj = {
        getName: function() {
            i++;
            return this.name;
        },
        name: 'foo'
    };
    is('foo', obj.getName());
    Util.beforeTrigger(obj, 'getName', function() {
        is('foo', obj.name);
        is(1, i);
        i++;
        obj.name = 'bar';
    });
    Util.afterTrigger(obj, 'getName', function() {
        is('bar', obj.name);
        is(3, i);
        i++;
    });
    is('bar', obj.getName());

    obj.name = 'foo';
    i = 0;
    Util.beforeTrigger(obj, 'getName', function() {
        is('foo', obj.name);
        is(0, i);
        i++;
    });
    Util.afterTrigger(obj, 'getName', function() {
        is('bar', obj.name);
        is(4, i);
    });
    is('bar', obj.getName());
    d.call();
}, 15).

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
        }, false),
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

test('Model', function(d) {
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
    // Database.debugMessage = true;
    var db = new Database('testuserdb');
    User.__defineGetter__('database', function() { return db; });
    User.initialize().next(User.dropTable).next(function() {
        ok(true, 'drop table');
    }).next(User.createTable).next(function(r) {
        ok(User.getInfo('name'), 'create table');
        var u = new User({
            name: 'nadek'
        });
        equals(u.uid, undefined, 'uid');
        equals(u.name, 'nadek', 'name');
        User.findFirst().next(function(r) {
            ok(!r, 'findFirst undefined');
        }).next(function() { return u.save() }).next(function() {
            equals(u.uid, 1, 'uid');
            equals(u.name, 'nadek', 'name');
            u.name = 'nadeko';
            u.save().next(function(r) {
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
                    u3.save().next(function() { return User.count() }).next(function(c) {
                        equals(c, 2, 'count total');
                        equals(u3.uid, 2, 'uid');
                        equals(u3.name, 'yuno', 'name');
                        User.findFirst({order: 'uid asc'}).next(function(fUser) {
                            equals(fUser.uid, 1);
                            equals(fUser.name, 'nadeko');
                            User.find({
                                where: { name: 'yuno' }
                            }).next(function(res) {
                                ok(res.length == 1)
                                var r = res[0];
                                ok(r instanceof User);
                                equals(r.uid, 2);
                                equals(r.name, 'yuno');
                                r.remove().next(function() { return User.count(); }).next(function(c) {
                                    equals(c, 1, 'count total');
                                    d.call();
                                });
                            });
                        });
                    });
                });
            }); // u.save
        }); // u.save
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
    var db = new Database('testuserdb3');
    var User = Model({
        table: 'users',
        primaryKeys: ['uid'],
        fields: {
            'uid'        : 'INTEGER PRIMARY KEY',
            name : 'TEXT UNIQUE',
            num : 'INTEGER'
        }
    }, db);
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
        db.transaction(function() {
            for (var i = 0;  i < 5; i++) {
                var u = new User({num: i, name: 'name' + i});
                if (i == 3) {
                    var u2 = new User({name: 'name' + 2});
                    u2.save().error(function(e) {
                        ok(e, 'catch error2');
                    });
                }
                u.save().next(function(res) {
                    num++;
                    return res;
                }).next(function(res) {
                    ok(res.name, 'transaction save chain ok:' + res.name);
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
                equals(c, 5);
                equals(num, 11);
                equals(afterSaveNum, 5);
                equals(beforeSaveNum, 7);
                // p(Date.now() - now);
                User.count({name: 'name3'}).next(function(c) {
                    equals(c, 1, 'count with where');
                    d.call();
                });
            });
        });
    });
}, 13, 2000).

test('finished', function(d) {
    ok(true, 'finished!!!');
    d.call();
}).

error(function(e) {
    console.log('error' + e.toString());
    throw(e);
});


