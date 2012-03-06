var it = require("it"), comb = require("comb"), assert = require("assert"), nools = require("../index");

it.describe("nools", function (it) {
    it.describe("#flow", function (it) {
        it.should("create a flow", function (next) {
            var flow = nools.flow("test flow");
            assert.isNotNull(flow);
            assert.instanceOf(flow, nools.Flow);
            assert.equal("test flow", flow.name);
            next();
        });
    });
});

it.describe("Flow", function (it) {


    it.describe("#rule", function (it) {
        var called = 0;
        var flow = nools.flow("test flow");
        it.should("create a rule", function (next) {
            flow.rule("test rule", [String, "s", "s == 'hello'"], function (str1) {
                called++;
            });
            assert.isTrue(flow.containsRule("test rule"));
            next();
        });

        it.should("create a rule with joins properly", function (next) {
            flow.rule("test rule2", [
                [String, "s", "s == 'hello'"],
                [String, "s2", "s2 == 'world'"],
                [String, "s3", "s3 == 'Hi'"]
            ], function (str1) {
                called++;
            });
            assert.isTrue(flow.containsRule("test rule2"));
            next();
        });

        it.should("create a rules that are dependent on eachother properly", function (next) {
            var s1, s2, s3, s4, s5;
            flow.rule("test rule3", [
                [String, "s", "s == 'hello'"],
                [String, "s2", "s2 == 'world'"],
                [String, "s3", "s3 == 'Hi'"]
            ], function (str1) {
                called++;
            });
            assert.isTrue(flow.containsRule("test rule3"));

            flow.rule("test rule4", [
                [String, "s1"],
                [String, "s2", "s2 == 'world' && s1 == 'hello' "],
                [String, "s3", "s3 == 'Hi'"],
                [String, "s4", "s4 == 'what'"],
                [String, "s5", "s5 == 'for'"]
            ], function (str1) {
                called++;
            });
            assert.isTrue(flow.containsRule("test rule4"));
            next();
        });

    });
    it.describe("simple rule", function (it) {

        var called = 0;
        var HelloFact = comb.define(null, {
            instance:{
                value:true
            }
        });

        var flow = nools.flow("hello world flow", function (flow) {
            flow.rule("hello rule", [HelloFact, "h"], function () {
                called++;
            });
        });

        it.should("call hello world rule", function (next) {
            var session = flow.getSession();
            session.assert(new HelloFact());
            session.match();
            assert.equal(called, 1);
            next();
        });

    });

    it.describe("fibonocci", function (it) {

        var Fibonacci = comb.define(null, {
            instance:{
                constructor:function (sequence, value) {
                    this.sequence = sequence;
                    this.value = value || -1;
                }
            }
        });
        var result = null;
        var flow = nools.flow("Fibonacci Flow", function (flow) {

            flow.rule("Recurse", {priority:1}, [
                [Fibonacci, "f", "f.value == -1 && f.sequence != 1"]
            ], function (facts) {
                var f2 = new Fibonacci(facts.f.sequence - 1);
                this.assert(f2);
            });

            flow.rule("Bootstrap", [Fibonacci, "f", "f.value == -1 && (f.sequence == 1 || f.sequence == 2)"], function (facts, flow) {
                facts.f.value = 1;
                this.modify(facts.f);
            });

            flow.rule("Calculate", [
                [Fibonacci, "f1", "f1.value != -1", {sequence:"s1"}],
                [Fibonacci, "f2", "f2.value != -1 && f2.sequence == s1 + 1", {sequence:"s2"}],
                [Fibonacci, "f3", "f3.value == -1 && f3.sequence == s2 + 1"]
            ], function (facts) {
                facts.f3.value = facts.f1.value + facts.f2.value;
                result = facts.f3.value;
                this.modify(facts.f3);
                this.retract(facts.f1);
            });
        });


        it.afterEach(function (next) {
            result = [];
            next();
        });


        it.should("calculate Fibonacci of 10", function (next) {
            var session = flow.getSession(new Fibonacci(10));
            session.match().then(function () {
                session.dispose();
                assert.equal(result, 55);
                next();
            });
        });

        it.should("calculate Fibonacci of 150", function (next) {
            var session = flow.getSession(new Fibonacci(150));
            session.match().then(function () {
                session.dispose();
                assert.equal(result, 9.969216677189305e+30);
                next();
            });
        });

    });

    it.describe("diagnosis", function (it) {

        var Patient = comb.define(null, {
            instance:{
                constructor:function (name, fever, spots, rash, soreThroat, innoculated) {
                    this.name = name;
                    this.fever = fever;
                    this.spots = spots;
                    this.rash = rash;
                    this.soreThroat = soreThroat;
                    this.innoculated = innoculated;
                }
            }
        });

        var Diagnosis = comb.define(null, {
            instance:{
                constructor:function (name, diagnosis) {
                    this.name = name;
                    this.diagnosis = diagnosis;
                }
            }
        });

        var Treatment = comb.define(null, {
            instance:{
                constructor:function (name, treatment) {
                    this.name = name;
                    this.treatment = treatment;
                }
            }
        });

        var results = [];
        var flow = nools.flow("Diagnosis", function (flow) {

            flow.rule("Measels", [
                [Patient, "p", "p.fever == 'high' && p.spots == true && p.innoculated == true", {name:"n"}],
                ["not", Diagnosis, "d", "d.name == n && d.diagnosis == 'allergy'"]
            ],
                function (facts) {
                    var name = facts.n;
                    this.assert(new Diagnosis(name, "measles"));
                });

            flow.rule("Allergy1", [
                [Patient, "p", "p.spots == true", {name:"n"}],
                ["not", Diagnosis, "d", "d.name == n && d.diagnosis == 'measles'"]
            ], function (facts) {
                var name = facts.n;
                this.assert(new Diagnosis(name, "allergy"));
            });

            flow.rule("Allergy2", [Patient, "p", "p.rash == true", {name:"n"}], function (facts) {
                var name = facts.n;
                this.assert(new Diagnosis(name, "allergy"));
            });

            flow.rule("Flu", [Patient, "p", "p.soreThroat == true && (p.fever == 'mild' || p.fever == 'high')", {name:"n"}], function (facts) {
                var name = facts.n;
                this.assert(new Diagnosis(name, "flu"));
            });

            flow.rule("Penicillin", [Diagnosis, "d", "d.diagnosis == 'measles'", {name:"n"}], function (facts) {
                var name = facts.n;
                this.assert(new Treatment(name, "penicillin"));
            });

            flow.rule("Allergy Pills", [Diagnosis, "d", "d.diagnosis == 'allergy'", {name:"n"}], function (facts) {
                var name = facts.n;
                this.assert(new Treatment(name, "allegryShot"));
            });

            flow.rule("Bed Rest", [Diagnosis, "d", "d.diagnosis == 'flu'", {name:"n"}], function (facts) {
                var name = facts.n;
                this.assert(new Treatment(name, "bedRest"));
            });

            flow.rule("Collect", [Treatment, "t"], function (facts) {
                results.push(facts.t);
            })

        });

        it.afterEach(function (next) {
            results = [];
            next();
        });

        it.should("treat properly", function (next) {
            var session = flow.getSession();
            session.assert(new Patient("Fred", "none", true, false, false, false));
            session.assert(new Patient("Joe", "high", false, false, true, false));
            session.assert(new Patient("Bob", "high", true, false, false, true));
            session.assert(new Patient("Tom", "none", false, true, false, false));
            //flow.print();
            session.match().then(function () {
                session.dispose();
                assert.deepEqual(results, [
                    {"name":"Tom", "treatment":"allegryShot"},
                    {"name":"Bob", "treatment":"penicillin"},
                    {"name":"Joe", "treatment":"bedRest"},
                    {"name":"Fred", "treatment":"allegryShot"}
                ]);
                next();
            })
        });

        it.should("treat properly on consecutive runs", function (next) {
            var session = flow.getSession();
            session.assert(new Patient("Tom", "none", true, false, false, false));
            session.assert(new Patient("Bob", "high", false, false, true, false));
            session.assert(new Patient("Joe", "high", true, false, false, true));
            session.assert(new Patient("Fred", "none", false, true, false, false));
            //flow.print();
            session.match().then(function () {
                session.dispose();
                assert.deepEqual(results, [
                    {"name":"Fred", "treatment":"allegryShot"},
                    {"name":"Joe", "treatment":"penicillin"},
                    {"name":"Bob", "treatment":"bedRest"},
                    {"name":"Tom", "treatment":"allegryShot"}
                ]);
                next();
            })
        });
    });

});



