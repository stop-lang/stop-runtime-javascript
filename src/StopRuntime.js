const stop = require('stop');
const StopRuntimeException = require("./StopRuntimeException");
const StopRuntimeErrorException = require("./StopRuntimeErrorException");

const REFERENCE_DELIMETER = ".";

function StopRuntime(stop, implementation){
	this.stop = stop;
	this.implementation = implementation;
	this.currentStateInstance = null;
	this.orderedStates = [];
	this.packageImplementations = {};
	this.packageImplementationRuntimeImplementationExecution = {
		queue: function(implementationInstance){
            this.packageImplementationRuntimeImplementationExecutionQueue(implementationInstance);
		},
		log: function(message){
            this.packageImplementationRuntimeImplementationExecutionLog(message);
		}
	};
}
StopRuntime.prototype.constructor = StopRuntime;

StopRuntime.prototype.start = function(toImplementationInstance) {
    var to = this.implementation.buildStateInstance(toImplementationInstance);
    return this.startInstance(to);
};

StopRuntime.prototype.queue = function(implementationInstance) {
    if (this.currentStateInstance == null){
        throw new StopRuntimeException("No current state instance");
    }

    var queue = this.implementation.buildStateInstance(implementationInstance);

    if (queue == null){
        throw new StopRuntimeException("queue state instance must be defined");
    }

    var queueState = this.currentStateInstance.state.enqueues[queue.state.name];

    if (queueState == null){
        throw new StopRuntimeException("Could not find queue " + queue.state.name);
    }

    if(!queueState.isQueue()){
        throw new StopRuntimeException("Invalid queue state");
    }

    queue.validateProperties(false);

    this.implementation.enqueue(implementationInstance);
};

StopRuntime.prototype.log = function(message){
    this.implementation.log(message);
};

StopRuntime.prototype.addPackageImplementation = function(packageName, packageImplementation ){
    this.packageImplementations[packageName] = packageImplementation;
};

StopRuntime.prototype.removePackageImplementation = function(packageName){
    this.packageImplementations[packageName] = undefined;
};

StopRuntime.prototype.startInstance = function(to) {
    orderedStates = [];

    if (to == null){
        throw new StopRuntimeException("To state instances must be defined");
    }

    if (!to.state.start && !to.state.queue){
        throw new StopRuntimeException("Invalid start state");
    }

    var resultInstance = this.execute(to);

    if (resultInstance!=null){
        if (!resultInstance.state.stop){
            throw new StopRuntimeException(resultInstance.state.name  + " is not a stopping state!");
        }
        return this.implementation.buildImplementationInstance(resultInstance);
    }

    throw new StopRuntimeException("No ending state!");
};

StopRuntime.prototype.execute = function(stateInstance) {
    try {
        this.gatherDynamicProperties(stateInstance);
    }catch(errorException){
        var errorState = errorException.errorStateInstance;
        var contextState = errorException.contextStateInstance;

        if (errorState == null){
            throw new StopRuntimeException("Error state was undefined in StopRuntimeErrorException during dynamic property gathering");
        }

        if (contextState == null){
            throw new StopRuntimeException("Context state was undefined in StopRuntimeErrorException during dynamic property gathering");
        }

        return this.transition(contextState, errorState);
    }

    stateInstance.validateProperties();

    this.currentStateInstance = stateInstance;

    this.orderedStates.push(stateInstance);

    var implementationInstance = this.implementation.buildImplementationInstance(stateInstance);

    try {
        var nextImplementationInstance = this.executeWithPackageImplementations(implementationInstance);

        if (nextImplementationInstance != null) {
            var nextStateInstance = this.implementation.buildStateInstance(nextImplementationInstance);
            return this.transition(stateInstance, nextStateInstance);
        } else {
            return stateInstance;
        }
    } catch (errorException) {
        var errorStateInstance = errorException.errorStateInstance;
        return this.transition(stateInstance, errorStateInstance);
    }
};

