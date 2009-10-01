
Deferred.define();

Deferred.test = function(name, t) {
    var d = new Deferred();
    setTimeout(function() {
        Deferred.test.setup().next(function() {
            test(name, function() {
                try {
                    t(d);
                } finally {
                    // Deferred.test.teardown();
                }
            });
        });
    }, 0);
    return d;
};

Deferred.test.setup = function() {
    return next(function() {
        console.log('setup');
    });
};

Deferred.test.teardown = function(d) {
    d.call();
};

Deferred.register('test', Deferred.test);

Deferred.
test("initialize", function(d){
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
    d.call();
}).

test('2', function(d) {
    d.call();
}).

test('3', function(d) {
    d.call();
}).

test('finished', function(d) {
    ok(true, 'finished');
    d.call();
    console.log(1);
}).

error(function(e) {
    console.log('error' + e.toString());
    throw(e);
});


