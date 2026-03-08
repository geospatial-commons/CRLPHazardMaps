// ----------------------
// GLOBAL VARIABLES
// ----------------------
let map;
let provincesData, districtsData;
let provincesLayer, districtsLayer, communityLayer;
let hazardLayer, currentHazardLayer;
let hazardConfig = {};

let baseMaps = {};
let layerControl;

const provSelect = document.getElementById('prov-select');
const distSelect = document.getElementById('dist-select');
const commSelect = document.getElementById('comm-select');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');
const downloadPdfBtn = document.getElementById('download-pdf-btn')


const rasterLabels = {
    'none': 'None',
    'flood': 'Flood Hazard',
    'avalanche': 'Avalanche Hazard',
    'landslide': 'Landslide Hazard',
    'earthquake': 'Earthquake Hazard'
};


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

    fetch('hazard-config.json')
        .then(res => res.json())
        .then(data => {
            hazardConfig = data;
        });

    getProvinces(0); // Load simplified provinces first for faster initial load       

    // ---- INITIALIZE LAYER CONTROL ----
    // Layer control will be initialized after baseMaps are set up
    layerControl = L.control.layers(baseMaps, {}, { position: 'topright' });

    scaleBar = L.control.scale({
        position: 'bottomright',
        metric: true,
        imperial: false,
        maxWidth: 200
    })

    scaleBar.addTo(map);
    layerControl.addTo(map);
}

function getProvinces(quality) {
    fetch(`api/provinces/${quality}`)
        .then(res => res.json())
        .then(data => {
            provincesData = data;

            let provMap = new Map();
            data.features.forEach(f => {
                provMap.set(f.properties.provID, f.properties.name);
            });

            let sortedProvs = Array.from(provMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
            sortedProvs.forEach(([provID, name]) => {
                provSelect.appendChild(new Option(name, provID));
            });

            renderProvinces('all');

            if (quality == 0) {
                getProvinces(1); // Fetch detailed provinces after loading simplified ones
            }

        })
        .catch(err => {
            console.error("Error loading provinces:", err);
        });
}

function renderProvinces(selectedProvId) {
    if (provincesLayer) {
        map.removeLayer(provincesLayer);
        layerControl.removeLayer(provincesLayer);
    }
    if (!provincesData) return;

    provincesLayer = L.geoJSON(provincesData, {
        style: function (f) {
            var isHighlighted = (selectedProvId !== 'all' && f.properties.provID === selectedProvId);
            return {
                color: isHighlighted ? "#ff0000" : "#000000",
                weight: isHighlighted ? 2 : 1,
                fillOpacity: isHighlighted ? 0.0 : 0.0
            };
        },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>Province:</b> ${f.properties.name}`);
        }
    }).addTo(map)

    layerControl.addOverlay(provincesLayer, 'Provinces');

    // Zoom to whole country if 'all' is selected
    if (selectedProvId === 'all' && provincesLayer.getLayers().length > 0) {
        map.fitBounds(provincesLayer.getBounds(), { padding: [30, 30] });
    }
};


// Renders the fetched Districts ON TOP of the Province
function renderDistricts(data, selectedDistId) {
    console.log("Rendering districts with selectedDistId:", selectedDistId);
    if (districtsLayer) {
        map.removeLayer(districtsLayer);
        layerControl.removeLayer(districtsLayer)
    };
    if (!data) return;
    console.log("Data passed to renderDistricts:", data);

    districtsLayer = L.geoJSON(data, {
        style: function (f) {
            // If a specific district is selected, highlight it and give it a thicker border. 
            // Otherwise, show all districts with default styling. isHighlighted returns boolean.
            var isHighlighted = (selectedDistId !== 'all' && f.properties.distID == selectedDistId);
            return {
                color: isHighlighted ? "#00eeff" : "#ffffff", // White borders for districts
                weight: isHighlighted ? 3 : 1,
                fillOpacity: isHighlighted ? 0 : 0
            };
        },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>District:</b> ${f.properties.name}`);
        }
    }).addTo(map);
    layerControl.addOverlay(districtsLayer, 'Districts');
    // Zoom Logic
    if (districtsLayer.getLayers().length > 0) {
        if (selectedDistId !== 'all') {
            // Zoom to specific district
            let distLayer = districtsLayer.getLayers().find(l => l.feature.properties.distID == selectedDistId);
            if (distLayer) map.fitBounds(distLayer.getBounds(), { padding: [30, 30] });
        } else {
            // Zoom to all districts (the whole province)
            map.fitBounds(districtsLayer.getBounds(), { padding: [30, 30] });
        }
    }
}

