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
		queue: function(implementationInstance, resolve, reject){
            this.packageImplementationRuntimeImplementationExecutionQueue(implementationInstance, resolve, reject);
		},
		log: function(message){
            this.packageImplementationRuntimeImplementationExecutionLog(message);
		}
	};
}
StopRuntime.prototype.constructor = StopRuntime;

StopRuntime.prototype.start = function(toImplementationInstance, resolve, reject) {
    var to = this.implementation.buildStateInstance(toImplementationInstance);
    this.startInstance(to, resolve, reject);
};

StopRuntime.prototype.queue = function(implementationInstance, resolve, reject) {
    if (this.currentStateInstance == null){
        reject(new StopRuntimeException("No current state instance"));
        return;
    }

    var queue = this.implementation.buildStateInstance(implementationInstance);

    if (queue == null){
        reject( new StopRuntimeException("queue state instance must be defined"));
        return;
    }

    var queueState = this.currentStateInstance.state.enqueues[queue.state.name];

    if (queueState == null){
        reject( new StopRuntimeException("Could not find queue " + queue.state.name));
        return;
    }

    if(!queueState.isQueue()){
        reject( new StopRuntimeException("Invalid queue state"));
        return;
    }

    queue.validateProperties(false);

    this.implementation.enqueue(implementationInstance);

    resolve();
};

StopRuntime.prototype.log = function(message){
    this.implementation.log(message);
};

StopRuntime.prototype.addPackageImplementation = function(packageName, packageImplementation){
    this.packageImplementations[packageName] = packageImplementation;
};

StopRuntime.prototype.removePackageImplementation = function(packageName){
    this.packageImplementations[packageName] = undefined;
};

StopRuntime.prototype.startInstance = function(to, resolve, reject) {
    this.orderedStates = [];

    if (to == null){
        reject(new StopRuntimeException("To state instances must be defined"));
        return;
    }

    if (!to.state.start && !to.state.queue){
        reject(new StopRuntimeException("Invalid start state"));
        return;
    }

    var runtime = this;
    this.execute(to, 
        function(resultInstance){
            if (resultInstance!=null){
                if (!resultInstance.state.stop){
                    reject(new StopRuntimeException(resultInstance.state.name  + " is not a stopping state!"));
                }else{
                    resolve(runtime.implementation.buildImplementationInstance(resultInstance));
                }
            }else{
                reject(new StopRuntimeException("No ending state!"));
            }
        },
        reject
    );
};

StopRuntime.prototype.execute = function(stateInstance, resolve, reject) {
    var runtime = this;
    this.gatherDynamicProperties(stateInstance, function(resolvedStateInstance){
        resolvedStateInstance.validateProperties();

        runtime.currentStateInstance = resolvedStateInstance;

        runtime.orderedStates.push(resolvedStateInstance);

        var implementationInstance = runtime.implementation.buildImplementationInstance(resolvedStateInstance);

        if (resolvedStateInstance.state.returnType){
            runtime.executeWithPackageImplementations(implementationInstance, 
            function(value){
                if(value == undefined){
                    value = null;
                }
                resolve(resolvedStateInstance, value);
            },
            reject);
        }else{
            runtime.executeWithPackageImplementations(implementationInstance, 
            function(nextImplementationInstance){
                if (nextImplementationInstance != null) {
                    var nextStateInstance = runtime.implementation.buildStateInstance(nextImplementationInstance);
                    runtime.transition(resolvedStateInstance, nextStateInstance, resolve, reject);
                } else {
                    resolve(resolvedStateInstance);
                }
            },
            reject);
        }
    },
    reject);
};

StopRuntime.prototype.transition = function(from, to, resolve, reject) {
    if (from == null || to == null){
        reject(new StopRuntimeException("From and to state instances must be defined"));
        return;
    }

    from.validateProperties();

    var errorState = from.state.errors[to.state.name];
    var transitionState = from.state.transitions[to.state.name];

    if ((errorState == null) && (transitionState == null)){
        reject(new StopRuntimeException("Could not find state to transition to called " + to.state.name));
        return;
    }

    this.execute(to, resolve, reject);
};

