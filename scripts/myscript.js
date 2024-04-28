var _mediaStream = null;

window.addEventListener('load', function() {
    console.log("Window loaded.");

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

document.addEventListener('DOMContentLoaded', function() {
    // Zoek naar media devices.
    if('mediaDevices' in navigator)
    {
        var selector = document.querySelector("#selectMediaDevice");

        // Enumereren over de devices en beschikbaar maken in select.
        // Zie: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/enumerateDevices.
        navigator.mediaDevices.enumerateDevices()
        .then(devices => {
            console.log("Devices: ", devices);          

            // Alle devices in de selection tonen.    
            var option = document.createElement('option');
                option.textContent = "None";
                option.setAttribute('data-id', "None");
                selector.appendChild(option);       
            for (var i = 0; i < devices.length; i++) {
                if (devices[i].kind === "videoinput") {
                    var option = document.createElement('option');
                    option.textContent = devices[i].label + " (" + devices[i].kind + ")";
                    option.setAttribute('data-id', devices[i].deviceId); // Set the data-id attribute
                    selector.appendChild(option);
                    console.log("Single option: ", option);
                }
            }              
        })
        .catch(error => console.log(error));

        // Indien media device geselecteerd wordt...
        selector.addEventListener('change', function(){
            // TODO: add here.
            var deviceId = selector.options[selector.selectedIndex].getAttribute("data-id");
            console.log("Selected device id: ", deviceId);

            // Eventuele oude streams afsluiten (camera vrijgeven).
            if(_mediaStream != null)
            {
                _mediaStream.getTracks().forEach(track => {
                    track.stop();
                });
            }


            // Als beeld gevraagd wordt...
            if(deviceId != "None")
            {
                // Verzoeken tot toelating en koppelen met camera.
                // Zie:https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
                navigator.mediaDevices.getUserMedia({
                    video: { deviceId: deviceId}
                })
                .then(mediaStream => {
                    _mediaStream = mediaStream;
                    console.log("mediaStream available");

                    // Koppelen aan video element.
                    var video = document.querySelector("video");
                    video.srcObject = mediaStream;

                    // Indien geladen, start beeld.
                    video.onloadedmetadata = function(e) {
                        video.play();
                    };
                })
                .catch(error => console.log(error));
            }   
        });
    }
    else
    {
        alert('No media devices support in this browser.');
    }


    // Button to trigger text extraction
    const btnExtract = document.getElementById("btnExtract");
    const btnSave = document.getElementById("btnSave");
    const btnRestart = document.getElementById("btnRestart");

    // Event listener for the "Extract Text" button
    btnExtract.addEventListener("click", function() {
        takeAndSavePhoto();
    });
    btnSave.addEventListener("click", async function() {
        try {
            // Open IndexedDB database
            const db = await idb.openDB('photos', 1);
    
            // Get the object store
            const tx = db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
    
            // Get all keys (IDs) from the object store
            const keys = await store.getAllKeys();
    
            // Find the maximum key value (ID)
            const maxKey = Math.max(...keys);
    
            // Check if a maximum key is found
            if (!isNaN(maxKey)) {
                saveText(maxKey);
            } else {
                console.error("No photo found to save text.");
            }
        } catch (error) {
            console.error('Error getting last photo ID:', error);
        }
    });
    btnRestart.addEventListener("click", async function() {
        try {
            // Open IndexedDB database
            const db = await idb.openDB('photos', 1);
    
            // Get all keys in the object store
            const keys = await db.getAllKeys('photos');
    
            // Get the ID of the last item
            const lastItemId = keys[keys.length - 1];
    
            // If there are items in the database
            if (lastItemId !== undefined) {
                // Remove the last item from the object store
                await db.delete('photos', lastItemId);
                console.log('Last item removed from IndexedDB.');
    
                // Show the camera and hide the saved photo
                const videoElement = document.getElementById('videoElement');
                const photoElement = document.getElementById('photoElement');
                const textareaOCR = document.getElementById('textareaOCR');
                videoElement.style.display = 'block';
                photoElement.innerHTML = '';
                photoElement.classList.add('hidden');
                textareaOCR.value = '';
            } else {
                console.log('No item found in IndexedDB.');
            }
        } catch (error) {
            console.error('Error removing last item from IndexedDB:', error);
        }
    });
    

    // Function to take and save photo
    async function takeAndSavePhoto() {
        try {
            if (!_mediaStream) {
                console.error("No media stream available.");
                return;
            }
    
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const video = document.getElementById("videoElement");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
            // Get data URL of the captured image
            const dataUrl = canvas.toDataURL('image/jpeg');
    
            // Convert data URL to Blob
            const blob = await fetch(dataUrl).then(res => res.blob());
    
            // Open IndexedDB database
            const db = await idb.openDB('photos', 1, {
                upgrade(db) {
                    const photosStore = db.createObjectStore('photos', { autoIncrement: true });
                    // Add a text field to the object store
                    photosStore.createIndex('text', 'text', { unique: false });
                },
            });
    
            // Save the photo to IndexedDB
            const tx = db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            const photoId = await store.add({ blob, text: '' }); // Add an empty text field
            await tx.done;
    
            console.log("Photo saved with ID:", photoId);
    
            // Show saved photo
            await showSavedPhoto(photoId);
            // Extract text from the photo
            await extractTextFromPhoto(photoId);
        } catch (error) {
            console.error('Error taking and saving photo:', error);
        }
    }
    

    // Function to display saved photo
    async function showSavedPhoto(photoId) {
        try {
            // Open IndexedDB database
            const db = await idb.openDB('photos', 1);
    
            // Get the photo blob from IndexedDB
            const tx = db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const photoData = await store.get(photoId);
    
            if (photoData) {
                const blob = photoData.blob;
                const dataUrl = URL.createObjectURL(blob);
    
                // Create image element
                const img = document.createElement('img');
                img.src = dataUrl;
                img.alt = 'Saved Photo';
                img.style.maxWidth = '100%';
                
                // Hide videoElement
                const videoElement = document.getElementById('videoElement');
                if (videoElement) {
                    videoElement.style.display = 'none';
    
                    // Remove embed-responsive class from parent div
                    const parentDiv = videoElement.parentElement;
                    parentDiv.classList.remove('embed-responsive', 'embed-responsive-16by9');
                    // Add a custom class for maintaining aspect ratio
                    parentDiv.classList.add('custom-aspect-ratio');
                }

                // Display the photo in the div
                const photoDiv = document.getElementById('photoElement');
                photoDiv.innerHTML = ''; // Clear previous content
                photoDiv.appendChild(img);
    
                // Revoke the object URL after the image is loaded or no longer needed
                img.addEventListener('load', () => {
                    URL.revokeObjectURL(dataUrl);
                });
            } else {
                console.error("No saved photo found.");
            }
        } catch (error) {
            console.error('Error displaying saved photo:', error);
        }
    }
    
    // Function to extract text from photo stored in IndexedDB
    async function extractTextFromPhoto(photoId) {
        try {
            // Open IndexedDB database
            const db = await idb.openDB('photos', 1);

            // Get the photo blob from IndexedDB
            const tx = db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const photoData = await store.get(photoId);
            const blob = photoData.blob;

            if (!blob) {
                console.error("No saved photo found.");
                return;
            }

            // Use Tesseract.js to recognize text from the image blob
            const { data: { text } } = await Tesseract.recognize(blob);

            // Display the extracted text in the textarea
            const textareaOCR = document.getElementById('textareaOCR');
            textareaOCR.value = text;
            textareaOCR.classList.remove('hidden');

            adjustTextareaHeight();
        } catch (error) {
            console.error('Error extracting text from photo:', error);
        }
    }

    // Change the height of the textarea based on content
    function adjustTextareaHeight() {
        const textareaOCR = document.getElementById('textareaOCR');
        const lineHeight = parseInt(getComputedStyle(textareaOCR).lineHeight);
        const lines = textareaOCR.value.split('\n').length;
        const minRows = textareaOCR.getAttribute('rows');
        // Calculate the number of rows based on content height
        let rows = Math.max(minRows, lines);
        // Set the height of the textarea
        textareaOCR.rows = rows;
    } 
    
    // Function to save text to IndexedDB
    async function saveText(photoId) {
        console.log("Photo ID: ", photoId);
        try {
            // Get the text from the textarea
            const textareaOCR = document.getElementById('textareaOCR');
            const text = textareaOCR.value.trim(); // Trim any leading or trailing whitespace

            // Open IndexedDB database
            const db = await idb.openDB('photos', 1);

            // Get the object store
            const tx = db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');

            // Get the photo data object by photoId
            const photoData = await store.get(photoId);

            if (photoData) {
                // Update the text field in the photo data object
                photoData.text = text;

                // Put the updated photo data object back into the object store
                await store.put(photoData, photoId);

                console.log('Text saved successfully:', text);

                const videoElement = document.getElementById('videoElement');
                const photoElement = document.getElementById('photoElement');
                videoElement.style.display = 'block';
                photoElement.innerHTML = ''; // Clear any saved photo
                photoElement.classList.add('hidden');
            } else {
                console.error("No saved photo found.");
            }
        } catch (error) {
            console.error('Error saving text:', error);
        }
    }   
});

window.onload = async function() {
    try {
        // Open IndexedDB database
        const db = await idb.openDB('photos', 1);

        // Get all keys in the object store
        const keys = await db.getAllKeys('photos');

        // Get the ID of the last item
        const lastItemId = keys[keys.length - 1];

        // If there are items in the database
        if (lastItemId !== undefined) {
            // Get the last item from the object store
            const lastItem = await db.get('photos', lastItemId);

            // Check if the last item contains text
            if (lastItem.text.trim() !== '') {
                console.log('Last item contains text. Skipping deletion.');
            } else {
                // Delete the last item from the object store
                await db.delete('photos', lastItemId);
                console.log('Last item removed from IndexedDB.');
            }
        } else {
            console.log('No item found in IndexedDB.');
        }
    } catch (error) {
        console.error('Error removing last item from IndexedDB on page load:', error);
    }
};