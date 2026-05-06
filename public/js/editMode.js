
import {
    map,
    customCommunityLayer,
    disablePopupsOnActiveLayers,
    restorePopupsOnActiveLayers
} from './map.js';

let pendingCommunity;
let updateCustomCommunities = null;

const createBtn = document.getElementById('btn-create');
const updateBtn = document.getElementById('btn-update');
const dataEntryForm = document.getElementById('data-entry-form');
const closeFormBtn = dataEntryForm.querySelector('.btn-close');
const deleteBtn = dataEntryForm.querySelector('.btn-delete');
var createMode = false;
var updateMode = false;

function removePendingCommunity() {
    if (pendingCommunity) {
        map.removeLayer(pendingCommunity);
        pendingCommunity = null;
    }
}



// ----------------------
// DATA ENTRY FORM
// ----------------------
//function setupDataEntryForm(mode = 'create', featureContext = null) {


async function handleSubmitForm(e) {
    e.preventDefault();
    let url = '/api/custom-communities';

    // let's undertand the mode and context before submitting
    if (createMode) {
        console.log('Submitting form in CREATE mode');
    } else if (updateMode) {
        console.log('Submitting form in UPDATE mode');
        url += '/update';
    }

    // Disable button to prevent double-submissions
    createBtn.disabled = true;

    try {
        console.log('Processing form submission...');

        // 1. Extract data
        const rawData = new FormData(e.target);
        const formData = Object.fromEntries(rawData.entries());
        console.log(formData);
        
        // 2. Await the Fetch call
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lat: Number(formData.coord_y),
                lon: Number(formData.coord_x),
                name: formData.point_name,
                community_id: document.getElementById('community_id').value || null
            })
        });

        // 3. Parse the response body
        const data = await res.json();

        // 4. Check for server-side errors
        if (!res.ok) {
            throw new Error(data.error || 'Failed to save');
        }

        // --- SUCCESS LOGIC STARTS HERE ---
        console.log('Saved successfully:', data);

        removePendingCommunity();

        // Refresh the layer by toggling the checkbox
        const customCommunityCheckbox = document.querySelector('input[data-id="custom-communities"]');
        if (customCommunityCheckbox) {
            customCommunityCheckbox.click(); // Turn off/on to refresh
            customCommunityCheckbox.click();
        }

        // Hide form and cleanup
        dataEntryForm.classList.add('hidden');
        cleanup();

    } catch (err) {
        // --- ERROR LOGIC STARTS HERE ---
        console.error('Error:', err);
        alert('Failed to save: ' + err.message);

        // Decide if you want to remove the pending community on failure
        // removePendingCommunity(); 
    } finally {
        // Re-enable button regardless of success or failure
        createBtn.disabled = false;
    }
}

const handleCloseForm = (mode) => {
    dataEntryForm.classList.add('hidden');

    if (mode === 'create') {
        createBtn.disabled = false;
    } else if (mode === 'update') {
        updateBtn.disabled = false;
    }
    cleanup();
};

const handleDelete = () => {
    dataEntryForm.classList.add('hidden');
    cleanup();
}

function cleanup() {
    // activeCreateFormPromise = false;
    const deleteBtn = document.getElementById('.btn-delete');
    if (deleteBtn) deleteBtn.removeEventListener('click', handleDelete);
    removePendingCommunity();
}

closeFormBtn.addEventListener('click', () => handleCloseForm(createMode ? 'create' : 'update'));
dataEntryForm.addEventListener('submit', handleSubmitForm);


