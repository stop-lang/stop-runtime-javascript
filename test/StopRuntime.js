"use strict";

var expect = require('chai').expect;

const stop = require('stop');
const stopRuntime = require('../src/index');

describe('Stop', function() {
    describe('instance', function() {
        it('should create a stop instance based on an input string', function() {
        	let stopTestContent = `
start One {
    -> Two
}

Two {
    -> Three
}

stop Three {

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
                impl.execute = function(implementationInstance, execution) {
                    if (implementationInstance.state.name == "One"){
                        return new stop.Stop.models.StateInstance(stopInstance.states["Two"], {});
                    }
                    if (implementationInstance.state.name == "Two"){
                        return new stop.Stop.models.StateInstance(stopInstance.states["Three"], {});
                    }
                    return null;
                };
                impl.executeAndReturnValue = function(implementationInstance, execution) {};
                impl.executeAndReturnCollection = function(implementationInstance, execution) {};
                impl.enqueue = function(implementationInstance, delayInSeconds){};
                impl.log = function(message){};

                let runtime = new stopRuntime.StopRuntime(stopInstance, impl);
                let state = stopInstance.states["One"];

                let startInstance = new stop.Stop.models.StateInstance(state, {});
                runtime.start(startInstance);
        	}).to.not.throw();
        });
    });
});