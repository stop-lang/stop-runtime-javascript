var StopRuntimeErrorException = function(errorStateInstance, contextStateInstance){
	this.errorStateInstance = errorStateInstance;
	this.contextStateInstance = contextStateInstance;
};
StopRuntimeErrorException.prototype.constructor = StopRuntimeErrorException;

module.exports = StopRuntimeErrorException;
