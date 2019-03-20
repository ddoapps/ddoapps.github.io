importScripts("precache-manifest.47298aa01102aa1cd50f637f3213b2cd.js", "https://storage.googleapis.com/workbox-cdn/releases/3.6.3/workbox-sw.js");

'use strict';

const GET = 'GET';
const HEAD = 'HEAD';

( function () {
	workbox.skipWaiting();
	workbox.clientsClaim();

	let currentCacheNames = Object.assign(
		{ precacheTemp: workbox.core.cacheNames.precache +'-temp' }
		, workbox.core.cacheNames
	);

	self.addEventListener( 'activate', event => {
		event.waitUntil(
			caches.keys().then( cacheNames => {
				let validCacheSet = new Set( Object.values( currentCacheNames ) );

				return Promise.all(
					cacheNames
						.filter( cacheName => !validCacheSet.has( cacheName ) )
						.map( cacheName => caches.delete( cacheName ) )
				);
			} )
		);
	} );

	self.__precacheManifest = [].concat( self.__precacheManifest || [] );
	workbox.precaching.suppressWarnings();
	workbox.precaching.precacheAndRoute( self.__precacheManifest, {} );

	workbox.routing.registerRoute( /^http[s]?:\/\/fonts.googleapis.com\/(.*)/, workbox.strategies.staleWhileRevalidate(), GET );
	workbox.routing.registerRoute( /^http[s]?:\/\/fonts.gstatic.com\/(.*)/, workbox.strategies.staleWhileRevalidate(), GET );
	
	workbox.routing.registerRoute( /\/assets\/styles\/vendor\/fontello\/font\/(.+)[.](.+)[?](.+)$/, workbox.strategies.staleWhileRevalidate(), GET );
}() );

