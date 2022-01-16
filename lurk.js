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
	this.enums.state = createEnum(['Uninitialized', 'Initializing', 'Initialized', 'Ready', 'Connecting', 'Connected', 'Disconnecting', 'Reconnecting', 'Error']);
	this.events = {};
	this.state = this.enums.state.Uninitialized;
}

/*

CLOUD DATABASE
root
	channels
		$USERID
			data
				name
			objects
			chat
				$USERID
					$MESSAGEID
						text
						timestamp
						room
			rooms
				$ROOMID
					objects
					players
						$USERID
							transform
							data

LOCAL STORAGE
$USERID
	name

*/

LurkMode.prototype.fire = function(eventName) {
	let argsArray = [];
	for( var i = 0; i < arguments.length; i++ ) {
		argsArray.push(arguments[i]);
	}
	let args = argsArray.slice(1);

	console.log(eventName, args);

	let events = this.events[eventName];
	if( events ) {
		for( let i = 0; i < events.length; i++ ) {
			let event = events[i];
			let scope = (typeof event.scope == 'Object') ? scope : null;
			if( args.length > 0 ) {
				event.handler.apply(scope, args);
			}
			else {
				event.handler.apply(scope);
			}
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

LurkMode.prototype.loginAuto = function() {
	var self = this;
	return new Promise((resolve, reject) => {
		// assume we cannot auto-login as the user, for now
		// TODO: Make it so we actually try to auto-login first.
		self.loginGuest().then(resolve).catch(reject);
	});
};

LurkMode.prototype.login = function() {
	var ui = this.ui;
	var uiConfig = {
		callbacks: {
			signInSuccessWithAuthResult: function(authResult, redirectUrl) {
				// User successfully signed in.
				// Return type determines whether we continue the redirect automatically
				// or whether we leave that to developer to handle.
				return true;
			},
			uiShown: function() {
				// The widget is rendered.
				// Hide the loader.
				document.getElementById('loader').style.display = 'none';
			}
		},
		// Will use popup for IDP Providers sign-in flow instead of the default, redirect.
		signInFlow: 'popup',
		signInSuccessUrl: '<url-to-redirect-to-on-success>',
		signInOptions: [
			firebase.auth.EmailAuthProvider.PROVIDER_ID
		],
		// Terms of service url.
		tosUrl: '<your-tos-url>',
		// Privacy policy url.
		privacyPolicyUrl: '<your-privacy-policy-url>'
	};

	// The start method will wait until the DOM is loaded.
	ui.start('#firebaseui-auth-container', uiConfig);
};

LurkMode.prototype.loginGuest = function() {
	return new Promise((resolve, reject) => {
		firebase.auth().signInAnonymously()
		.then(() => {
			resolve();
		})
		.catch(reject);
	});
};

LurkMode.prototype.onAuthStateChanged = function(user) {
	this.fire('auth:stateChanged', user);
};

LurkMode.prototype.firebaseConnect = function() {
	var self = this;
	return new Promise((resolve, reject) => {
		// Create a reference to the special '.info/connected' path in 
		// Realtime Database. This path returns `true` when connected
		// and `false` when disconnected.

		var promisePending = true;
		firebase.database().ref('.info/connected').on('value', function(snapshot) {
			// If we're not currently connected, don't do anything.
			if (snapshot.val() == false) {
				if( !promisePending ) {	// we start off disconnected at first, until our initial promise is resolved.
					console.warn('Disonnected from Firebase.');
				}
				return;
			}

			/*
			// If we are currently connected, then use the 'onDisconnect()' 
			// method to add a set which will only trigger once this 
			// client has disconnected by closing the app, 
			// losing internet, or any other means.
			userStatusDatabaseRef.onDisconnect().set(isOfflineForDatabase).then(function() {
				// The promise returned from .onDisconnect().set() will
				// resolve as soon as the server acknowledges the onDisconnect() 
				// request, NOT once we've actually disconnected:
				// https://firebase.google.com/docs/reference/js/firebase.database.OnDisconnect

				// We can now safely set ourselves as 'online' knowing that the
				// server will mark us as offline once we lose connection.
				userStatusDatabaseRef.set(isOnlineForDatabase);
			});
			*/

			console.warn('Connected to Firebase.');
			if( promisePending ) {
				promisePending = false;
				resolve();
			}
		});
	});
};

LurkMode.prototype.setSystemState = function(state, reason) {
	if( this.state === state ) {
		console.warn('System attempted to set itself to the state that it was already in.');
		return;
	}

	var prevState = this.state;
	this.state = state;
	this.fire('system:stateChanged', {
		state: state,
		prevState: prevState,
		reason: reason
	});
};

LurkMode.prototype.initialize = function() {
	var self = this;
	return new Promise((resolve, reject) => {
		// switch states right away
		self.setSystemState(self.enums.state.Initializing);

		self.app = firebase.initializeApp(firebaseConfig);
		var ui = new firebaseui.auth.AuthUI(firebase.auth());	// NOTE: We only really need the UI stuff on pages that need to utlize the auth UI.  (Maybe all pages still?)
		self.ui = ui;

		// connect to Firebase database
		self.firebaseConnect().then(() => {
			// connect to Firebase auth

			// catch the 1st auth state change to finish initialization, but pass all events through to the normal handler.
			var promisePending = true;
			function onAuthStateChanged(user) {
				self.onAuthStateChanged(user);
				if( promisePending ) {
					promisePending = false;
					if( user ) {
						self.setSystemState(self.enums.state.Initialized);
						resolve();
					}
					else {
						self.setSystemState(self.enums.state.Error);
						reject();
					}
				}
			}
			firebase.auth().onAuthStateChanged(onAuthStateChanged);
		}).catch((err) => {
			self.state = self.enums.state.Error;
			self.fire('system:error');
			reject(err);
		});
	});
};

LurkMode.prototype.begin = function() {
	var self = navigator.lurk;
	return new Promise((resolve, reject) => {
		// initialize
		self.initialize().then(() => {
			// login
			self.loginAuto().then(() => {
				// now we're ready.
				self.setSystemState(self.enums.state.Ready);
				resolve();
			}).catch(reject);
		}).catch(reject);
	});
};

navigator.lurk = new LurkMode();