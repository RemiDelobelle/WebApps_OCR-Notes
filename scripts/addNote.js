var _mediaStream = null;

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
            try {
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
            } catch (error) {
                console.log("Error: ", error);
            }   
        });
    }
    else
    {
        alert('No media devices support in this browser.');
    }

    const btnExtract = document.getElementById("btnExtract");
    const btnSelectFile = document.getElementById("btnSelectFile");
    const btnSave = document.getElementById("btnSave");
    const btnRestart = document.getElementById("btnRestart");

    const selectMediaDevice = document.getElementById('selectMediaDevice');
    const videoElement = document.getElementById('videoElement');
    const photoElement = document.getElementById('photoElement');
    const loadingAnimation = document.getElementById('loadingAnimation');
    const textareaOCR = document.getElementById('textareaOCR');

    selectMediaDevice.addEventListener('change', function() {
        checkSelectValue();        
    });

    btnExtract.addEventListener("click", function() {
        if (photoElement.innerHTML === '' && selectMediaDevice.value === 'None') {
            console.error("No photo found to extract text.");
            alert("No photo found to extract text.");
            return;
        }

        // checkPrevDBItem();
        textareaOCR.innerHTML = '';
        loadingAnimation.style.display = 'block';

        // Check and remove the previous DB item if its text is empty
        checkPrevDBItem().then(() => {
            if (selectMediaDevice.value === 'None') {
                savePhotoFromFile().then(() => {
                    loadingAnimation.style.display = 'none';
                });
            } else {
                takeAndSavePhoto().then(() => {
                    loadingAnimation.style.display = 'none';
                });
            }
        });
    });

    btnSelectFile.addEventListener("click", function() {
        if (_mediaStream) {
            _mediaStream.getTracks().forEach(track => {
                track.stop();
            });
        }
        if (videoElement) {
            videoElement.style.display = 'none';
        }

        if (selectMediaDevice) {
            selectMediaDevice.value = 'None';
        }

        // Create an input element of type file
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*'; // Only accept image files

        // Event listener for when a file is selected
        input.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                displaySelectedImage(file);
            }
        });

        // Trigger a click event to open the file explorer
        input.click();
    });

    btnSave.addEventListener("click", async function() {
        try {
            checkSelectValue()
            const db = await idb.openDB('photos', 1);
    
            const tx = db.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
    
            const keys = await store.getAllKeys();
    
            const maxKey = Math.max(...keys);
    
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
            const db = await idb.openDB('photos', 1);
    
            const keys = await db.getAllKeys('photos');
    
            const lastItemId = keys[keys.length - 1];
    
            if (lastItemId !== undefined) {
                await db.delete('photos', lastItemId);
                console.log('Last item removed from IndexedDB.');
    
                videoElement.style.display = 'block';
                photoElement.innerHTML = '';
                photoElement.classList.add('hidden');
                textareaOCR.value = '';
                checkSelectValue();
            } else {
                console.log('No item found in IndexedDB.');
            }
        } catch (error) {
            console.error('Error removing last item from IndexedDB:', error);
        }
    });  
});