( function () {
	function DBCollection ( databasePromise, collectionName ) {
		let self = this;
		let collectionPromise = new Promise( ( resolve, reject ) => {
			databasePromise.then(
				database => {
					if ( database.objectStoreNames.contains( collectionName ) ) {
						resolve( database );
					} else {
						reject( 'collection.does.not.exist' );
					}
				}
				, reject
			);
		} );
	
		self.findAll = () => {
			return new Promise( ( resolve, reject ) => {
				collectionPromise.then(
					database => {
						let transaction = database.transaction( collectionName, IDBTransaction.READ_ONLY );
						let store = transaction.objectStore( collectionName );
						let request = store.getAll();
	
						request.onsuccess = () => resolve( request.result );
						request.onerror = () => reject( 'collection.operation.error' );
					}
					, reject
				);
			} );
		};
	}
	
	function DBConnection ( databaseName, version, collections ) {
		let self = this;
		let dbPromise = new Promise( ( resolve, reject ) => {
			if ( indexedDB ) {
				let request = indexedDB.open( databaseName, version );
	
				request.onupgradeneeded = () => {
					let database = request.result;
					
					( collections || [] ).forEach( collection => {
						database.createObjectStore( collection.name, { keyPath: collection.id } );
					} );
				};
	
				request.onsuccess = () => resolve( request.result );
				request.onerror = () => reject( 'database.error' );
			} else {
				reject( 'database.not.supported' );
			}
		} );
	
		self.getCollection = collectionName => new DBCollection( dbPromise, collectionName );
	}
	
	let QuestTracker = ( function () {
		let database;
		let allPacksPromise;
		let allQuestsPromise;
		let allSagasPromise;
	
		let functions = {
			retrieveJsonFromPreCache ( fileName ) {
				return new Promise( resolve => {
					caches.open( workbox.core.cacheNames.precache ).then( cache => {
						cache.keys().then( cacheKeys => {
							let cacheKey = cacheKeys.find( cacheKey => cacheKey.url.endsWith( fileName ) );

							cache.match( cacheKey ).then( response => {
								response.json().then( json => resolve( json ) );
							} );
						} );
					} );
				} );
			}
			, retrievePacks () {
				if ( !allPacksPromise ) allPacksPromise = functions.retrieveJsonFromPreCache( 'packs.json' );
				return allPacksPromise;
			}
			, retrieveQuests () {
				if ( !allQuestsPromise ) allQuestsPromise = functions.retrieveJsonFromPreCache( 'quests.json' );
				return allQuestsPromise;
			}
			, retrieveSagas () {
				if ( !allSagasPromise ) allSagasPromise = functions.retrieveJsonFromPreCache( 'sagas.json' );
				return allSagasPromise;
			}
			, respondWith ( data, status ) {
				if ( status == 204 ) return new Response( null, { status: status } );

				return new Response( JSON.stringify( data ), { status: status, headers: { 'Content-Type': 'application/json; charset=utf-8' } } );
			}
			, searchForAdventurePacks () {
				return new Promise( ( resolve, reject ) => {
					functions.retrievePacks().then(
						packs => resolve( functions.respondWith( packs, 200 ) )
						, () => reject( functions.respondWith( [], 500 ) )
					);
				} );
			}
			, searchForQuests () {
				return new Promise( ( resolve, reject ) => {
					Promise.all( [ functions.retrieveQuests(), functions.retrievePacks() ] ).then(
						values => {
							let quests = values[ 0 ];
							let packs = values[ 1 ];

							quests.forEach( quest => {
								if ( quest.heroic ) quest.heroic.level = ( quest.heroic.normal || quest.heroic.casual ).level;
								if ( quest.epic ) quest.epic.level = ( quest.epic.normal || quest.epic.casual ).level;
							} );

							packs.forEach( pack => {
								pack.quests.forEach( id => {
									quests.filter( quest => quest.id === id )[ 0 ].pack = pack;
								} );
							} );

							resolve( functions.respondWith( quests, 200 ) );
						}
						, () => reject( functions.respondWith( [], 500 ) )
					);
				} );
			}
			, searchForSagas () {
				return new Promise( ( resolve, reject ) => {
					Promise.all( [ functions.retrieveSagas(), functions.retrievePacks() ] ).then(
						values => {
							let sagas = values[ 0 ];
							let packs = values[ 1 ];

							packs
								.filter( pack => pack.sagas )
								.forEach( pack => {
									pack.sagas.forEach( id => {
										sagas.filter( saga => saga.id === id )[ 0 ].pack = pack;
									} );
								} );
							
							resolve( functions.respondWith( sagas, 200 ) );
						}
						, () => reject( functions.respondWith( [], 500 ) )
					);
				} );
			}
		};
		
		let api = {
			initialize () {
				return new Promise( ( resolve, reject ) => {
					try {
						database = new DBConnection( 'ddoQuestTracker', 1, [ { name: 'characters', id: 'id' } ] );

						resolve( functions.respondWith( {}, 200 ) );
					} catch ( e ) {
						reject( functions.respondWith( {}, 500 ) );
					}
				} );
			}
			, registered () {
				return new Promise( resolve => resolve( functions.respondWith( {}, 200 ) ) );
			}
			, retrieveAllAdventurePacks () {
				return functions.searchForAdventurePacks();
			}
			, retrieveAllQuests () {
				return functions.searchForQuests();
			}
			, retrieveAllSagas () {
				return functions.searchForSagas();
			}
			, retrieveCharacters () {
				return new Promise( ( resolve, reject ) => {
					database.getCollection( 'characters' ).findAll().then(
						characters => {
							let status = ( characters || [] ).length ? 200 : 204;

							resolve( functions.respondWith( characters, status ) );
						}
						, () => reject( functions.respondWith( {}, 500 ) )
					);
				} );
			}
			, unregister () {
				return new Promise( resolve => {
					caches.keys().then( cacheNames => {
						Promise.all(
							cacheNames
								.filter( cacheName => cacheName.indexOf( 'workbox' ) > -1 )
								.map( cacheName => caches.delete( cacheName ) )
						).then(
							self.registration.unregister().then(
								() => resolve( functions.respondWith( {}, 200 ) )
							)
						)
					} );
				} );
			}
		};
	
		return api;
	}() );

	workbox.routing.registerRoute( /api\/initialize/, QuestTracker.initialize, GET );
	workbox.routing.registerRoute( /api\/registered/, QuestTracker.registered, HEAD );
	workbox.routing.registerRoute( /api\/unregister/, QuestTracker.unregister, HEAD );

	workbox.routing.registerRoute( /api\/packs$/, QuestTracker.retrieveAllAdventurePacks, GET );
	workbox.routing.registerRoute( /api\/quests$/, QuestTracker.retrieveAllQuests, GET );
	workbox.routing.registerRoute( /api\/sagas$/, QuestTracker.retrieveAllSagas, GET );
}() );

