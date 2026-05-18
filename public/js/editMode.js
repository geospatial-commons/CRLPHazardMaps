
import {
    map,
    communityLayer,
    customCommunityLayer,
    disablePopupsOnActiveLayers,
    restorePopupsOnActiveLayers,
    communitiesStroke,
    communitiesFill
} from './map.js';

let createClickHandler = null;
let pendingCommunity;
let existing_community_id = null;
let updateCustomCommunities = null;
let activeMarker = null;
let validCoords = null;
let coord_x = document.getElementById('coord_x');
let coord_y = document.getElementById('coord_y');
let template;
let activeMarkerOriginalLatLng = null;
let hasDragged = false;

const AFGHANISTAN_BOUNDS = {
    minLat: 29.3,
    maxLat: 38.5,
    minLon: 60.5,
    maxLon: 74.9
};

const defaultIcon = L.divIcon({
    className: '', // prevent default styles
    html: `<div class="custom-circle-marker"></div>`,
    iconSize: [10, 10], // roughly 2 * radius
    iconAnchor: [5, 5]  // center it
});

const selectedIcon = L.divIcon({
    className: '',
    html: `<div class="custom-circle-marker selected"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
});

// const cursorTooltip = L.tooltip({
//     permanent: true,
//     direction: 'top',
//     offset: [0, -10],
//     className: 'cursor-tooltip'
// })

const createBtn = document.getElementById('btn-create');
const updateBtn = document.getElementById('btn-update');
const dataEntryForm = document.getElementById('data-entry-form');
const closeFormBtn = dataEntryForm.querySelector('.btn-close');
const deleteBtn = dataEntryForm.querySelector('.btn-delete');
const coordsContainer = dataEntryForm.querySelector('.coords-and-button')
const setCoordsBtn = document.getElementById('set-coords-btn');

var createMode = false;
var updateMode = false;

function removePendingCommunity() {
    if (pendingCommunity) {
        map.removeLayer(pendingCommunity);
        pendingCommunity = null;
    }
}

function resetCommunityLayerStyle() {
    communityLayer.setStyle({
        radius: 5,
        fillColor: communitiesFill,
        color: communitiesStroke,
        weight: 1
    })
}

function refreshCustomCommunities() {
    const customCommunityCheckbox = document.querySelector('input[data-id="custom-communities"]');
    if (customCommunityCheckbox) {
        customCommunityCheckbox.click(); // Turn off/on to refresh
        customCommunityCheckbox.click();
    }
}


function validateCoords() {

    const existingMessage = coordsContainer.querySelector('.coord-error-message');
    if (existingMessage) {
        existingMessage.remove();
    }

    const lat = Number(coord_y.value);
    const lon = Number(coord_x.value);

    // Skip validation if fields are empty
    if (coord_y.value === '' || coord_x.value === '') {
        console.log('empty coords')
        coord_x.classList.remove('coord-input-error');
        coord_y.classList.remove('coord-input-error');
        return true;
    }

    const isWithinAfghanistan =
        lat >= AFGHANISTAN_BOUNDS.minLat &&
        lat <= AFGHANISTAN_BOUNDS.maxLat &&
        lon >= AFGHANISTAN_BOUNDS.minLon &&
        lon <= AFGHANISTAN_BOUNDS.maxLon;

    if (!isWithinAfghanistan) {

        coord_x.classList.add('coord-input-error');
        coord_y.classList.add('coord-input-error');

        const invalidCoordsMessage = document.createElement('div');
        invalidCoordsMessage.className = 'coord-error-message';
        invalidCoordsMessage.textContent = 'Coordinates must be within Afghanistan.';

        coordsContainer.appendChild(invalidCoordsMessage);

        // Remove after 5 seconds
        setTimeout(() => {
            invalidCoordsMessage.remove();
        }, 5000);


        return false
    }

    coord_x.classList.remove('coord-input-error');
    coord_y.classList.remove('coord-input-error');

    return true
}

coord_x.addEventListener('blur', validateCoords);
coord_y.addEventListener('blur', validateCoords);

// ----------------------
// DATA ENTRY FORM
// ----------------------
//function setupDataEntryForm(mode = 'create', featureContext = null) {


async function handleSubmitForm(e) {
    e.preventDefault();
    let url = '/api/custom-communities';
    let community_id = '';


    // let's undertand the mode and context before submitting
    if (createMode) {
        console.log('Submitting form in CREATE mode');
        community_id = null; // or generate a temporary ID if needed
    } else if (updateMode) {
        console.log('Submitting form in UPDATE mode');
        url += '/update';

        const id = document.getElementById('community_id').value;

        if (!template) {
            community_id = id
        } else {
            existing_community_id = id
        }

    }

    try {
        console.log('Processing form submission...');

        // 1. Extract data
        const rawData = new FormData(e.target);
        const formData = Object.fromEntries(rawData.entries());
        console.log(formData);
        const lat = Number(formData.coord_y)
        const lon = Number(formData.coord_x)

        validCoords = validateCoords();
        if (!validCoords) {
            console.log('invalid coords')
            return
        };

        // 2. Await the Fetch call
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lat: lat,
                lon: lon,
                name: formData.point_name,
                community_id: community_id,
                existing_community_id: existing_community_id
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

        // Refresh the layer by toggling the checkbox
        refreshCustomCommunities();

        // Hide form and cleanup
        dataEntryForm.classList.add('hidden');
        cleanup();

    } catch (err) {
        // --- ERROR LOGIC STARTS HERE ---
        console.error('Error:', err);
        alert('Failed to save: ' + err.message);


    } finally {
        // if in update mode, refresh the custom communities layer in update mode to reflect any changes. 
        if (updateMode) {
            loadCustomCommunitiesLayer();
        }
        if (!validCoords) {
            return
        } else {
            handleCloseForm(createMode ? 'create' : 'update');
        }
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

    if (activeMarker) {
        activeMarker.setIcon(defaultIcon);
    }
};

const handleDelete = async (e) => {
    e.preventDefault()
    console.log('Deleting community...');
    const rawData = new FormData(dataEntryForm);
    const formData = Object.fromEntries(rawData.entries());
    console.log(formData);
    const community_id = document.getElementById('community_id').value
    console.log(community_id);

    const lat = Number(formData.coord_y)
    const lon = Number(formData.coord_x)
    // 2. Await the Fetch call
    const res = await fetch('/api/custom-communities', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lat: lat,
            lon: lon,
            name: formData.point_name,
            community_id: community_id,
            existing_community_id: existing_community_id
        })
    });

    // Parse the response body
    const data = await res.json();

    loadCustomCommunitiesLayer();
    // Refresh the layer by toggling the checkbox
    refreshCustomCommunities();

    dataEntryForm.classList.add('hidden');
    updateBtn.disabled = false;
    cleanup();
}

function cleanup() {
    removePendingCommunity();
    if (communityLayer) {
        resetCommunityLayerStyle();
    }
    template = false;
    existing_community_id = null;
}

closeFormBtn.addEventListener('click', () => handleCloseForm(createMode ? 'create' : 'update'));
dataEntryForm.addEventListener('submit', handleSubmitForm);
deleteBtn.addEventListener('click', handleDelete);
dataEntryForm.addEventListener('reset', () => {
    setTimeout(() => {
        validateCoords();
    }, 0);
});

setCoordsBtn.addEventListener('click', () => {
    const lat = parseFloat(coord_y.value);
    const lng = parseFloat(coord_x.value);
    map.setView([lat, lng], map.getZoom());

    if (createMode) {
        removePendingCommunity();
        pendingCommunity = L.marker([lat, lng], {
            icon: defaultIcon
        }).addTo(map);
    } else if (updateMode && activeMarker) {
        activeMarker.setLatLng([lat, lng]);
    } else if (updateMode && pendingCommunity) {
        removePendingCommunity();
        pendingCommunity = L.marker([lat, lng], {
            icon: selectedIcon
        }).addTo(map);
    }
});

// ----------------------
// CREATE MODE
// ----------------------
function setupCreateMode() {

    let createClickHandler = null;

    createBtn.addEventListener('click', () => {
        createMode = !createMode;
        map.isEditModeActive = createMode;

        if (createMode) {
            disablePopupsOnActiveLayers();
            createBtn.textContent = "Disable Create Mode";
            updateBtn.disabled = true;
            document.getElementById('community-id-group').style.display = 'none';
            deleteBtn.style.display = 'none';

            // cursorTooltip.setContent('Click on any community')
            // cursorTooltip.addTo(map);

            // map.on('mousemove', function (e) {
            //     cursorTooltip.setLatLng(e.latlng);
            // });

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';

            createClickHandler = async (e) => {

                const { lat, lng } = e.latlng;
                removePendingCommunity();
                pendingCommunity = L.marker([lat, lng], {
                    icon: defaultIcon
                }).addTo(map);

                map.setView([lat, lng], map.getZoom());
                dataEntryForm.reset();
                dataEntryForm.classList.remove('hidden');
                coord_y.value = lat;
                coord_x.value = lng;
                validateCoords()
                // disable createBtn until form is resolved to prevent multiple clicks
                createBtn.disabled = true;
                updateBtn.disabled = true;
            };

            map.on('click', createClickHandler);

        } else {
            // EXIT Create MODE
            createBtn.textContent = "Create Community";

            // map.removeLayer(cursorTooltip); 


            map.off('click', createClickHandler);
            createClickHandler = null;

            const mapContainer = map.getContainer();
            mapContainer.classList.remove('edit-mode-active');
            mapContainer.style.cursor = '';

            restorePopupsOnActiveLayers();

            if (pendingCommunity) map.removeLayer(pendingCommunity);
            pendingCommunity = null;

            //close form if open
            dataEntryForm.reset();
            dataEntryForm.classList.add('hidden');
            updateBtn.disabled = false;
        }
    });
}

function setupUpdateMode() {
    let updateClickHandler = null;
    let communityClickHandler = null;
    //let pendingLatLng = null;

    updateBtn.addEventListener('click', () => {

        const customCommunityCheckbox = document.querySelector('input[data-id="custom-communities"]');
        updateMode = !updateMode;
        map.isEditModeActive = updateMode;
        console.log("map.isEditModeActive: ", updateMode);

        if (updateMode) {
            updateBtn.textContent = "Disable Update Mode";
            createBtn.disabled = true;
            disablePopupsOnActiveLayers();

            loadCustomCommunitiesLayer();

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';


            communityClickHandler = function (e) {
                resetCommunityLayerStyle();
                deleteBtn.style.display = 'none';

                if (activeMarker) {
                    activeMarker.setLatLng(activeMarker.originalLatLng);
                    activeMarker.setIcon(defaultIcon);
                }

                const layer = e.layer;
                console.log(layer.feature.properties);
                const existingFeatureProps = layer.feature.properties;
                const { lat, lng } = e.latlng;
                removePendingCommunity();

                pendingCommunity = L.marker([lat, lng], {
                    icon: selectedIcon,
                    draggable: true
                }).addTo(map);

                pendingCommunity.on('dragend', function (event) {
                    const marker = event.target;
                    const { lat, lng } = marker.getLatLng();

                    console.log('Marker dragged to:', lat, lng);

                    // Update form fields
                    dataEntryForm.querySelector('#coord_y').value = lat;
                    dataEntryForm.querySelector('#coord_x').value = lng;

                    validateCoords();
                });

                dataEntryForm.reset();
                dataEntryForm.classList.remove('hidden');
                document.getElementById('community-id-group').style.display = 'block';

                dataEntryForm.querySelector('#coord_y').value = existingFeatureProps.coord_y;
                dataEntryForm.querySelector('#coord_x').value = existingFeatureProps.coord_x;

                validateCoords()

                document.getElementById('community_id').value = existingFeatureProps.fid;
                document.getElementById('point_name').value = existingFeatureProps.name;

                template = true;
            };

            communityLayer.on('click', communityClickHandler)


            disablePopupsOnActiveLayers();


            if (customCommunityCheckbox.checked === true) {
                customCommunityCheckbox.click();
            }
            customCommunityCheckbox.disabled = true;

        } else { // EXIT Update MODE
            updateBtn.textContent = "Update Community";
            createBtn.disabled = false;
            updateBtn.disabled = false;
            removePendingCommunity();
            const mapContainer = map.getContainer();
            mapContainer.classList.remove('edit-mode-active');
            mapContainer.style.cursor = '';

            communityLayer.off('click', communityClickHandler)

            customCommunityCheckbox.disabled = false;
            restorePopupsOnActiveLayers();
            if (updateCustomCommunities) {
                map.removeLayer(updateCustomCommunities);
                updateCustomCommunities = null;
            }
        }

    });
}

function loadCustomCommunitiesLayer() {

    if (updateCustomCommunities) {
        map.removeLayer(updateCustomCommunities);
        updateCustomCommunities = null;
    }

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
                        icon: defaultIcon
                    });
                },
                onEachFeature: function (f, l) {
                    if (f.properties && f.properties.name) {
                        l.bindPopup(`<b>Community:</b> ${f.properties.name}`, { className: 'community-popup' });
                    }
                    l.originalLatLng = l.getLatLng();
                    existing_community_id = f.properties.existing_community_id

                    l.on('dragstart', function () {

                        if (activeMarker && activeMarker !== l) {
                            activeMarker.setLatLng(activeMarker.originalLatLng);
                            activeMarker.setIcon(defaultIcon);
                        }

                        // activeMarker = l;
                        // l.setIcon(selectedIcon);
                    });


                    // listen for drag events
                    l.on('dragend', function (e) {

                        existing_community_id = f.properties.existing_community_id

                        const newLatLng = e.target.getLatLng();

                        dataEntryForm.reset();
                        dataEntryForm.classList.remove('hidden');

                        map.setView([newLatLng.lat, newLatLng.lng], map.getZoom());

                        if (pendingCommunity) {
                            removePendingCommunity();
                        }

                        // Set current active marker
                        activeMarker = l;

                        // Highlight current marker
                        l.setIcon(selectedIcon);

                        let fContext = {
                            community_id: f.properties.community_id,
                            existing_community_id: existing_community_id,
                            lat: newLatLng.lat,
                            lon: newLatLng.lng,
                            name: f.properties.name,
                        }

                        console.log('Feature context from drag:', fContext);

                        //update the form coordinates with the new marker position
                        dataEntryForm.querySelector('#coord_y').value = newLatLng.lat;
                        dataEntryForm.querySelector('#coord_x').value = newLatLng.lng;

                        coord_x.value = fContext.lon;
                        coord_y.value = fContext.lat;

                        validateCoords()

                        document.getElementById('community-id-group').style.display = 'block';
                        document.getElementById('community_id').value = fContext.community_id;
                        document.getElementById('point_name').value = fContext.name;
                    });

                    l.on('click', async function (e) {
                        existing_community_id = f.properties.existing_community_id
                        console.log('Existing community id clicked:', existing_community_id);

                        // reset previous selected marker
                        if (activeMarker && activeMarker !== l) {
                            activeMarker.setLatLng(activeMarker.originalLatLng);
                            activeMarker.setIcon(defaultIcon);
                        }

                        if (pendingCommunity) {
                            removePendingCommunity();
                        }

                        // highlight clicked marker
                        l.setIcon(selectedIcon);
                        activeMarker = l;

                        const latlng = e.latlng;
                        map.setView([latlng.lat, latlng.lng], map.getZoom());
                        dataEntryForm.reset();
                        dataEntryForm.classList.remove('hidden');
                        deleteBtn.style.display = 'block';

                        createBtn.disabled = true;
                        updateBtn.disabled = true;


                        let fContext = {
                            community_id: f.properties.community_id,
                            existing_community_id: existing_community_id,
                            lat: latlng.lat,
                            lon: latlng.lng,
                            name: f.properties.name,

                        }

                        console.log('Feature context from click:', fContext);

                        document.getElementById('community-id-group').style.display = 'block';
                        document.getElementById('community_id').value = fContext.community_id;
                        document.getElementById('point_name').value = fContext.name;
                        coord_x.value = fContext.lon;
                        coord_y.value = fContext.lat;

                        validateCoords()


                    })

                }
            });
            updateCustomCommunities.addTo(map)
        })
        .catch(err => {
            console.error('Error loading custom communities:', err);
            alert('Failed to load custom communities for editing.');
        });
}

export {
    setupCreateMode,
    setupUpdateMode
};