function renderCommunities(distId) {
    // console.log(distId);
    if (communityLayer) map.removeLayer(communityLayer);
    if (!distId) return;

    // Fetch ONLY the data for the selected district from our new SQL API
    fetch(`/api/communities/${distId}`)
        .then(res => res.json())
        .then(data => {
            // Populate the Dropdown
            commSelect.innerHTML = '<option value="all">-- All Communities --</option>';
            var sortedCommunities = data.features.sort((a, b) =>
                a.properties.name.localeCompare(b.properties.name)
            );
            sortedCommunities.forEach(f => {
                var name = f.properties.name;
                var coords = f.geometry.coordinates; // [lon, lat]

                // Create Option: Store coordinates as a string value "lat,lon"
                var opt = new Option(name, `${coords[1]},${coords[0]}`);
                commSelect.appendChild(opt);
            });
            communityLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 3,
                        fillColor: "#ffffff",
                        color: "#000000",
                        weight: 1,
                        fillOpacity: 0.9
                    });
                },
                onEachFeature: function (f, l) {
                    // console.log(f.properties);
                    l.bindPopup(`<b>Community:</b> ${f.properties.name}`);
                }
            }).addTo(map);
        });
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
// EVENT LISTENERS
// ----------------------

provSelect.addEventListener('change', function () {
    const provId = this.value;

    distSelect.innerHTML = '<option value="all">-- All Districts --</option>';
    commSelect.innerHTML = '<option value="all">-- Select District --</option>';
    if (districtsLayer) map.removeLayer(districtsLayer);
    if (communityLayer) map.removeLayer(communityLayer);

    renderProvinces(provId);

    if (provId === 'all') return; // Stop here if "Show All" was selected

    // Fetch districts belonging to this Province ID
    fetch(`/api/districts/${provId}`)
        .then(res => res.json())
        .then(data => {
            districtsData = data;
            // console.log("Fetched districts: ", districtsData.features);

            // Populate District Dropdown with Dist_Id_24 as the value
            let sortedDists = data.features.map(f => ({
                name: f.properties.name,
                provId: f.properties.provID,
                distId: f.properties.distID
            })).sort((a, b) => a.name.localeCompare(b.name));
            // console.log(districtsData);

            sortedDists.forEach(d => distSelect.appendChild(new Option(d.name, d.distId)));

            // Draw the new districts layer on top of the province layer
            // console.log("triggering renderDistricts with data: ", data);
            renderDistricts(data, 'all');
        })
        .catch(err => console.error("Error loading districts:", err));
});


// DISTRICT SELECTED -> Highlight & Fetch Community
distSelect.addEventListener('change', function () {
    const distId = this.value;

    // Redraw districts to show the highlight/zoom
    renderDistricts(districtsData, distId);

    if (distId !== 'all') {
        renderCommunities(distId);
    } else if (communityLayer) {
        map.removeLayer(communityLayer);
        console.log("Removed community layer");
        commSelect.innerHTML = '<option value="all">-- Select District --</option>';
    }
});


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
});

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
    // console.log("Toggling raster layer:", hazardLayer);

    if (currentHazardLayer) {
        map.removeLayer(currentHazardLayer);
        currentHazardLayer = null;
    }
    if (!hazardLayer) return;
    showRaster(hazardLayer);
}

