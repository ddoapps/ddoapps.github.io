importScripts("precache-manifest.e8a7c4e32000fa18fa4d728b4211ea81.js", "https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js");

workbox.skipWaiting();
workbox.clientsClaim();

( function () { //IIFE just for code collapsing
	let currentCacheNames = Object.assign(
		{ precacheTemp: workbox.core.cacheNames.precache + "-temp" }
		, workbox.core.cacheNames
	);

	self.addEventListener( 'activate', function ( event ) {
		event.waitUntil(
			caches.keys().then( function ( cacheNames ) {
				let validCacheSet = new Set( Object.values( currentCacheNames ) );

				return Promise.all(
					cacheNames.filter( function ( cacheName ) {
						return !validCacheSet.has(cacheName);
					} ).map( function ( cacheName ) {
						return caches.delete( cacheName );
					} )
				);
			})
		);
	});

	self.__precacheManifest = [].concat(self.__precacheManifest || []);
	workbox.precaching.suppressWarnings();
	workbox.precaching.precacheAndRoute(self.__precacheManifest, {});

	workbox.routing.registerRoute(/^http[s]?:\/\/fonts.googleapis.com\/(.*)/, workbox.strategies.staleWhileRevalidate(), 'GET');
	workbox.routing.registerRoute(/^http[s]?:\/\/fonts.gstatic.com\/(.*)/, workbox.strategies.staleWhileRevalidate(), 'GET');
	
	workbox.routing.registerRoute(/\/assets\/styles\/vendor\/fontello\/font\/(.+)[.](.+)[?](.+)$/, workbox.strategies.staleWhileRevalidate(), 'GET');
}() );

