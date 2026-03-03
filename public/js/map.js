// ----------------------
// GLOBAL VARIABLES
// ----------------------
let map;
let districtsLayer;
let districtData, settlementsLayer;
let hazardLayer, currentHazardLayer;
let hazardConfig = {};

// Layer Control Variables
let baseMaps = {};
let overlayLayers = {};
let layerControl;

const provSelect = document.getElementById('prov-select');
const distSelect = document.getElementById('dist-select');
const commSelect = document.getElementById('comm-select');
const snapshotBtn = document.getElementById('snapshot-btn');
const downloadPdfBtn = document.getElementById('download-pdf-btn')

// ----------------------
// INITIALIZE MAP
// ----------------------
function initMap() {
    map = L.map('map').setView([33.93, 67.68], 6);

    // ---- SET UP BASEMAPS ----
    // Add more basemaps here in the future by following this pattern:
    baseMaps['Esri Satellite'] = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        crossOrigin: true,
        zIndex: 1
    });

    baseMaps['OpenStreetMap'] = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        crossOrigin: true,
        zIndex: 1
    });

    // Set default basemap
    baseMaps['Esri Satellite'].addTo(map);

    // ---- SET UP OVERLAY LAYERS ----
    // Overlay layers will be added here as they're loaded
    // (e.g., districtsLayer will be added to overlayLayers in renderLayer())

    // ---- INITIALIZE LAYER CONTROL ----
    // Layer control will be initialized after baseMaps are set up
    layerControl = L.control.layers(baseMaps, overlayLayers, { position: 'topright' });

    scaleBar = L.control.scale({
        position: 'bottomright',  // to move it
        metric: true,
        imperial: false,
        maxWidth: 200             // width in pixels
    }).addTo(map);

    scaleBar.addTo(map);
    layerControl.addTo(map);
}

function disableMapInteraction() {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    map.touchZoom.disable();
}

function enableMapInteraction() {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    map.touchZoom.enable();
}

// ----------------------
// LOAD DISTRICTS
// ----------------------
function loadDistricts() {
    fetch('data/districts.geojson')
        .then(res => res.json())
        .then(data => {
            districtData = data;
            populateProvinceMenu();
            renderLayer('all', 'all');
        });
}

function populateProvinceMenu() {
    const provinces = [
        ...new Set(districtData.features.map(f => f.properties.Prov_name))
    ].sort();

    provinces.forEach(p => {
        provSelect.appendChild(new Option(p, p));
    });
}

// ----------------------
// RENDER LAYER
// ----------------------
function renderLayer(provFilter, distFilter) {
    if (districtsLayer) {
        map.removeLayer(districtsLayer);
        // Remove from layer control
        layerControl.removeLayer(districtsLayer);
    }

    districtsLayer = L.geoJSON(districtData, {
        filter: f => {
            const matchProv = (provFilter === "all" || f.properties.Prov_name === provFilter);
            const matchDist = (distFilter === "all" || f.properties.Dist_ID_24 === distFilter);
            return matchProv && matchDist;
        },
        style: f => {
            const highlight = (distFilter !== 'all' &&
                f.properties.Dist_ID_24 === distFilter);

            return {
                color: highlight ? "#00eeff" : "#ff7800",
                weight: highlight ? 2 : 2,
                fillOpacity: highlight ? 0.0 : 0.1
            };
        },
        onEachFeature: (f, l) => {
            l.bindPopup(
                `<b>Province: </b>${f.properties.Prov_name}<br><b>District: </b>${f.properties.Dist_name}`
            );
        }
    }).addTo(map);

    // Add to overlay layers and layer control
    overlayLayers['Districts'] = districtsLayer;
    layerControl.addOverlay(districtsLayer, 'Districts');

    if (districtsLayer.getLayers().length > 0) {
        map.fitBounds(districtsLayer.getBounds(), { padding: [30, 30] });

        if (distFilter !== 'all') {
            console.log("Finding district ID for:", distFilter);
            renderSettlements(distFilter);
        } else {
            // Clear settlements if "All Districts" is selected
            if (settlementsLayer) map.removeLayer(settlementsLayer);
        }
    }
}

