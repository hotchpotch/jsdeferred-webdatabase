
Deferred.define();

Deferred.test = function(name, t) {
    var d = new Deferred();
    setTimeout(function() {
        var setupDeferred = new Deferred(), teardownDeferred = new Deferred();
        var setup = Deferred.test.setup, teardown = Deferred.test.teardown;
        setupDeferred.next(function() {
            setTimeout(function() {
                test(name, function() {
                    try {
                        t(teardownDeferred);
                    } catch(e) {
                        ok(false, 'test error: ' + e.toString());
                        teardownDeferred.call();
                    }
                });
            }, 0);
            return teardownDeferred;
        }).next(function() {
            teardown(d);
        });
        setup(setupDeferred);
    }, 0);
    return d;
};

//var i = 0;
Deferred.test.setup = function(d) {
//    console.log('setup' + (++i));
    d.call();
};

Deferred.test.teardown = function(d) {
//    console.log('teardown' + i);
    d.call();
};

Deferred.prototype.method = function(name) {
    return d[name]();
};

Deferred.register('test', Deferred.test);

Deferred.
test("openDatabase", function(d){
    var db = WebDatabase.openDatabase();
    ok(db, 'db');
    var db1 = WebDatabase.openDatabase();
    equals(db, db1, 'db cache');
    var db2 = WebDatabase.openDatabase('foo');
    ok(db, 'db2');
    d.call();
}).

test('Model init', function(d) {
    window.User = WebDatabase.Model({
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
        d.call();
    });
}).

test('3', function(d) {
    d.call();
}).

test('finished', function(d) {
    ok(true, 'finished');
    d.call();
}).

error(function(e) {
    console.log('error' + e.toString());
    throw(e);
});


