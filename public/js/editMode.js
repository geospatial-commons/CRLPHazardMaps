
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

function removePendingCommunity() {
    if (pendingCommunity) {
        map.removeLayer(pendingCommunity);
        pendingCommunity = null;
    }
}

// ----------------------
// DATA ENTRY FORM
// ----------------------
function setupDataEntryForm(mode = 'create', featureContext = null) {

    return new Promise((resolve) => {

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

            dataEntryForm.classList.add('hidden');
            cleanup();
            resolve(formData);
        };

        const handleDelete = () => {
            dataEntryForm.classList.add('hidden');
            cleanup();
            resolve({ action: 'delete' });
        }

        function cleanup() {
            // activeCreateFormPromise = false;
            closeFormBtn.removeEventListener('click', handleClose);
            dataEntryForm.removeEventListener('submit', handleSubmit);
            const deleteBtn = document.getElementById('.btn-delete');
            if (deleteBtn) deleteBtn.removeEventListener('click', handleDelete);
            removePendingCommunity();
        }

        closeFormBtn.addEventListener('click', handleClose);
        dataEntryForm.addEventListener('submit', handleSubmit);

        const deleteBtn = dataEntryForm.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.style.display = mode === 'update' ? 'block' : 'none';
            deleteBtn.addEventListener('click', handleDelete);
        }
    });
}


// ----------------------
// CREATE MODE
// ----------------------
function setupCreateMode() {
    let createMode = false;
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

                    const customCommunityCheckbox = document.querySelector('input[data-id="custom-communities"]');
                    customCommunityCheckbox.click();
                    customCommunityCheckbox.click();

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

function setupUpdateMode() {
    let updateMode = false;
    let updateClickHandler = null;
    let pendingLatLng = null;
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

                                activeUpdateFormPromise = setupDataEntryForm('update', fContext);
                                console.log('Created update form promise:', activeUpdateFormPromise);
                                // disable createBtn until form is resolved to prevent multiple clicks
                                createBtn.disabled = true;
                                updateBtn.disabled = true;

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