// 4. Settlement Rendering Function
function renderSettlements(distId) {
    console.log(distId);
    if (settlementsLayer) map.removeLayer(settlementsLayer);
    if (!distId) return;

    // Fetch ONLY the data for the selected district from our new SQL API
    fetch(`/api/settlements/${distId}`)
        .then(res => res.json())
        .then(data => {
            // Populate the Dropdown
            var sortedSettlements = data.features.sort((a, b) =>
                a.properties.name.localeCompare(b.properties.name)
            );
            sortedSettlements.forEach(f => {
                var name = f.properties.name;
                var coords = f.geometry.coordinates; // [lon, lat]

                // Create Option: Store coordinates as a string value "lat,lon"
                var opt = new Option(name, `${coords[1]},${coords[0]}`);
                commSelect.appendChild(opt);
            });
            settlementsLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 3,
                        fillColor: "#ff0000",
                        color: "#fff",
                        weight: 1,
                        fillOpacity: 0.9
                    });
                },
                onEachFeature: function (f, l) {
                    console.log(f.properties);
                    l.bindPopup(`<b>Settlement:</b> ${f.properties.name}`);
                }
            }).addTo(map);
        });
}

commSelect.addEventListener('change', function () {
    if (this.value === 'all') return;

    // Split the "lat,lon" value back into an array
    var coords = this.value.split(',').map(Number);
    var lat = coords[0];
    var lon = coords[1];

    // Fly to the point
    map.flyTo([lat, lon], 16, {
        animate: true,
        duration: 1.5 // seconds
    });

    // Optional: Open the popup automatically
    if (settlementMarkers[this.value]) {
        settlementMarkers[this.value].openPopup();
    }
});

// ----------------------
// DROPDOWN EVENTS
// ----------------------
// 5. UI Events
provSelect.addEventListener('change', function () {
    distSelect.innerHTML = '<option value="all">-- All Districts --</option>';
    commSelect.innerHTML = '<option value="all">-- All Settlements --</option>';
    if (this.value !== 'all') {
        // 1. Filter features by province
        // 2. Map to an object containing both Name and Code
        var dists = districtData.features
            .filter(f => f.properties.Prov_name === this.value)
            .map(f => ({
                name: f.properties.Dist_name,
                code: f.properties.Dist_ID_24 // This is your 4-char code
            }))
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort by name alphabetically

        // 3. Create options: new Option(text, value)
        dists.forEach(d => {
            distSelect.appendChild(new Option(d.name, d.code));
        });
    }

    renderLayer(this.value, 'all');
});

distSelect.addEventListener('change', function () {
    commSelect.innerHTML = '<option value="all">-- All Settlements --</option>';
    renderLayer(provSelect.value, this.value);
});

function updateDistrictMenu(province) {
    distSelect.innerHTML = '<option value="all">-- All Districts --</option>';

    if (province === 'all') return;

    const districts = districtData.features
        .filter(f => f.properties.Prov_name === province)
        .map(f => f.properties.Dist_name)
        .sort();

    districts.forEach(d => {
        distSelect.appendChild(new Option(d, d));
    });
}

// ----------------------
// RASTER LAYER
// ----------------------
document.querySelectorAll('input[name="hazard-layer"]')
    .forEach(radio => {
        radio.addEventListener('change', function () {
            const label = rasterLabels[this.value];
            hazardLayer = hazardConfig[label].hazardLayer

            // Update pdf-content
            document.getElementById('active-raster').textContent = label;
            document.getElementById('raster-info').textContent = hazardConfig[label].text.description;

            toggleRaster(hazardLayer);
        });
    });


function toggleRaster(hazardLayer) {
    console.log("Toggling raster layer:", hazardLayer);

    if (currentHazardLayer) {
        map.removeLayer(currentHazardLayer);
        currentHazardLayer = null;
    }
    if (!hazardLayer) return;
    showRaster(hazardLayer);
}

