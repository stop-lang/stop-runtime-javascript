"use strict";

var expect = require('chai').expect;

const stop = require('stop');
const stopRuntime = require('../src/index');

describe('Stop', function() {
    describe('instance', function() {
        it('should create a stop instance based on an input string', function(done) {
        	let stopTestContent = `
start One {
    -> Two
}

Two {
    string four <- Four
    -> Three
}

Four <- string {

}

Five <- [string] {

}

Six {
    string four <- Four
}

GetSix <- [Six]{

}

stop Three {
    string four
    [string] five <- Five
    [Six] six <- GetSix
}
        	`;
            
        	expect(function(){
        		let stopInstance = new stop.Stop(stopTestContent);

                let impl = {};
                impl.buildStateInstance = function(implementationInstance) {
                    return implementationInstance;
                };
                impl.buildImplementationInstance = function(stateInstance) {
                    return stateInstance;
                };
                impl.execute = function(implementationInstance, execution, resolve, reject) {
                    if (implementationInstance.state.name == "One"){
                        resolve(new stop.Stop.models.StateInstance(stopInstance.states["Two"], {}));
                    }else if (implementationInstance.state.name == "Two"){
                        let four = implementationInstance.properties["four"];
                        resolve(new stop.Stop.models.StateInstance(stopInstance.states["Three"], {four: four}));
                    }else {
                        resolve(null);
                    }
                };
                impl.executeAndReturnValue = function(implementationInstance, execution, resolve, reject) {
                    if (implementationInstance.state.name == "Four"){
                        resolve("testString");
                    }
                };
                impl.executeAndReturnCollection = function(implementationInstance, execution, resolve, reject) {
                    if (implementationInstance.state.name == "Five"){
                        resolve(["one", "two", "three"]);
                    }else if (implementationInstance.state.name == "GetSix"){
                        var sixes = [new stop.Stop.models.StateInstance(stopInstance.states["Six"], {})];
                        resolve(sixes);
                    }
                };
                impl.enqueue = function(implementationInstance, delayInSeconds){};
                impl.log = function(message){};

                let runtime = new stopRuntime.StopRuntime(stopInstance, impl);
                let state = stopInstance.states["One"];

                let startInstance = new stop.Stop.models.StateInstance(state, {});
                runtime.start(startInstance, function(resultInstance){
                    expect(resultInstance.properties["four"]).to.eq("testString");
                    expect(resultInstance.properties["five"].length).to.eq(3);
                    expect(resultInstance.properties["six"].length).to.eq(1);
                    done();
                },
                function(error){
                    done(error);
                });
        	}).to.not.throw();
        });
    });
});