( function () {
	function DBCollection ( databasePromise, collectionName ) {
		var self = this;
		var collectionPromise = new Promise( function ( resolve, reject ) {
			databasePromise.then(
				function ( database ) {
					if ( database.objectStoreNames.contains( collectionName ) ) {
						resolve( database );
					} else {
						reject( 'collection.does.not.exist' );
					}
				}, reject
			);
		} );
	
		self.findAll = function () {
			return new Promise( function ( resolve, reject ) {
				collectionPromise.then(
					function ( database ) {
						var transaction = database.transaction( collectionName, IDBTransaction.READ_ONLY );
						var store = transaction.objectStore( collectionName );
						var request = store.getAll();
	
						request.onsuccess = function () {
							resolve( request.result );
						};
	
						request.onerror = function () {
							reject( 'collection.operation.error' );
						};
					}, reject
				);
			} );
		}
	}
	
	function DBConnection ( databaseName, version, collections ) {
		var self = this;
		var dbPromise = new Promise( function ( resolve, reject ) {
			if ( indexedDB ) {
				var request = indexedDB.open( databaseName, version );
	
				request.onupgradeneeded = function () {
					var database = request.result;
	
					if ( collections ) {
						collections.forEach( function ( collection ) {
							database.createObjectStore( collection.name, { keyPath: collection.id } );
						} );
					}
				};
	
				request.onsuccess = function () {
					resolve( request.result );
				};
	
				request.onerror = function () {
					reject( 'database.error' );
				};
			} else {
				reject( 'database.not.supported' );
			}
		} );
	
		self.getCollection = function ( collectionName ) {
			return new DBCollection( dbPromise, collectionName );
		};
	}
	
	let QuestTracker = ( function () {
		var database;
		var allPacksPromise;
		var allQuestsPromise;
		var allSagasPromise;
	
		var functions = {
			retrieveJsonFromPreCache: function ( fileName ) {
				return new Promise( function ( resolve, reject ) {
					caches.open( workbox.core.cacheNames.precache ).then( function ( cache ) {
						cache.keys().then( function ( cacheKeys ) {
							var cacheKey = cacheKeys.find( function ( element ) {
								return element.url.endsWith( fileName );
							} );

							cache.match( cacheKey ).then( function ( response ) {
								response.json().then( function ( json ) {
									resolve( json );
								} );
							} );
						} );
					} );
				} );
			}
			, retrievePacks: function () {
				if ( !allPacksPromise ) allPacksPromise = functions.retrieveJsonFromPreCache( 'packs.json' );
				return allPacksPromise;
			}
			, retrieveQuests: function () {
				if ( !allQuestsPromise ) allQuestsPromise = functions.retrieveJsonFromPreCache( 'quests.json' );
				return allQuestsPromise;
			}
			, retrieveSagas: function () {
				if ( !allSagasPromise ) allSagasPromise = functions.retrieveJsonFromPreCache( 'sagas.json' );
				return allSagasPromise;
			}
			, respondWith: function ( data, status ) {
				if ( status == 204 ) {
					return new Response( null, { status: status } );
				} else {
					return new Response( JSON.stringify( data ), { status: status, headers: { 'Content-Type': 'application/json; charset=utf-8' } } );
				}
			}
			, searchForQuests: function ( searchCriteria ) {
				return new Promise( function ( resolve, reject ) {
					Promise.all( [ functions.retrieveQuests(), functions.retrievePacks() ] ).then(
						function ( values ) {
							var quests = values[ 0 ];
							var packs = values[ 1 ];

							packs.forEach( function ( pack ) {
								pack.quests.forEach( function ( id ) {
									quests.filter( function ( quest ) {
										return quest.id === id;
									} )[ 0 ].pack = pack;
								} );
							} );

							resolve( functions.respondWith( quests, 200 ) );
						}
						, function () {
							reject( functions.respondWith( [], 500 ) );
						}
					);
				} );
			}
			, searchForSagas: function ( searchCriteria ) {
				return new Promise( function ( resolve, reject ) {
					Promise.all( [ functions.retrieveSagas(), functions.retrievePacks() ] ).then(
						function ( values ) {
							var sagas = values[ 0 ];
							var packs = values[ 1 ];

							packs.filter( function ( pack ) {
								return pack.sagas;
							} ).forEach( function ( pack ) {
								pack.sagas.forEach( function ( id ) {
									sagas.filter( function ( saga ) {
										return saga.id === id;
									} )[ 0 ].pack = pack;
								} );
							} );

							resolve( functions.respondWith( sagas, 200 ) );
						}
						, function () {
							reject( functions.respondWith( [], 500 ) );
						}
					);
				} );
			}
		};
	
		let api = {
			initialize: function () {
				return new Promise( function ( resolve, reject ) {
					try {
						database = new DBConnection( 'ddoQuestTracker', 1, [ { name: 'characters', id: 'id' } ] );

						resolve( functions.respondWith( {}, 200 ) );
					} catch ( e ) {
						reject( functions.respondWith( {}, 500 ) );
					}
				} );
			}
			, registered: function () {
				return new Promise( function ( resolve, reject ) {
					resolve( functions.respondWith( {}, 200 ) );
				} );
			}
			, retrieveCharacters: function () {
				return new Promise( function ( resolve, reject ) {
					database.getCollection( 'characters' ).findAll().then(
						function ( characters ) {
							let status = ( characters || [] ).length ? 200 : 204;

							resolve( functions.respondWith( characters, status ) );
						}
						, function () {
							reject( functions.respondWith( {}, 500 ) );
						}
					);
				} );
			}
			, retrieveAllQuests: function ( event ) {
				return functions.searchForQuests( {} );
			}
			, retrieveAllSagas: function ( event ) {
				return functions.searchForSagas( {} );
			}
		};
	
		return api;
	}() );

	workbox.routing.registerRoute( /api\/initialize/, QuestTracker.initialize, 'GET' );
	workbox.routing.registerRoute( /api\/registered/, QuestTracker.registered, 'HEAD' );

	workbox.routing.registerRoute( /api\/quests$/, QuestTracker.retrieveAllQuests, 'GET' );
	workbox.routing.registerRoute( /api\/sagas$/, QuestTracker.retrieveAllSagas, 'GET' );
}() );

