window.addEventListener('load', function() {
  // Service worker registeren.
  if ('serviceWorker' in navigator) 
  {
      var rootPath = window.location.origin; // Get the root path of the current URL
      var serviceWorkerPath = rootPath + "/service-worker.js"; // Absolute path to service worker
      this.navigator.serviceWorker.register(serviceWorkerPath)
      .then((registration) => {
        console.log('Registered: ');
        console.log(registration);
        })
      .catch((err) => console.log(err));
  } 
  else
  {
    alert('No service worker support in this browser.');
  }
});