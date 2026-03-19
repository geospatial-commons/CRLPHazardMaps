// ----------------------
// GLOBAL VARIABLES
// ----------------------
let map;
let overlayLayers = {};
let provincesData, districtsData;
let provincesLayer, districtsLayer, communityLayer;
let provincesColor = "#000000";
let districtsColor = "#00E5FF";
let communitiesStroke = "#000000";
let communitiesFill = "#bd1616";
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
const resetFiltersBtn = document.getElementById('reset-filters-btn')
const overlay = document.getElementById('loadingOverlay');


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

    overlay.style.display = 'flex';
    disableMapInteraction();
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


    getProvinces(0, () => {
        overlay.style.display = 'none';
        enableMapInteraction();
    }); // Load simplified provinces first for faster initial load 

    // ---- INITIALIZE LAYER CONTROL ----
    // Layer control will be initialized after baseMaps are set up
    layerControl = L.control.layers(baseMaps, overlayLayers, { position: 'topright' });

    scaleBar = L.control.scale({
        position: 'bottomright',
        metric: true,
        imperial: false,
        maxWidth: 200
    })

    scaleBar.addTo(map);
    layerControl.addTo(map);

    const contourLayer = L.vectorGrid.protobuf('/tiles/contours/{z}/{x}/{y}.pbf', {
        minZoom: 12,
        maxNativeZoom: 15,
        maxZoom: 18,

        vectorTileLayerStyles: {
            contours: {
                weight: 0.5,
                color: '#080808'
            }
        }
    });
    overlayLayers['Contours'] = contourLayer;
    layerControl.addOverlay(contourLayer, 'Contours');
}


function getProvinces(quality, callback) {
    fetch(`api/provinces/${quality}`)
        .then(res => res.json())
        .then(data => {
            provincesData = data;

            if (quality == 0) {
                let provMap = new Map();
                data.features.forEach(f => {
                    provMap.set(f.properties.provID, f.properties.name);
                });

                let sortedProvs = Array.from(provMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
                sortedProvs.forEach(([provID, name]) => {
                    provSelect.appendChild(new Option(name, provID));
                });
            }

            renderProvinces('all');

            if (quality == 0) {
                callback();  // Show map after simplified provinces load
                getProvinces(1); // Load detailed provinces in background
            } else {
                if (callback) callback();
            }

        })
        .catch(err => {
            console.error("Error loading provinces:", err);
            if (callback) callback();
        });
}

function renderProvinces(selectedProvId) {
    if (provincesLayer) {
        map.removeLayer(provincesLayer);
        layerControl.removeLayer(provincesLayer);
    }
    if (!provincesData) return;

    provincesLayer = L.geoJSON(provincesData, {
        style: {
            color: provincesColor,
            weight: 2,
            fillOpacity: 0
        },
        // style: function (f) {
        //     var isHighlighted = (selectedProvId !== 'all' && f.properties.provID === selectedProvId);
        //     return {
        //         color: isHighlighted ? "#ff0000" : provincesColor,
        //         weight: isHighlighted ? 2 : 1,
        //         fillOpacity: isHighlighted ? 0.0 : 0.0
        //     };
        // },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>Province:</b> ${f.properties.name}`);
        }
    }).addTo(map)
    overlayLayers['Provinces'] = provincesLayer;
    layerControl.addOverlay(provincesLayer, 'Provinces');

    // Zoom to whole country if 'all' is selected
    // if (selectedProvId === 'all' && provincesLayer.getLayers().length > 0) {
    //     map.fitBounds(provincesLayer.getBounds(), { padding: [30, 30] });
    // }
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
        style: {
            color: districtsColor,
            weight: 1,
            fillOpacity: 0
        },
        // style: function (f) {
        //     // If a specific district is selected, highlight it and give it a thicker border. 
        //     // Otherwise, show all districts with default styling. isHighlighted returns boolean.
        //     var isHighlighted = (selectedDistId !== 'all' && f.properties.distID == selectedDistId);
        //     return {
        //         color: isHighlighted ? "#00eeff" : districtsColor, // White borders for districts
        //         weight: isHighlighted ? 3 : 1,
        //         fillOpacity: isHighlighted ? 0 : 0
        //     };
        // },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>District:</b> ${f.properties.name}`);
        }
    }).addTo(map);
    overlayLayers['Districts'] = districtsLayer;
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
                        fillColor: communitiesFill,
                        color: communitiesStroke,
                        weight: 1,
                        fillOpacity: 0.9
                    });
                },
                onEachFeature: function (f, l) {
                    // console.log(f.properties);
                    l.bindPopup(`<b>Community:</b> ${f.properties.name}`, { className: 'community-popup' });
                }
            }).addTo(map);
            overlayLayers['Communities'] = communityLayer;
            layerControl.addOverlay(communityLayer, 'Communities');

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
    overlay.style.display = 'flex'; //show loading it might take time to download district data
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
            overlay.style.display = 'none'; // remove loading screen only after all data has been downlaoded and prcessed
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


