import { disablePopupsOnActiveLayers, restorePopupsOnActiveLayers, disablePopupsOnLayer, setupDataEntryForm } from './map.js';
import { communitiesFill, communitiesStroke } from './map.js';

let circle; // Declare circle variable in outer scope to access in click handler and for cleanup

function setupEditMode(map, buttonId) {
    let editMode = false;
    let createClickHandler = null;
    let pendingLatLng = null; // Store lat/lng of pending settlement creation for use in form submission
    let activeFormPromise = null; // Track active form promise to prevent multiple forms from being opened simultaneously

    const editBtn = document.getElementById(buttonId);

    editBtn.addEventListener('click', () => {
        activeFormPromise = null; // Reset active form promise on each click to allow new form to be created if previous one was left open
        editMode = !editMode;
        // Store edit mode state on map object for access by layer addition logic
        map.isEditModeActive = editMode;

        if (editMode) {
            editBtn.textContent = "Disable Edit Mode";

            const mapContainer = map.getContainer();
            mapContainer.classList.add('edit-mode-active');
            mapContainer.style.cursor = 'crosshair';
            // setupDataEntryForm();
            disablePopupsOnActiveLayers();

            activeFormPromise = setupDataEntryForm();

            activeFormPromise.then(async (formData) => {
                if (!pendingLatLng) return; // No pending lat/lng, likely form was submitted without clicking on map first

                const { lat, lng } = pendingLatLng;

                try {
                    // 3. send to backend
                    const postRes = await fetch('/api/custom-settlements', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            lat: lat,
                            lon: lng,
                            name: formData.point_name
                        })
                    });

                    const data = await postRes.json();

                    if (!postRes.ok) {
                        throw new Error(data.error || 'Failed to save');
                    }

                    await fetch('/api/custom-settlements'); // Refresh settlements layer to include new settlement

                    if (circle) map.removeLayer(circle);

                    const customSettlementCheckbox = document.querySelector('input[data-id="custom-settlements"]');
                    customSettlementCheckbox.click(); // uncheck to remove old layer
                    customSettlementCheckbox.click(); // re-check to add updated layer with new settlement

                    console.log('Saved to GeoPackage:', data);
                } catch (err) {
                    console.error(err);
                    if (circle) map.removeLayer(circle);
                    alert("Failed to save location");
                };

                pendingLatLng = null
                activeFormPromise = null
            }).catch(() => {
                if (circle) map.removeLayer(circle);
                pendingLatLng = null
                activeFormPromise = null
            });

            createClickHandler = (e) => {
                const { lat, lng } = e.latlng
                pendingLatLng = { lat, lng };

                if (circle) {
                    map.removeLayer(circle);
                }

                // change marker to circle with red border and transparent fill to indicate it's being created
                circle = L.circleMarker([lat, lng], {
                    radius: 4,
                    color: '#00ffff',
                    fillColor: '#00FFFF',
                    fillOpacity: 100,
                }).addTo(map);

                // center map on new marker
                map.setView([lat, lng], map.getZoom());

                const formEl = document.getElementById('data-entry-form');
                formEl.reset(); // clear previous values
                formEl.classList.remove('hidden');
            };
            map.on('click', createClickHandler);
        } else { // exiting edit mode
            editBtn.textContent = "Enable Edit Mode";

            map.off('click', createClickHandler);
            createClickHandler = null;
            const mapContainer = map.getContainer();
            mapContainer.classList.remove('edit-mode-active');
            mapContainer.style.cursor = '';

            // Restore popups on all active layers when exiting edit mode
            restorePopupsOnActiveLayers();

            if (circle) map.removeLayer(circle);
            circle = null

            pendingLatLng = null
            activeFormPromise = null
        }

    });
}

export { setupEditMode, disablePopupsOnLayer };