StopRuntime.prototype.transition = function(from, to) {
    if (from == null || to == null){
        throw new StopRuntimeException("From and to state instances must be defined");
    }

    from.validateProperties();

    var errorState = from.state.errors[to.state.name];
    var transitionState = from.state.transitions[to.state.name];

    if ((errorState == null) && (transitionState == null)){
        throw new StopRuntimeException("Could not find state to transition to called " + to.state.name);
    }

    return this.execute(to);
};

StopRuntime.prototype.gatherDynamicProperties = function(to) {
    var orderedDynamicProperties = to.state.getOrderedProperties();

    for (var i in orderedDynamicProperties){
        var property = orderedDynamicProperties[i];
        if (property != null){
            if (property.providerState != null){
                var providerState = property.providerState;
                if (property.optional && !this.shouldMapProvider(to, property, providerState)){
                    continue;
                }
                var providerStateInstance = this.mapStateInstancePropertiesToProvider(to, providerState, property.providerStateMapping);
                this.gatherDynamicProperties(providerStateInstance);
                providerStateInstance.validateProperties();
                var providerImplementationInstance = this.implementation.buildImplementationInstance(providerStateInstance);

                try {
                    var value = null;

                    if (providerState.returnCollection) {
                        var collection = this.executeAndReturnCollectionWithPackageImplementations(providerImplementationInstance);

                        if (providerState.returnState != null) {
                            var stateInstances = [];
                            if(collection!=null) {
                                for (var j in collection) {
                                    var collectionElement = collection[j];
                                    var si = this.implementation.buildStateInstance(collectionElement);
                                    stateInstances.push(si);
                                }
                            }
                            value = stateInstances;
                        } else {
                            value = collection;
                        }
                    } else {
                        var returnValue = this.executeAndReturnValueWithPackageImplementations(providerImplementationInstance);

                        if (returnValue!=null) {
                            if (providerState.returnState != null) {
                                value = this.implementation.buildStateInstance(returnValue);
                            } else {
                                value = returnValue;
                            }
                        }
                    }

                    if (value != null) {
                        if (value instanceof Array){
                            var instances = value;
                            for (var k in instances){
                                var instance = instances[k];
                                if (instance instanceof stop.Stop.models.StateInstance){
                                    this.gatherDynamicProperties(instance);
                                }
                            }
                        }else if(value instanceof stop.Stop.models.StateInstance){
                            this.gatherDynamicProperties(value);
                        }
                        to.properties[property.name] = value;
                    }
                }catch(errorException){
                    throw new StopRuntimeErrorException(errorException.errorStateInstance, providerStateInstance);
                }
            }
        }
    }

    for ( var key in to.properties ){
        var value = to.properties[key];
        if (value != null){
            if (value instanceof Array){
                var instances = value;
                for (var i in instances){
                    var instance = instances[i];
                    if (instance instanceof stop.Stop.models.StateInstance){
                        var collectionStateInstance = instance;
                        this.gatherDynamicProperties(collectionStateInstance);
                    }
                }
            } else if (value instanceof stop.Stop.models.StateInstance){
                var propertyStateInstance = value;
                this.gatherDynamicProperties(propertyStateInstance);
            }
        }
    }
}

StopRuntime.prototype.mapStateInstancePropertiesToProvider = function(stateInstance, providerState, providerMapping){
    var providerProperties = {};

    for (var key in providerState.properties){
        var field = key;

        if (providerMapping!=null){
            if (providerMapping[field]){
                field = providerMapping[field];
            }
        }

        if (field.indexOf(REFERENCE_DELIMETER)>=0){
            // Reference
            var value = this.getValueForReference(stateInstance, field);
            if (value!=null){
                providerProperties[key] = value;
            }
        }else {
            // Value
            if (stateInstance.properties[field]) {
                providerProperties[key] = stateInstance.properties[field];
            }
        }
    }

    return new stop.Stop.models.StateInstance(providerState, providerProperties);
};