function showRaster(hazardLayer) {
    console.log("Showing raster layer:", hazardLayer);

    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
    disableMapInteraction();

    const layer = L.tileLayer(`/tiles/${hazardLayer}/{z}/{x}/{y}.png`, {
        opacity: 0.5,
        maxZoom: 18,
        maxNativeZoom: 15,
        zIndex: 200
    });
    currentHazardLayer = layer;
    layer.addTo(map);

    layer.on('load', () => {
        overlay.style.display = 'none';
        enableMapInteraction();
    });

    layer.on('tileerror', (err) => {
        console.error("Tile error:", err);
        overlay.style.display = 'none';
        enableMapInteraction();
    });
}

const rasterLabels = {
    'none': 'None',
    'pop': 'Population Density',
    'flood': 'Flood Hazard',
    'avalanche': 'Avalanche Hazard',
    'landslide': 'Landslide Hazard'
};

// ----------------------
// LOAD CONTENT
// ----------------------
function loadContent() {
    return fetch('hazard-config.json')
        .then(res => res.json())
        .then(data => {
            hazardConfig = data;
        });
}


// ----------------------
// SNAPSHOT
// ----------------------
snapshotBtn.addEventListener('click', function () {
    // if no raster layer is checked, show alert and return
    const checkedRaster = document.querySelector('input[name="hazard-layer"]:checked');
    if (!checkedRaster) {
        alert("Please select a hazard layer before taking a snapshot.");
        return;
    };
    const mapElement = document.getElementById('map');
    userZoom = map.getZoom();
    // userBounds = map.getBounds();
    userHeight = mapElement.offsetHeight;
    userWidth = mapElement.offsetWidth;


    const zoomControl = document.querySelector(".leaflet-control-zoom.leaflet-bar.leaflet-control");
    const layerControlElement = document.querySelector(".leaflet-control-layers.leaflet-control");
    primaryColor = hazardConfig[rasterLabels[checkedRaster.value]].theme.primaryColor || '#ffffff';
    secondaryColor = hazardConfig[rasterLabels[checkedRaster.value]].theme.secondaryColor || '#a3a3a3';

    // Hide zoom and layer control for screenshot
    zoomControl.style.display = 'none';
    layerControlElement.style.display = 'none';

    htmlToImage.toPng(mapElement)
        .then(dataUrl => {
            // Show zoom control again
            zoomControl.style.display = '';
            layerControlElement.style.display = '';

            const img = new Image();
            img.src = dataUrl;
            img.id = "preview";

            const container = document.getElementById('result-container');
            const titleDiv = document.getElementById('snapshot-title');

            const districtName = distSelect.value === 'all'
                ? 'All Districts'
                : `${distSelect.options[distSelect.selectedIndex].text}, ${provSelect.options[provSelect.selectedIndex].text}`;

            titleDiv.textContent = districtName;
            titleDiv.classList.add('active');
            titleDiv.style.backgroundColor = primaryColor;

            container.innerHTML = '';
            container.appendChild(titleDiv);
            container.appendChild(img);

            // Show the pdf content
            const pdfContent = document.getElementById('pdf-content');
            pdfContent.classList.add('active');
        })
        .catch(err => {
            // Show zoom control if error occurs
            zoomControl.style.display = '';
            console.error('Snapshot failed:', err);
            alert("Check console for CORS errors.");
        });
});

downloadPdfBtn.addEventListener('click', function () {
    const pdfContent = document.getElementById('pdf-content');
    const titleText = document.getElementById('snapshot-title').textContent;



    htmlToImage.toPng(pdfContent)
        .then(dataUrl => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const maxWidth = pageWidth - (margin * 2);
            const maxHeight = pageHeight - (margin * 2);

            // Calculate image dimensions while maintaining aspect ratio
            const imgAspectRatio = pdfContent.offsetWidth / pdfContent.offsetHeight;
            let imgWidth = maxWidth;
            let imgHeight = imgWidth / imgAspectRatio;

            // Scale down if height exceeds page
            if (imgHeight > maxHeight) {
                imgHeight = maxHeight;
                imgWidth = imgHeight * imgAspectRatio;
            }

            pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
            pdf.save(`${titleText || 'snapshot'}.pdf`);
        })
        .catch(err => {
            // Restore original height in case of error
            console.error('PDF generation failed:', err);
            alert('Error generating PDF. Check console.');
        });
});

// ----------------------
// START APP
// ----------------------
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    loadDistricts();
    loadContent();
});
