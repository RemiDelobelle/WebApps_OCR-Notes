// Vang de drie standaard events op: install, activate en fetch.

const STATIC_CACHE_NAME = "static-version-5";
const DYNAMIC_CACHE_NAME = "dynamic-version-5";

// Array met alle static files die gecached moeten worden.
const staticFiles = [
    'index.html',
    'images/favicon.ico',
    'styles/mystyle.css',
    'styles/bootstrap-4.5.2.min.css',
    'scripts/app.js',
    'scripts/addNote.js',
    'scripts/cardPage.js',
    'scripts/bootstrap-4.5.2.min.js',
    'scripts/jquery-3.5.1.min.js',
    'scripts/popper-1.16.0.min.js',
    'scripts/tesseract-2.1.0.min.js',
    'scripts/index-4.0.3-min.js',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'pages/fallback.html',
    'manifest.json',
];

// Functie om de static files te cachen.
const filesUpdate = cache => {
    const stack = [];
    staticFiles.forEach(file => stack.push(
        cache.add(file).catch(_ => console.error(`Can't load ${file} to cache`))
    ));
    return Promise.all(stack);
};

// Vang het 'install' event op.
self.addEventListener("install", (event) => {
    console.log("Service worker installed: ", event);

    event.waitUntil(
        caches.open(STATIC_CACHE_NAME).then(cache => {
            console.log("Caching static files...");
            return filesUpdate(cache);
        }).then(() => {
            console.log("Static files cached successfully.");
        }).catch(error => {
            console.error("Error caching static files:", error);
        })
    );
});

// Vang het 'activate' event op.
self.addEventListener("activate", (event) => {
    console.log("Service worker activated: ", event);

    event.waitUntil(
        caches.keys().then(keys => {
            console.log("Cache keys: ", keys);

            // Wacht tot alle promises 'resolved' zijn.
            return Promise.all(
                // Gebruik de filter functie, om een nieuw array aan te maken dat enkel de cache names
                // bevat die niet tot de huidige versie behoren.
                keys.filter(key => ((key !== STATIC_CACHE_NAME) && (key !== DYNAMIC_CACHE_NAME)))
                // Gebruik het gefilterd array, om de oude caches te wissen.
                .map(key => caches.delete(key))


                // Zie: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
                // Zie: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
            )
        })
    );
});

// Vang het 'fetch' event op.
self.addEventListener("fetch", (event) => {
    console.log("Fetch event: ", event);

    // Check if the requested URL contains 'AddNote.html'
    if (event.request.url.includes('AddNote.html')) {
        // If it does, bypass caching and fetch the resource from the network directly
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match('pages/fallback.html');
            }));
    } else {
        // For other requests, proceed with caching logic
        event.respondWith(
            caches.match(event.request).then(cacheResponse => {
                return cacheResponse || fetch(event.request).then(fetchResponse => {
                    return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                        cache.put(event.request.url, fetchResponse.clone());
                        return fetchResponse;
                    })
                })
                // Voeg hier het catch-gedeelte toe... Om te verwijzen naar een fallback.html.
                .catch(() => {
                    // Stel een extra voorwaarde in, zodat je de fallback enkel toont indien
                    // je een html-bestand opvraagt.
                    if(event.request.url.indexOf('.html') >= 0)
                        return caches.match('pages/fallback.html');
                    // return caches.match('pages/fallback.html');
                });
            })
        );
    }
});