importScripts("precache-manifest.4fe4f19d665ceb4a76fbe54ab8142ce7.js", "https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js");

"use strict";
var Constants = (function () {
    function Constants() {
    }
    Constants.GET = 'GET';
    Constants.HEAD = 'HEAD';
    return Constants;
}());
var DBCollection = (function () {
    function DBCollection(databasePromise, collectionName) {
        this.databasePromise = databasePromise;
        this.collectionName = collectionName;
        this.collectionPromise = new Promise(function (resolve, reject) {
            databasePromise.then(function (database) {
                if (database.objectStoreNames.contains(collectionName)) {
                    resolve(database);
                }
                else {
                    reject('collection.does.not.exist');
                }
            }, reject);
        });
    }
    DBCollection.prototype.findAll = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.collectionPromise.then(function (database) {
                var idbTransation = (IDBTransaction || {});
                var transaction = database.transaction(_this.collectionName, idbTransation.READ_ONLY);
                var store = transaction.objectStore(_this.collectionName);
                var request = store.getAll();
                request.onsuccess = function () { return resolve(request.result); };
                request.onerror = function () { return reject('collection.operation.error'); };
            }, reject);
        });
    };
    return DBCollection;
}());
var DBConnection = (function () {
    function DBConnection(indexedDB, databaseName, version, collections) {
        this.indexedDB = indexedDB;
        this.databaseName = databaseName;
        this.version = version;
        this.collections = collections;
        var self = this;
        this.databasePromise = new Promise(function (resolve, reject) {
            if (indexedDB) {
                var request_1 = indexedDB.open(databaseName, version);
                request_1.onupgradeneeded = function () {
                    var database = request_1.result;
                    (collections || []).forEach(function (collection) {
                        database.createObjectStore(collection.name, { keyPath: collection.id });
                    });
                };
                request_1.onsuccess = function () { return resolve(request_1.result); };
                request_1.onerror = function () { return reject('database.error'); };
            }
            else {
                reject('database.not.supported');
            }
        });
    }
    DBConnection.prototype.getCollection = function (collectionName) {
        return new DBCollection(this.databasePromise, collectionName);
    };
    return DBConnection;
}());
var IndexedDbService = (function () {
    function IndexedDbService(indexedDB) {
        this.indexedDB = indexedDB;
    }
    IndexedDbService.prototype.connectToDatabase = function (databaseName, version, collections) {
        return new DBConnection(this.indexedDB, databaseName, version, collections);
    };
    return IndexedDbService;
}());
var PacksService = (function () {
    function PacksService(precacheService) {
        this.precacheService = precacheService;
    }
    PacksService.prototype.findAll = function () {
        var _this = this;
        if (!this.allPacksPromise) {
            this.allPacksPromise = new Promise(function (resolve) {
                _this.precacheService.retrieveJson('/jsons/packs.json').then(function (data) {
                    resolve(data.map(function (pack) { return new Pack(pack); }));
                });
            });
        }
        return this.allPacksPromise;
    };
    return PacksService;
}());
var PrecacheService = (function () {
    function PrecacheService(workbox, caches) {
        this.workbox = workbox;
        this.caches = caches;
    }
    PrecacheService.prototype.retrieveJson = function (fileName) {
        var _this = this;
        return new Promise(function (resolve) {
            _this.caches.open(_this.workbox.core.cacheNames.precache).then(function (cache) {
                cache.keys().then(function (cacheKeys) {
                    var cacheKey = cacheKeys.find(function (cacheKey) { return cacheKey.url.indexOf(fileName) > -1; });
                    cache.match(cacheKey).then(function (response) {
                        response.json().then(function (json) { return resolve(json); });
                    });
                });
            });
        });
    };
    return PrecacheService;
}());
var QuestsService = (function () {
    function QuestsService(precacheService) {
        this.precacheService = precacheService;
    }
    QuestsService.prototype.findAll = function () {
        var _this = this;
        if (this.allQuestsPromise)
            return this.allQuestsPromise;
        return this.allQuestsPromise = new Promise(function (resolve) {
            _this.precacheService.retrieveJson('/jsons/quests.json').then(function (data) {
                resolve(data.map(function (quest) { return new Quest(quest); }));
            });
        });
    };
    return QuestsService;
}());
var ResponseService = (function () {
    function ResponseService() {
    }
    ResponseService.prototype.respondWith = function (data, status) {
        if (status == 204)
            return new Response(null, { status: status });
        return new Response(JSON.stringify(data), { status: status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    };
    return ResponseService;
}());
var SagasService = (function () {
    function SagasService(precacheService) {
        this.precacheService = precacheService;
    }
    SagasService.prototype.findAll = function () {
        var _this = this;
        if (!this.allSagasPromise) {
            this.allSagasPromise = new Promise(function (resolve) {
                _this.precacheService.retrieveJson('/jsons/sagas.json').then(function (data) {
                    resolve(data.map(function (saga) { return new Saga(saga); }));
                });
            });
        }
        return this.allSagasPromise;
    };
    return SagasService;
}());
var WorkboxService = (function () {
    function WorkboxService(self, workbox, caches) {
        this.self = self;
        this.workbox = workbox;
        this.caches = caches;
    }
    WorkboxService.prototype.initialize = function () {
        var _this = this;
        this.workbox.core.skipWaiting();
        this.workbox.core.clientsClaim();
        var currentCacheNames = Object.assign({ precacheTemp: this.workbox.core.cacheNames.precache + '-temp' }, this.workbox.core.cacheNames);
        this.self.addEventListener('activate', function (event) {
            event.waitUntil(_this.caches.keys().then(function (cacheNames) {
                var validCacheSet = new Set(Object.values(currentCacheNames));
                return Promise.all(cacheNames
                    .filter(function (cacheName) { return !validCacheSet.has(cacheName); })
                    .map(function (cacheName) { return _this.caches.delete(cacheName); }));
            }));
        });
        this.self.__precacheManifest = [].concat(this.self.__precacheManifest || []);
        this.workbox.precaching.precacheAndRoute(this.self.__precacheManifest, {});
        this.registerRoute(/^http[s]?:\/\/fonts.googleapis.com\/(.*)/, new this.workbox.strategies.StaleWhileRevalidate(), Constants.GET);
        this.registerRoute(/^http[s]?:\/\/fonts.gstatic.com\/(.*)/, new this.workbox.strategies.StaleWhileRevalidate(), Constants.GET);
        this.registerRoute(/\/assets\/styles\/vendor\/fontello\/font\/(.+)[.](.+)[?](.+)$/, new this.workbox.strategies.StaleWhileRevalidate(), Constants.GET);
    };
    WorkboxService.prototype.registerRoute = function (path, strategy, httpMethod) {
        this.workbox.routing.registerRoute(path, strategy, httpMethod);
    };
    WorkboxService.prototype.retrieveJsonFromPreCache = function (fileName) {
        var _this = this;
        return new Promise(function (resolve) {
            _this.caches.open(_this.workbox.core.cacheNames.precache).then(function (cache) {
                cache.keys().then(function (cacheKeys) {
                    var cacheKey = cacheKeys.find(function (cacheKey) { return cacheKey.url.indexOf(fileName) > -1; });
                    cache.match(cacheKey).then(function (response) {
                        response.json().then(function (json) { return resolve(json); });
                    });
                });
            });
        });
    };
    return WorkboxService;
}());
var PacksController = (function () {
    function PacksController(packsService, responseService) {
        this.packsService = packsService;
        this.responseService = responseService;
    }
    PacksController.prototype.retrieveAllPacks = function () {
        var _this = this;
        if (this.allPacksPromise)
            return this.allPacksPromise;
        return this.allPacksPromise = new Promise(function (resolve, reject) {
            _this.packsService.findAll().then(function (packs) { return resolve(_this.responseService.respondWith(packs, 200)); }, function () { return reject(_this.responseService.respondWith([], 500)); });
        });
    };
    return PacksController;
}());
var QuestsController = (function () {
    function QuestsController(packsService, questsService, responseService) {
        this.packsService = packsService;
        this.questsService = questsService;
        this.responseService = responseService;
    }
    QuestsController.prototype.retrieveAllQuests = function () {
        var _this = this;
        if (this.allQuestsPromise)
            return this.allQuestsPromise;
        return this.allQuestsPromise = new Promise(function (resolve, reject) {
            Promise.all([_this.questsService.findAll(), _this.packsService.findAll()]).then(function (values) {
                var quests = values[0], packs = values[1];
                quests.forEach(function (quest) {
                    if (quest.heroic)
                        quest.heroic.level = (quest.heroic.normal || quest.heroic.casual).level;
                    if (quest.epic)
                        quest.epic.level = (quest.epic.normal || quest.epic.casual).level;
                });
                packs.forEach(function (pack) {
                    pack.quests.forEach(function (id) {
                        quests.filter(function (quest) { return quest.id === id; })[0].pack = pack;
                    });
                });
                resolve(_this.responseService.respondWith(quests, 200));
            }, function () { return reject(_this.responseService.respondWith([], 500)); });
        });
    };
    return QuestsController;
}());
var SagasController = (function () {
    function SagasController(packsService, sagasService, responseService) {
        this.packsService = packsService;
        this.sagasService = sagasService;
        this.responseService = responseService;
    }
    SagasController.prototype.retrieveAllSagas = function () {
        var _this = this;
        if (this.allSagasPromise)
            return this.allSagasPromise;
        return this.allSagasPromise = new Promise(function (resolve, reject) {
            Promise.all([_this.sagasService.findAll(), _this.packsService.findAll()]).then(function (values) {
                var sagas = values[0], packs = values[1];
                packs
                    .filter(function (pack) { return pack.sagas; })
                    .forEach(function (pack) {
                    pack.sagas.forEach(function (id) {
                        sagas.find(function (saga) { return saga.id === id; }).pack = pack;
                    });
                });
                resolve(_this.responseService.respondWith(sagas, 200));
            }, function () { return reject(_this.responseService.respondWith([], 500)); });
        });
    };
    return SagasController;
}());
var WorkboxController = (function () {
    function WorkboxController(self, caches, indexedDbService, responseService) {
        this.self = self;
        this.caches = caches;
        this.indexedDbService = indexedDbService;
        this.responseService = responseService;
    }
    WorkboxController.prototype.initializeIndexedDB = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                _this.indexedDbService.connectToDatabase('ddoQuestTracker', 1, [{ name: 'characters', id: 'id' }]);
                resolve(_this.responseService.respondWith({}, 200));
            }
            catch (e) {
                reject(_this.responseService.respondWith({}, 500));
            }
        });
    };
    WorkboxController.prototype.registered = function () {
        var _this = this;
        return new Promise(function (resolve) { return resolve(_this.responseService.respondWith({}, 200)); });
    };
    WorkboxController.prototype.unregister = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.caches.keys().then(function (cacheNames) {
                Promise.all(cacheNames
                    .filter(function (cacheName) { return cacheName.indexOf('workbox') > -1; })
                    .map(function (cacheName) { return caches.delete(cacheName); })).then(_this.self.registration.unregister().then(function () { return resolve(_this.responseService.respondWith({}, 200)); }));
            });
        });
    };
    return WorkboxController;
}());
var responseService = new ResponseService();
var indexedDbService = new IndexedDbService(indexedDB);
var precacheService = new PrecacheService(workbox, caches);
var packsService = new PacksService(precacheService);
var questsService = new QuestsService(precacheService);
var sagasService = new SagasService(precacheService);
var workboxService = new WorkboxService(self, workbox, caches);
var packsController = new PacksController(packsService, responseService);
var questsController = new QuestsController(packsService, questsService, responseService);
var sagasController = new SagasController(packsService, sagasService, responseService);
var workboxController = new WorkboxController(self, caches, indexedDbService, responseService);
workboxService.initialize();
workboxService.registerRoute(/api\/initialize/, function () { return workboxController.initializeIndexedDB(); }, Constants.GET);
workboxService.registerRoute(/api\/registered/, function () { return workboxController.registered(); }, Constants.HEAD);
workboxService.registerRoute(/api\/unregister/, function () { return workboxController.unregister(); }, Constants.HEAD);
workboxService.registerRoute(/api\/packs$/, function () { return packsController.retrieveAllPacks(); }, Constants.GET);
workboxService.registerRoute(/api\/quests$/, function () { return questsController.retrieveAllQuests(); }, Constants.GET);
workboxService.registerRoute(/api\/sagas$/, function () { return sagasController.retrieveAllSagas(); }, Constants.GET);
var Pack = (function () {
    function Pack(obj) {
        this.id = obj.id;
        this.name = obj.name;
        this.expansionPack = obj.expansionPack === true;
        this.quests = obj.quests;
        this.sagas = obj.sagas;
    }
    return Pack;
}());
var QuestDifficulty = (function () {
    function QuestDifficulty(obj) {
        this.experience = obj.xp;
        this.level = obj.level;
    }
    return QuestDifficulty;
}());
var QuestDifficulties = (function () {
    function QuestDifficulties(obj) {
        if (obj.casual)
            this.casual = new QuestDifficulty(obj.casual);
        if (obj.normal)
            this.normal = new QuestDifficulty(obj.normal);
        if (obj.hard)
            this.hard = new QuestDifficulty(obj.hard);
        if (obj.elite)
            this.elite = new QuestDifficulty(obj.elite);
    }
    return QuestDifficulties;
}());
var Quest = (function () {
    function Quest(obj) {
        this.id = obj.id;
        this.name = obj.name;
        this.duration = obj.duration;
        if (obj.heroic)
            this.heroic = new QuestDifficulties(obj.heroic);
        if (obj.epic)
            this.epic = new QuestDifficulties(obj.epic);
    }
    return Quest;
}());
var SagaDifficulty = (function () {
    function SagaDifficulty(obj) {
        this.experience = obj.xp;
    }
    return SagaDifficulty;
}());
var SagaType = (function () {
    function SagaType(obj) {
        this.quests = obj.quests;
        if (obj.normal)
            this.normal = new SagaDifficulty(obj.normal);
        if (obj.hard)
            this.hard = new SagaDifficulty(obj.hard);
        if (obj.elite)
            this.elite = new SagaDifficulty(obj.elite);
        if (obj.true_elite)
            this.true_elite = new SagaDifficulty(obj.true_elite);
    }
    return SagaType;
}());
var Saga = (function () {
    function Saga(obj) {
        this.id = obj.id;
        this.name = obj.name;
        if (obj.heroic)
            this.heroic = new SagaType(obj.heroic);
        if (obj.epic)
            this.epic = new SagaType(obj.epic);
    }
    return Saga;
}());

