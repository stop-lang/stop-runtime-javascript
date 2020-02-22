var StopRuntimeImplementation = function(){
};
StopRuntimeImplementation.prototype.constructor = StopRuntimeImplementation;

StopRuntimeImplementation.prototype.buildStateInstance = function(implementationInstance) {};
StopRuntimeImplementation.prototype.buildImplementationInstance = function(stateInstance) {};
StopRuntimeImplementation.prototype.execute = function(implementationInstance, execution) {};
StopRuntimeImplementation.prototype.executeAndReturnValue = function(implementationInstance, execution) {};
StopRuntimeImplementation.prototype.executeAndReturnCollection = function(implementationInstance, execution) {};
StopRuntimeImplementation.prototype.enqueue = function(implementationInstance, delayInSeconds){};
StopRuntimeImplementation.prototype.log = function(message){};

module.exports = StopRuntimeImplementation;