
import {
    map,
    disablePopupsOnActiveLayers,
    restorePopupsOnActiveLayers,
} from './map.js';

// import {
//     communitiesFill,
//     communitiesStroke
// } from './map.js';

let pendingCommunity;
let activeCreateFormPromise = false;

const createBtn = document.getElementById('createBtn');
const updateBtn = document.getElementById('updateBtn');
const dataEntryForm = document.getElementById('data-entry-form');

function removePendingCommunity() {
    if (pendingCommunity) {
        map.removeLayer(pendingCommunity);
        pendingCommunity = null;
    }
}

// ----------------------
// DATA ENTRY FORM
// ----------------------
function setupDataEntryForm() {
    
    const closeFormBtn = dataEntryForm.querySelector('.btn-close');

    return new Promise((resolve, reject) => {
        if (activeCreateFormPromise) {
            reject(new Error('Form already active'));
            return;
        }

        activeCreateFormPromise = true;

        const handleClose = () => {
            dataEntryForm.classList.add('hidden');
            cleanup();
            resolve(null);
        };

        const handleSubmit = (e) => {
            e.preventDefault();

            const formData = {
                point_name: document.getElementById('point_name').value,
            };

            console.log('Form submitted:', formData);

            dataEntryForm.classList.add('hidden');
            cleanup();
            resolve(formData);
        };

        function cleanup() {
            activeCreateFormPromise = false;
            closeFormBtn.removeEventListener('click', handleClose);
            dataEntryForm.removeEventListener('submit', handleSubmit);
            removePendingCommunity();
        }

        closeFormBtn.addEventListener('click', handleClose);
        dataEntryForm.addEventListener('submit', handleSubmit);
    });
}


// ----------------------
// CREATE MODE
// ----------------------
function setupCreateMode(map) {
    let createMode = false;
    let createClickHandler = null;
    let pendingLatLng = null;
    let activeCreateFormPromise = null;

    createBtn.addEventListener('click', () => {
        createMode = !createMode;
        map.isCreateModeActive = createMode;

        if (createMode) {
            createBtn.textContent = "Disable Create Mode";
            updateBtn.disabled = true;

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';

            disablePopupsOnActiveLayers();

            createClickHandler = async (e) => {
                if (activeCreateFormPromise) {
                    console.log('Form already active, ignoring click');
                    return;
                }

                const { lat, lng } = e.latlng;
                pendingLatLng = { lat, lng };

                removePendingCommunity();

                pendingCommunity = L.circleMarker([lat, lng], {
                    radius: 4,
                    color: '#00ffff',
                    fillColor: '#00FFFF',
                    fillOpacity: 1,
                }).addTo(map);

                map.setView([lat, lng], map.getZoom());

                dataEntryForm.reset();
                dataEntryForm.classList.remove('hidden');
                
                activeCreateFormPromise = setupDataEntryForm();
                console.log('Created form promise:', activeCreateFormPromise);
                // disable createBtn until form is resolved to prevent multiple clicks
                createBtn.disabled = true;
                updateBtn.disabled = true;

                try {
                    console.log('Waiting for form submission...');
                    const formData = await activeCreateFormPromise;

                    // user cancelled
                    if (!formData || !pendingLatLng) return;

                    const { lat, lng } = pendingLatLng;

                    const postRes = await fetch('/api/custom-communities', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            lat,
                            lon: lng,
                            name: formData.point_name
                        })
                    });

                    const data = await postRes.json();

                    if (!postRes.ok) {
                        throw new Error(data.error || 'Failed to save');
                    }

                    await fetch('/api/custom-communities');

                    removePendingCommunity();

                    const checkbox = document.querySelector('input[data-id="custom-communities"]');
                    checkbox.click();
                    checkbox.click();

                    console.log('Saved to GeoPackage:', data);

                } catch (err) {
                    console.error('Error:', err);
                    removePendingCommunity();
                } finally {
                    pendingLatLng = null;
                    activeCreateFormPromise = null;
                    createBtn.disabled = false;
                }
            };

            map.on('click', createClickHandler);

        } else {
            // EXIT Create MODE
            createBtn.textContent = "Create Community";

            map.off('click', createClickHandler);
            createClickHandler = null;

            const mapContainer = map.getContainer();
            mapContainer.classList.remove('edit-mode-active');
            mapContainer.style.cursor = '';

            restorePopupsOnActiveLayers();

            if (pendingCommunity) map.removeLayer(pendingCommunity);
            pendingCommunity = null;

            pendingLatLng = null;
            activeCreateFormPromise = null;

            //close form if open
            dataEntryForm.reset();
            dataEntryForm.classList.add('hidden');
            updateBtn.disabled = false;
        }
    });
}

export {
    setupCreateMode,
    setupDataEntryForm
};