resetFiltersBtn.addEventListener('click', function () {
    provSelect.value = 'all';
    distSelect.innerHTML = '<option value="all">-- Select a Province --</option>';
    commSelect.innerHTML = '<option value="all">-- Select a District --</option>';

    districtsData = null;

    if (districtsLayer) {
        map.removeLayer(districtsLayer);
        if (overlayLayers['Districts']) {
            layerControl.removeLayer(districtsLayer);
            delete overlayLayers['Districts'];
        }
        districtsLayer = null;
    }
    if (communityLayer) {
        map.removeLayer(communityLayer);
        if (overlayLayers['Communities']) {
            layerControl.removeLayer(communityLayer);
            delete overlayLayers['Communities'];
        }
        communityLayer = null;
    }

    renderProvinces('all');
    map.setView([33.93, 67.68], 6);
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
            let hazardLabel = rasterLabels[this.value];
            hazardLayer = hazardConfig[hazardLabel].hazardLayer

            // Update pdf-content
            document.getElementById('active-raster').textContent = hazardLabel;
            document.getElementById('raster-info').textContent = hazardConfig[hazardLabel].text.description;

            globalTintClass = ""
            resetLegend(); // Clear legend before building new one with correct labels/colors
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

function buildLegend(activeAdminLayers = []) {
    let hazardLabel = rasterLabels[document.querySelector('input[name="hazard-layer"]:checked').value];
    let mapConfig = hazardConfig[hazardLabel];
    document.getElementById('hazard-legend-title').textContent = mapConfig.legend.title;
    let legItemsContainer = document.getElementById('hazard-legend-items');
    legItemsContainer.innerHTML = '';


    // Dynamically populate hte legend
    if (mapConfig.legend.type === 'categorical') {
        for (let i = 0; i < mapConfig.legend.labels.length; i++) {
            let label = mapConfig.legend.labels[i];
            let color = mapConfig.legend.colors[i];

            let opacityVal = document.getElementById('opacity-range').value;

            legItemsContainer.innerHTML += `
            <div class="legend-item">
                <span class="legend-color ${globalTintClass}" style="background-color: ${color}; display: block; opacity: ${opacityVal / 100}"></span>
                <span class="legend-label">${label}</span>
            </div>
            `

        }
    } else if (mapConfig.legend.type === 'range') {
        let opacityVal = document.getElementById('opacity-range').value;
        let colors = mapConfig.legend.colors;
        let labels = mapConfig.legend.labels;

        // Joins the array of colors into a CSS gradient string 
        // Example output: "linear-gradient(to bottom, #d7191b, #fffebd)"
        let gradientString = `linear-gradient(to bottom, ${colors.join(', ')})`;

        // Create the labels HTML by mapping over the labels array
        let labelsHtml = labels.map(label => `<span class="legend-label">${label}</span>`).join('');

        legItemsContainer.innerHTML += `
        <div class="legend-item-range" style="display: flex; align-items: stretch; gap: 10px; margin-top: 5px;">
            <div class="legend-gradient-bar ${globalTintClass}" 
                 style="background: ${gradientString}; opacity: ${opacityVal / 100};">
            </div>
            <div class="legend-range-labels" style="">
                ${labelsHtml}
            </div>
        </div>
        `;
    }

    //add admin legend data
    if (activeAdminLayers.length > 0) {
        document.getElementById('admin-legend-title').textContent = 'Administrative Data';
        activeAdminLayers.forEach(layerName => {
            if (layerName === 'Provinces') {
                document.querySelector(".legend-color.admin-prov").style.display = 'block';
                document.querySelector(".legend-color.admin-prov").style.border = `2px solid ${provincesColor}`;
                document.querySelector(".legend-label.admin-prov").textContent = 'Province';
            } else if (layerName === 'Districts') {
                document.querySelector(".legend-color.admin-dist").style.display = 'block';
                document.querySelector(".legend-color.admin-dist").style.border = `2px solid ${districtsColor}`;
                document.querySelector(".legend-label.admin-dist").textContent = 'District';
            } else if (layerName === 'Communities') {
                document.querySelector(".legend-color.admin-comm").style.display = 'block';
                document.querySelector(".legend-color.admin-comm").style.border = `1px solid ${communitiesStroke}`;
                document.querySelector(".legend-color.admin-comm").style.backgroundColor = communitiesFill;
                document.querySelector(".legend-label.admin-comm").textContent = 'Community';
            }

        });
    }
};

function resetLegend() {
    document.getElementById('hazard-legend-title').textContent = '';
    document.querySelectorAll('.legend-color').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.legend-label').forEach(el => el.textContent = '');
    document.getElementById('admin-legend-title').textContent = '';
};


// ----------------------
// CREATE PDF LAYOUT
// ----------------------

function createPDFLayout(download = true) {
    // const checkedRaster = document.querySelector('input[name="hazard-layer"]:checked');
    const mapElement = document.getElementById('map');
    const zoomControl = document.querySelector(".leaflet-control-zoom");
    const layerControl = document.querySelector(".leaflet-control-layers");
    const scaleBar = document.querySelector(".leaflet-control-scale-line");
    const scaleBarWidth = document.querySelector(".leaflet-control-scale-line").style.width;
    const scaleBarText = document.querySelector(".leaflet-control-scale-line").textContent;

    const mapContainerLayout = document.getElementById('map-container');
    const scaleBarLayout = document.getElementById('scale-bar');

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('footer-date').innerHTML = `<strong>Date Created: </strong> ${formattedDate}`;


    // ---------------
    // BUILD LEGEND
    // ---------------

    // Get list of active overlay layers to include in the legend
    let activeAdminLayers = Object.entries(overlayLayers)
        .filter(([key, layer]) => map.hasLayer(layer))
        .map(([key]) => key);

    console.log("Active layers for legend:", activeAdminLayers);

    buildLegend(activeAdminLayers);


    // Hide zoom and layer control for screenshot
    zoomControl.style.display = 'none';
    layerControl.style.display = 'none';
    scaleBar.style.display = 'none';

    // Store original margins and remove them for capture (they include whitespace)


    htmlToImage.toPng(mapElement)
        .then(function (dataUrl) {

            // Show zoom control again and restore margins
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
            console.log("The Map Image has loaded, now generating PDF...");

            if (download) {
                downloadPdf();
            }

        })

        .catch(err => {
            // Show zoom control if error occurs and restore margins
            zoomControl.style.display = '';
            mapElement.style.marginLeft = originalMarginLeft;
            mapElement.style.marginRight = originalMarginRight;
            console.error('Failed:', err);
        });
}


downloadPdfBtn.addEventListener('click', function () {
    createPDFLayout()
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
            //resetLegend(); // Clear legend after PDF generation
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
