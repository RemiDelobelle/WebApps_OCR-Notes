document.addEventListener('DOMContentLoaded', async function() {
    const cardContainer = document.getElementById('cardContainer');

    const db = await idb.openDB('photos', 1);
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const notes = await store.getAll();
    
    notes.forEach((note) => {
        if (note.text != "") {
            const card = createCard(note);
            cardContainer.appendChild(card);
        }
    });
});

function createCard(note)
{
    const card = document.createElement('div');
    card.classList.add('card-wrapper', 'col-md-4', 'col-sm-6');
    const imageURL = URL.createObjectURL(note.blob);
    card.innerHTML = `
        <div class="card">
            <img class="card-img-top" src="${imageURL}" alt="Card image">
            <div class="card-body">
                <p class="card-text">${note.text}</p>
                <!-- <a href="#" class="btn btn-primary">Read More</a> -->
            </div>
        </div>
    `;
    return card;
}