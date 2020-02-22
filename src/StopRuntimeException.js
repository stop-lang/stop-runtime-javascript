var StopRuntimeException = function(message){
    this.message = message;
};
StopRuntimeException.prototype.constructor = StopRuntimeException;

module.exports = StopRuntimeException;