// ----------------------
// CREATE MODE
// ----------------------
function setupCreateMode() {

    let createClickHandler = null;
    let pendingLatLng = null;
    let activeCreateFormPromise = null;



    createBtn.addEventListener('click', () => {
        createMode = !createMode;
        map.isEditModeActive = createMode;

        if (createMode) {
            createBtn.textContent = "Disable Create Mode";
            updateBtn.disabled = true;

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';

            disablePopupsOnActiveLayers();

            createClickHandler = async (e) => {

                const { lat, lng } = e.latlng;

                removePendingCommunity();

                pendingCommunity = L.circleMarker([lat, lng], {
                    radius: 4,
                    color: '#00ffff',
                    fillColor: '#00FFFF',
                    fillOpacity: 1,
                }).addTo(map);

                map.setView([lat, lng], map.getZoom());

                dataEntryForm.classList.remove('hidden');

                document.getElementById('coord_y').value = lat;
                document.getElementById('coord_x').value = lng;

                console.log('Created form promise:', activeCreateFormPromise);
                // disable createBtn until form is resolved to prevent multiple clicks
                createBtn.disabled = true;
                updateBtn.disabled = true;

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

            //pendingLatLng = null;
            activeCreateFormPromise = null;

            //close form if open
            dataEntryForm.reset();
            dataEntryForm.classList.add('hidden');
            updateBtn.disabled = false;
        }
    });
}

function setupUpdateMode() {
    
    let updateClickHandler = null;
    //let pendingLatLng = null;
    let activeUpdateFormPromise = null;

    updateBtn.addEventListener('click', () => {
        // updateBtn.addEventListener('click', async () => {
        const customCommunityCheckbox = document.querySelector('input[data-id="custom-communities"]');

        const customCircleIcon = L.divIcon({
            className: '', // prevent default styles
            html: `<div class="custom-circle-marker"></div>`,
            iconSize: [10, 10], // roughly 2 * radius
            iconAnchor: [5, 5]  // center it
        });

        updateMode = !updateMode;
        map.isEditModeActive = updateMode;

        if (updateMode) {
            updateBtn.textContent = "Disable Update Mode";
            createBtn.disabled = true;

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';

            disablePopupsOnActiveLayers();


            if (customCommunityCheckbox.checked === true) {
                customCommunityCheckbox.click();
            }
            customCommunityCheckbox.disabled = true;
            
            // creating a new layer here instead of using the existing customCommunityLayer to avoid conflicts with popups and editing
            fetch('/api/custom-communities')
                .then(res => {
                    console.log('Fetch custom communities response:', res);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(async data => {
                    updateCustomCommunities = L.geoJSON(data, {
                        pointToLayer: function (feature, latlng) {
                            return L.marker(latlng, {
                                draggable: true,
                                icon: customCircleIcon
                            });
                        },
                        onEachFeature: function (f, l) {
                            if (f.properties && f.properties.name) {
                                l.bindPopup(`<b>Community:</b> ${f.properties.name}`, { className: 'community-popup' });
                            }

                            // listen for drag events
                            l.on('dragend', function (e) {
                                const newLatLng = e.target.getLatLng();
                                console.log('Marker dragged to:', newLatLng);
                                dataEntryForm.reset();
                                dataEntryForm.classList.remove('hidden');

                                let fContext = {
                                    community_id: f.properties.community_id,
                                    lat: newLatLng.lat,
                                    lon: newLatLng.lng,
                                    name: f.properties.name,
                                }

                                console.log('Feature context from drag:', fContext);

                                //activeUpdateFormPromise = setupDataEntryForm('update', fContext);
                                console.log('Created update form promise:', activeUpdateFormPromise);
                                // disable createBtn until form is resolved to prevent multiple clicks
                                //createBtn.disabled = true;
                                //updateBtn.disabled = true;

                                //update the form coordinates with the new marker position
                                dataEntryForm.querySelector('#coord_y').value = newLatLng.lat;
                                dataEntryForm.querySelector('#coord_x').value = newLatLng.lng;

                                document.getElementById('community-id-group').style.display = 'block';
                                document.getElementById('community_id').value = fContext.community_id;
                                document.getElementById('point_name').value = fContext.name;
                            });

                            l.on('click', async function (e) {
                                const latlng = e.latlng;
                                dataEntryForm.reset();
                                dataEntryForm.classList.remove('hidden');

                                let fContext = {
                                    community_id: f.properties.community_id,
                                    lat: latlng.lat,
                                    lon: latlng.lng,
                                    name: f.properties.name,

                                }

                                console.log('Feature context from click:', fContext);

                                activeUpdateFormPromise = setupDataEntryForm('update', fContext);
                                console.log('Created update form promise:', activeUpdateFormPromise);
                                // disable createBtn until form is resolved to prevent multiple clicks
                                createBtn.disabled = true;
                                updateBtn.disabled = true;

                                document.getElementById('community-id-group').style.display = 'block';
                                document.getElementById('community_id').value = fContext.community_id;
                                document.getElementById('point_name').value = fContext.name;

                                try {
                                    const updateData = await activeUpdateFormPromise;
                                    console.log('Update form data:', updateData);
                                } catch (err) {
                                    console.error('Error in update form:', err);
                                } finally {
                                    activeUpdateFormPromise = null;
                                    updateBtn.disabled = false;
                                    document.getElementById('community-id-group').style.display = 'none';
                                }
                            })

                        }
                    });
                    updateCustomCommunities.addTo(map)
                })
                .catch(err => {
                    console.error('Error loading custom communities:', err);
                    alert('Failed to load custom communities for editing.');
                });

        } else { // EXIT Update MODE
            updateBtn.textContent = "Update Community";
            createBtn.disabled = false;
            updateBtn.disabled = false;

            const mapContainer = map.getContainer();
            mapContainer.classList.remove('edit-mode-active');
            mapContainer.style.cursor = '';
            customCommunityCheckbox.disabled = false;
            restorePopupsOnActiveLayers();
            if (updateCustomCommunities) {
                map.removeLayer(updateCustomCommunities);
                updateCustomCommunities = null;
            }
        }

    });
}

export {
    setupCreateMode,
    setupUpdateMode
};