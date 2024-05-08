document.addEventListener('DOMContentLoaded', async function() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const clearSearch = document.getElementById('clearSearch');

    const db = await idb.openDB('photos', 1);
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const notes = await store.getAll();

    renderNotes(notes);

    searchForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const searchTerm = searchInput.value.trim().toLowerCase();
        const filteredNotes = notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
        renderNotes(filteredNotes);
    });

    clearSearch.addEventListener('click', function() {
        searchInput.value = '';
        renderNotes(notes);
    });

    deleteButtonClickHandler(notes);
});


function renderNotes(notes) 
{
    cardContainer.innerHTML = '';
    notes.forEach((note, index) => {
        if (note.text != "") {
            const card = createCard(note, index);
            cardContainer.appendChild(card);
        }
    });
}

function createCard(note, index)
{
    // console.log("Card index:" + index);
    const card = document.createElement('div');
    card.classList.add('card-wrapper', 'col-md-4', 'col-sm-6');
    const imageURL = URL.createObjectURL(note.blob);
    card.innerHTML = `
        <div class="card">
            <img class="card-img-top" src="${imageURL}" alt="Card image">
            <div class="card-body">
                <p class="card-text">${note.text}</p>
                <div class="text-right">
                    <a href="#" id="btn-${index}" class="btn btn-danger delete-btn"><i class="material-icons">delete</i></a>
                </div>
            </div>
        </div>
    `;
    return card;
}

function deleteButtonClickHandler(notes)
{
    const deleteBtns = document.querySelectorAll('.delete-btn');
    deleteBtns.forEach((btn) => {
        btn.addEventListener('click', async function(event) {
            event.preventDefault();
            const index = parseInt(btn.id.split('-')[1]); // Extracting the index from the button id
            console.log("Btn id:" + btn.id);
            console.log("Delete index:" + index);
            const note = notes[index];
            console.log("Delete note:", note);

            const db = await idb.openDB('photos', 1);
            const tx = db.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');

            const keys = await store.getAllKeys();
            console.log("Keys:", keys);
            const key = keys[index];
            console.log("Key:", key);

            await store.delete(key);
            await tx.complete;
            const updatedNotes = await store.getAll();
            renderNotes(updatedNotes);
            deleteButtonClickHandler(updatedNotes);
        });
    });
}