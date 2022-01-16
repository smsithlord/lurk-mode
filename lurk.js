function LurkMode() {
	this.state = 0;

	// helper utility to create enums.
	function createEnum(values) {
		const enumObject = {};
		for (const val of values) {
			enumObject[val] = val;
		}
		return Object.freeze(enumObject);
	}
	this.enums = {};
	this.enums.state = createEnum(['Uninitialized', 'Initializing', 'Initialized', 'Connecting', 'Connected', 'Disconnecting', 'Disconnected', 'Reconnecting']);

	this.events = {};

	this.state = this.enums.state.Uninitialized;
}

LurkMode.prototype.fire = function(eventName, data) {
	console.log('Firing event: ' + eventName);
	let events = this.events[eventName];
	if( events ) {
		for( let i = 0; i < events.length; i++ ) {
			let event = events[i];
			let scope = (typeof event.scope == 'Object') ? scope : null;
			event.handler.apply(scope, data);
		}
	}
};

LurkMode.prototype.addEventHandler = function(eventName, handler, scope, once) {
	if( !this.events.hasOwnProperty(eventName) ) {
		this.events[eventName] = [];
	}
	this.events[eventName].push({
		eventName: eventName,
		handler: handler,
		scope: scope,
		once: once
	});
};

LurkMode.prototype.on = function(eventName, handler, scope) {
	this.addEventHandler(eventName, handler, scope, false);
};

LurkMode.prototype.once = function(eventName, handler, scope) {
	this.addEventHandler(eventName, handler, scope, true);
};

LurkMode.prototype.initialize = function() {
	this.state = this.enums.state.Initializing;
	this.fire('system:initializing');

	this.state = this.enums.state.Initialized;
	this.fire('system:initialized');
};

navigator.lurk = new LurkMode();
setTimeout(function() {
	navigator.lurk.initialize();
}, 0);