export function setupEditMode(map, buttonId) {
    let editMode = false;
    let clickHandler = null;

    const btn = document.getElementById(buttonId);

    btn.addEventListener('click', () => {
        editMode = !editMode;

        if (editMode) {
            btn.textContent = "Disable Edit Mode";

            clickHandler = async (e) => {
                const { lat, lng } = e.latlng;

                // 1. add marker immediately (UX feels instant)
                const marker = L.marker([lat, lng]).addTo(map);

                marker.bindPopup("test").openPopup();

                try {
                    // 2. send to backend
                    const res = await fetch('/create-settlements', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            lat: lat,
                            lon: lng,
                            name: 'test'
                        })
                    });



                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.error || 'Failed to save');
                    }

                    console.log('Saved to GeoPackage:', data);

                } catch (err) {
                    console.error(err);

                    // rollback UI if save fails
                    map.removeLayer(marker);
                    alert("Failed to save location");
                }
            };

            map.on('click', clickHandler);

        } else {
            btn.textContent = "Enable Edit Mode";

            map.off('click', clickHandler);
            clickHandler = null;
        }
    });
}