StopRuntime.prototype.getValueForReference = function(stateInstance, reference){
    var parts = reference.split(REFERENCE_DELIMETER);
    var valueName = parts[0];

    if (valueName != null){
        var value = stateInstance.properties[valueName];
        if (value != null){
            if (parts.length > 1){
                if ( value instanceof stop.Stop.models.StateInstance){
                    var valueStateInstance = value;
                    var newParts = [];
                    for (var i = 1; i < parts.length; i++) {
                        newParts.push(parts[i]);
                    }
                    var newReference = newParts.join(REFERENCE_DELIMETER);
                    return this.getValueForReference(valueStateInstance, newReference);
                }
            }else {
                return value;
            }
        }
    }

    return null;
};

StopRuntime.prototype.shouldMapProvider = function(stateInstance, stateInstanceProperty, providerState){
    for (var key in providerState.properties){
        var providerStatePropertyEntryProperty = providerState.properties[key];
        if (providerStatePropertyEntryProperty!= null){
            if (providerStatePropertyEntryProperty.providerState!=null){
                continue;
            }
        }
        var propertyName = key;
        if (stateInstanceProperty.providerStateMapping != null){
            if (stateInstanceProperty.providerStateMapping[propertyName]){
                propertyName = stateInstanceProperty.providerStateMapping[propertyName];
                propertyName = this.getRootFromPropertyName(propertyName);
            }
        }
        var stateProperty = stateInstance.state.properties[propertyName];
        if (stateProperty != null){
            if ((stateProperty.providerState==null)
                    && !providerStatePropertyEntryProperty.optional
                    && (stateInstance.properties[propertyName]==null)){
                return false;
            }
        }else{
            return false;
        }
    }
    return true;
};

StopRuntime.prototype.executeWithPackageImplementations = function(implementationInstance)  {
    if (this.packageImplementations.length > 0){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;

        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                var returnStateInstance = packageImplementation.execute(stateInstance, this.packageImplementationRuntimeImplementationExecution);
                if (returnStateInstance!=null) {
                    return this.implementation.buildImplementationInstance(returnStateInstance);
                }
                return null;
            }
        }
    }

    return this.implementation.execute(implementationInstance, this);
};

StopRuntime.prototype.executeAndReturnValueWithPackageImplementations = function(implementationInstance) {
    if (this.packageImplementations.length > 0){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;
        
        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                var returnObject = packageImplementation.executeAndReturnValue(stateInstance, this.packageImplementationRuntimeImplementationExecution);
                return returnObject;
            }
        }
    }

    return this.implementation.executeAndReturnValue(implementationInstance, this);
};

StopRuntime.prototype.executeAndReturnCollectionWithPackageImplementations = function(implementationInstance) {
    if (!this.packageImplementations.isEmpty()){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;
        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                var returnCollection = packageImplementation.getValue().executeAndReturnCollection(stateInstance, this.packageImplementationRuntimeImplementationExecution);
                return returnCollection;
            }
        }
    }

    return this.implementation.executeAndReturnCollection(implementationInstance, this);
};

StopRuntime.prototype.packageImplementationRuntimeImplementationExecutionQueue = function(stateInstance) {
    this.queue(this.implementation.buildImplementationInstance(stateInstance));
};

StopRuntime.prototype.packageImplementationRuntimeImplementationExecutionLog = function(message) {
    this.log(message);
};

StopRuntime.prototype.getRootFromPropertyName = function(propertyName){
    var rootPropertyName = propertyName;

    if (propertyName.indexOf(REFERENCE_DELIMETER)>= 0) {
        var parts = propertyName.split(REFERENCE_DELIMETER);
        if (parts.length > 1) {
            rootPropertyName = parts[0];
        }
    }
    return rootPropertyName;
};

module.exports = StopRuntime;