StopRuntime.prototype.gatherDynamicProperty = function(to, property, resolve, reject){
    if (property && (property.providerState != null)){
        var providerState = property.providerState;
        if (property.optional && !this.shouldMapProvider(to, property, providerState)){
            resolve(to);
            return;
        }
        var providerStateInstance = this.mapStateInstancePropertiesToProvider(to, providerState, property.providerStateMapping);
        var self = this;
        this.gatherDynamicProperties(providerStateInstance, function(resolvedProviderStateInstance){
            resolvedProviderStateInstance.validateProperties();
            var providerImplementationInstance = self.implementation.buildImplementationInstance(resolvedProviderStateInstance);

            if (providerState.returnCollection) {
                self.executeAndReturnCollectionWithPackageImplementations(providerImplementationInstance, function(collection){
                    if (providerState.returnState != null) {
                        var stateInstances = [];
                        if(collection!=null) {
                            for (var j in collection) {
                                var collectionElement = collection[j];
                                var si = self.implementation.buildStateInstance(collectionElement);
                                stateInstances.push(si);
                            }

                            var nextCollectionItem = function(stateInstanceCollection, index, resolve, reject){
                                var item = stateInstanceCollection[index];
                                self.gatherDynamicProperties(item, function(resolvedStateInstance){
                                    stateInstanceCollection[index] = resolvedStateInstance;
                                    if ((index+1) < stateInstanceCollection.length){
                                        nextCollectionItem(stateInstanceCollection, index+1, resolve, reject);
                                    } else {
                                        to.properties[property.name] = stateInstanceCollection;
                                        resolve(to);
                                    }
                                }, reject);
                            };

                            nextCollectionItem(stateInstances, 0, resolve, reject);
                        }else {
                            to.properties[property.name] = stateInstances;
                            resolve(to);
                        }
                    } else {
                        to.properties[property.name] = collection;
                        resolve(to);
                    }
                }, reject);
            } else {
                self.executeAndReturnValueWithPackageImplementations(providerImplementationInstance, function(returnValue){
                    var value = null;
                    if (returnValue!=null) {
                        if (providerState.returnState != null) {
                            value = self.implementation.buildStateInstance(returnValue);
                        } else {
                            value = returnValue;
                        }
                    }

                    if ((value != null) && (value instanceof stop.Stop.models.StateInstance)){
                        self.gatherDynamicProperties(value, function(resolvedValue){
                            to.properties[property.name] = value;
                            resolve(to); 
                        }, 
                        reject);
                    }else{
                        to.properties[property.name] = value;
                        resolve(to); 
                    }
                }, reject);
            }
        }, reject);
    }else{
        resolve(to);
    }
};

StopRuntime.prototype.nextProperty = function(orderedDynamicProperties, index, to, resolve, reject){
    var property = orderedDynamicProperties[index];
    var runtime = this;
    this.gatherDynamicProperty(to, property, function(resolvedStateInstance){
        if ((index+1) < orderedDynamicProperties.length){
            runtime.nextProperty(orderedDynamicProperties, index+1, resolvedStateInstance, resolve, reject);
        } else{
            resolve(resolvedStateInstance);
        }
    }, reject);
};

StopRuntime.prototype.gatherDynamicProperties = function(to, resolve, reject) {
    var orderedDynamicProperties = to.state.getOrderedProperties();

    if (orderedDynamicProperties.length == 0){
        resolve(to);
    }else{
        this.nextProperty(orderedDynamicProperties, 0, to, resolve, reject);
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

StopRuntime.prototype.executeWithPackageImplementations = function(implementationInstance, resolve, reject)  {
    if (this.packageImplementations.length > 0){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;

        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                var runtime = this;
                packageImplementation.execute(stateInstance, this.packageImplementationRuntimeImplementationExecution, 
                    function(returnStateInstance){
                        if (returnStateInstance!=null) {
                            resolve(runtime.implementation.buildImplementationInstance(returnStateInstance));
                        }else{
                            resolve(null);
                        }
                    },
                    function(error){
                        reject(error);
                    }
                );
                return;
            }
        }
    }

    this.implementation.execute(implementationInstance, this, resolve, reject);
};

StopRuntime.prototype.executeAndReturnValueWithPackageImplementations = function(implementationInstance, resolve, reject) {
    if (this.packageImplementations.length > 0){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;
        
        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                packageImplementation.executeAndReturnValue(stateInstance, this.packageImplementationRuntimeImplementationExecution, resolve, reject);
                return;
            }
        }
    }

    this.implementation.executeAndReturnValue(implementationInstance, this, resolve, reject);
};

StopRuntime.prototype.executeAndReturnCollectionWithPackageImplementations = function(implementationInstance, resolve, reject) {
    if (this.packageImplementations.length > 0){
        var stateInstance = this.implementation.buildStateInstance(implementationInstance);
        var stateName = stateInstance.state.name;
        for (var key in this.packageImplementations){
            var packageImplementation = this.packageImplementations[key];
            if (stateName.startsWith(key+REFERENCE_DELIMETER)){
                packageImplementation.getValue().executeAndReturnCollection(stateInstance, this.packageImplementationRuntimeImplementationExecution, resolve, reject);
                return;
            }
        }
    }

    this.implementation.executeAndReturnCollection(implementationInstance, this, resolve, reject);
};

StopRuntime.prototype.packageImplementationRuntimeImplementationExecutionQueue = function(stateInstance, resolve, reject) {
    this.queue(this.implementation.buildImplementationInstance(stateInstance), resolve, reject);
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