window.onload = async function() {
    try {
        checkSelectValue();
        const db = await idb.openDB('photos', 1);

        const keys = await db.getAllKeys('photos');

        const lastItemId = keys[keys.length - 1];

        if (lastItemId !== undefined) {
            const lastItem = await db.get('photos', lastItemId);

            if (lastItem.text.trim() !== '') {
                console.log('Last item contains text. Skipping deletion.');
            } else {
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

        const dataUrl = canvas.toDataURL('image/jpeg');

        const blob = await fetch(dataUrl).then(res => res.blob());

        const db = await idb.openDB('photos', 1, {
            upgrade(db) {
                const photosStore = db.createObjectStore('photos', { autoIncrement: true });
                // Add a text field to the object store
                photosStore.createIndex('text', 'text', { unique: false });
            },
        });

        const tx = db.transaction('photos', 'readwrite');
        const store = tx.objectStore('photos');
        const photoId = await store.add({ blob, text: '' }); // Add no text to text field
        await tx.done;

        console.log("Photo saved with ID:", photoId);

        await showSavedPhoto(photoId);
        await extractTextFromPhoto(photoId);
    } catch (error) {
        console.error('Error taking and saving photo:', error);
    }
}

async function savePhotoFromFile() {
    try {
        const imgElement = document.querySelector('#photoElement img');
        if (!imgElement) {
            console.error("No image found in photoElement.");
            return;
        }

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;

        context.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg');

        const blob = await fetch(dataUrl).then(res => res.blob());

        const db = await idb.openDB('photos', 1, {
            upgrade(db) {
                const photosStore = db.createObjectStore('photos', { autoIncrement: true });
                photosStore.createIndex('text', 'text', { unique: false });
            },
        });

        const tx = db.transaction('photos', 'readwrite');
        const store = tx.objectStore('photos');
        const photoId = await store.add({ blob, text: '' }); // Add an empty text field
        console.log("Photo saved with ID:", photoId);
        await tx.done;

        console.log("Photo saved with ID:", photoId);

        await showSavedPhoto(photoId);
        await extractTextFromPhoto(photoId);
    } catch (error) {
        console.error('Error taking and saving photo from photoElement:', error);
    }
}

async function showSavedPhoto(photoId) {
    try {
        const db = await idb.openDB('photos', 1);

        const tx = db.transaction('photos', 'readonly');
        const store = tx.objectStore('photos');
        const photoData = await store.get(photoId);

        if (photoData) {
            const blob = photoData.blob;
            const dataUrl = URL.createObjectURL(blob);

            const img = document.createElement('img');
            img.src = dataUrl;
            img.alt = 'Saved Photo';
            img.style.maxWidth = '100%';
            
            if (videoElement) {
                videoElement.style.display = 'none';

                const parentDiv = videoElement.parentElement;
                parentDiv.classList.remove('embed-responsive', 'embed-responsive-16by9');
                parentDiv.classList.add('custom-aspect-ratio');
            }

            photoElement.innerHTML = ''; // Clear previous content
            photoElement.appendChild(img);

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

async function extractTextFromPhoto(photoId) {
    try {
        const db = await idb.openDB('photos', 1);

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

        textareaOCR.value = text;
        textareaOCR.classList.remove('hidden');

        adjustTextareaHeight();
    } catch (error) {
        console.error('Error extracting text from photo:', error);
    }
}

function adjustTextareaHeight() {
    const lines = textareaOCR.value.split('\n').length;
    const minRows = textareaOCR.getAttribute('rows');

    // Calculate the number of rows based on content height
    let rows = Math.max(minRows, lines);
    textareaOCR.rows = rows;
}

function displaySelectedImage(file) {
    try {
        const imageUrl = URL.createObjectURL(file);

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Selected Image';
        img.style.maxWidth = '100%';

        if (videoElement) {
            videoElement.style.display = 'none';
        }

        photoElement.innerHTML = ''; // Clear previous content
        photoElement.appendChild(img);

        img.addEventListener('load', () => {
            URL.revokeObjectURL(imageUrl);
        });
    } catch (error) {
        console.error('Error displaying selected image:', error);
    }
}

async function saveText(photoId) {
    console.log("Photo ID: ", photoId);
    try {
        const text = textareaOCR.value.trim();
        const escapedText = await escapeHTML(text);

        const db = await idb.openDB('photos', 1);

        const tx = db.transaction('photos', 'readwrite');
        const store = tx.objectStore('photos');

        const photoData = await store.get(photoId);

        if (photoData) {
            photoData.text = escapedText;

            await store.put(photoData, photoId);

            console.log('Text saved successfully:', escapedText);

            // videoElement.style.display = 'block';
            photoElement.innerHTML = ''; // Clear any saved photo
            photoElement.classList.add('hidden');
            textareaOCR.value = '';
        } else {
            console.error("No saved photo found.");
        }
    } catch (error) {
        console.error('Error saving text:', error);
    }
}

async function escapeHTML(html) {
    return html.replace(/[&<>"'`=\/]/g, function(match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            "`": '&#96;',
            '=': '&#x3D;',
            '/': '&#x2F;'
        }[match];
    });
}

function checkSelectValue() {
    if (selectMediaDevice.value === 'None') {
        videoElement.style.display = 'none';
    } else {
        videoElement.style.display = 'block';
    }
}

async function checkPrevDBItem() {
    try {
        const db = await idb.openDB('photos', 1);

        const keys = await db.getAllKeys('photos');

        const lastItemId = keys[keys.length - 1];

        if (lastItemId !== undefined) {
            const lastItem = await db.get('photos', lastItemId);

            if (lastItem.text.trim() !== '') {
                console.log('Last item contains text. Skipping deletion.');
            } else {
                await db.delete('photos', lastItemId);
                console.log('Last item removed from IndexedDB.');
            }
        } else {
            console.log('No item found in IndexedDB.');
        }
    } catch (error) {
        console.error('Error checking previous DB item:', error);
    }
}
