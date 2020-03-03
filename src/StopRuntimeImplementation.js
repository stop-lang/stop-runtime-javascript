var StopRuntimeImplementation = function(){
};
StopRuntimeImplementation.prototype.constructor = StopRuntimeImplementation;

StopRuntimeImplementation.prototype.buildStateInstance = function(implementationInstance) {};
StopRuntimeImplementation.prototype.buildImplementationInstance = function(stateInstance) {};
StopRuntimeImplementation.prototype.execute = function(implementationInstance, execution, resolve, reject) {};
StopRuntimeImplementation.prototype.executeAndReturnValue = function(implementationInstance, execution, resolve, reject) {};
StopRuntimeImplementation.prototype.executeAndReturnCollection = function(implementationInstance, execution, resolve, reject) {};
StopRuntimeImplementation.prototype.enqueue = function(implementationInstance, delayInSeconds){};
StopRuntimeImplementation.prototype.log = function(message){};

module.exports = StopRuntimeImplementation;