function showRaster(hazardLayer) {
    // console.log("Showing raster layer:", hazardLayer);
    if (hazardLayer === 'none') return;
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
    disableMapInteraction();

    const layer = L.tileLayer(`/tiles/${hazardLayer}/{z}/{x}/{y}.png`, {
        opacity: document.getElementById('opacity-range').value / 100,
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

opacityRange.addEventListener('input', function () {
    opacityValue.textContent = `${this.value}%`;
    if (currentHazardLayer) {
        currentHazardLayer.setOpacity(this.value / 100);
    }
});

// ----------------------
// DOWNLOAD
// ----------------------
downloadPdfBtn.addEventListener('click', function () {

    // const checkedRaster = document.querySelector('input[name="hazard-layer"]:checked');
    const mapElement = document.getElementById('map');
    const zoomControl = document.querySelector(".leaflet-control-zoom");
    const layerControl = document.querySelector(".leaflet-control-layers");
    const scaleBar = document.querySelector(".leaflet-control-scale-line");
    const scaleBarWidth = document.querySelector(".leaflet-control-scale-line").style.width;
    const scaleBarText = document.querySelector(".leaflet-control-scale-line").textContent;

    const mapContainerLayout = document.getElementById('map-container');
    const scaleBarLayout = document.getElementById('scale-bar');

    // Hide zoom and layer control for screenshot
    zoomControl.style.display = 'none';
    layerControl.style.display = 'none';
    scaleBar.style.display = 'none';

    htmlToImage.toPng(mapElement)
        .then(function (dataUrl) {

            // Show zoom control again
            zoomControl.style.display = '';
            layerControl.style.display = '';
            scaleBar.style.display = '';

            const mapImg = new Image();
            mapImg.src = dataUrl;
            mapImg.id = "map-image";


            mapContainerLayout.innerHTML = '';
            mapContainerLayout.appendChild(mapImg);

            scaleBarLayout.innerHTML = `
                    <div class="custom-scale-text">${scaleBarText}</div>
                    <div class="custom-scale-bar" style="width:${scaleBarWidth}">
                        <div class="custom-scale-tick left"></div>
                        <div class="custom-scale-tick right"></div>
                    </div>
            `;


            const titleDiv = document.getElementById('layout-title');

            const provName = provSelect.options[provSelect.selectedIndex].text;
            const distName = distSelect.options[distSelect.selectedIndex].text;
            const commName = commSelect.options[commSelect.selectedIndex].text;

            let titleText = '';
            if (commSelect.value !== 'all') {
                titleText = `${commName}, ${distName} District, ${provName} Province`;
            } else if (distSelect.value !== 'all') {
                titleText = `${distName} District, ${provName} Province`;
            } else if (provSelect.value !== 'all') {
                titleText = `${provName} Province`;
            } else {
                titleText = 'Afghanistan';
            }

            titleDiv.textContent = titleText;

            downloadPdf();

        })

        .catch(err => {
            // Show zoom control if error occurs
            zoomControl.style.display = '';
            console.error('Failed:', err);
        });
});

// ----------------------
// DOWNLOAD PDF
// ----------------------
function downloadPdf() {
    const pdfContent = document.getElementById('pdf-content');
    const titleText = document.getElementById('layout-title').textContent;

    htmlToImage.toPng(pdfContent)
        .then(dataUrl => {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });
            // console.log(pageWidth, pageHeight)
            const margin = 5;
            pdf.addImage(dataUrl, 'PNG', margin, margin, 287, 200);
            pdf.save(`${titleText || 'hazard-map'}.pdf`);
        })
        .catch(err => {
            // Restore original height in case of error
            console.error('PDF generation failed:', err);
            alert('Error generating PDF. Check console.');
        });
}

// ----------------------
// START APP
// ----------------------
document.addEventListener('DOMContentLoaded', () => {
    initMap();
});
