// ----------------------
// GLOBAL VARIABLES
// ----------------------
let map;
let districtsLayer;
let fullData;
let rasterLayer;
let currentRasterLayer;
let hazardConfig = {};

const provSelect = document.getElementById('prov-select');
const distSelect = document.getElementById('dist-select');
const snapshotBtn = document.getElementById('snapshot-btn');
const downloadPdfBtn = document.getElementById('download-pdf-btn')

// ----------------------
// INITIALIZE MAP
// ----------------------
function initMap() {
    map = L.map('map').setView([33.93, 67.68], 6);

    L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                crossOrigin: true 
        }
    ).addTo(map);
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
            fullData = data;
            populateProvinceMenu();
            renderLayer('all', 'all');
        });
}

function populateProvinceMenu() {
    const provinces = [
        ...new Set(fullData.features.map(f => f.properties.Prov_name))
    ].sort();

    provinces.forEach(p => {
        provSelect.appendChild(new Option(p, p));
    });
}

// ----------------------
// RENDER LAYER
// ----------------------
function renderLayer(provFilter, distFilter) {
    if (districtsLayer) map.removeLayer(districtsLayer);

    districtsLayer = L.geoJSON(fullData, {
        filter: f => {
            const matchProv = (provFilter === "all" || f.properties.Prov_name === provFilter);
            const matchDist = (distFilter === "all" || f.properties.Dist_name === distFilter);
            return matchProv && matchDist;
        },
        style: f => {
            const highlight = (distFilter !== 'all' &&
                f.properties.Dist_name === distFilter);

            return {
                color: highlight ? "#00eeff" : "#ff7800",
                weight: highlight ? 2 : 2,
                fillOpacity: highlight ? 0.0 : 0.1
            };
        },
        onEachFeature: (f, l) => {
            l.bindPopup(
                `<b>${f.properties.Dist_name}</b><br>${f.properties.Prov_name}`
            );
        }
    }).addTo(map);

    if (districtsLayer.getLayers().length > 0) {
        map.fitBounds(districtsLayer.getBounds(), { padding: [30, 30] });
    }
}

// ----------------------
// DROPDOWN EVENTS
// ----------------------
provSelect.addEventListener('change', function () {
    updateDistrictMenu(this.value);
    renderLayer(this.value, 'all');
});

distSelect.addEventListener('change', function () {
    renderLayer(provSelect.value, this.value);
});

function updateDistrictMenu(province) {
    distSelect.innerHTML = '<option value="all">-- All Districts --</option>';

    if (province === 'all') return;

    const districts = fullData.features
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
function showRaster(rasterLayer) {

    if (rasterLayer === "none") {
        if (currentRasterLayer) {
            map.removeLayer(currentRasterLayer);
        }
        console.warn("No raster layer provided");
        return;
    }

    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'flex';
    disableMapInteraction();

    // Remove previous raster layer if it exists
    if (currentRasterLayer) {
        console.log("removing current raster layer");
        map.removeLayer(currentRasterLayer);
        currentRasterLayer = null;
    }

    fetch(rasterLayer)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => parseGeoraster(arrayBuffer))
        .then(georaster => {

            const layer = new GeoRasterLayer({
                georaster,
                opacity: 0.5,
                resolution: 128
            });

            console.log("Adding new raster layer:", rasterLayer);

            layer.addTo(map);
            currentRasterLayer = layer;

            map.whenReady(() => {
                // Small delay ensures canvas render completes
                setTimeout(() => {
                    overlay.style.display = 'none';
                    enableMapInteraction();
                }, 100);
            });

        })
        .catch(error => {
            console.error("Raster load failed:", error);
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

document.querySelectorAll('input[name="hazard-layer"]')
    .forEach(radio => {
        radio.addEventListener('change', function () {
            const label = rasterLabels[this.value];

            // Set the active raster label in the UI
            document.getElementById('active-raster').textContent = label;
            
            // Update the UI with content from hazard-config.json
            document.getElementById('raster-info').textContent = hazardConfig[label].text.description;
            rasterLayer = hazardConfig[label].rasterLayer

            showRaster(rasterLayer);
        });
    });

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
    const node = document.getElementById('map');
    const zoomControl = document.querySelector(".leaflet-control-zoom.leaflet-bar.leaflet-control");
    primaryColor = hazardConfig[rasterLabels[checkedRaster.value]].theme.primaryColor || '#ffffff';
    secondaryColor = hazardConfig[rasterLabels[checkedRaster.value]].theme.secondaryColor || '#a3a3a3';

    // Hide zoom control for screenshot
    zoomControl.style.display = 'none';

    htmlToImage.toPng(node, { scale: 2 })
        .then(dataUrl => {
            // Show zoom control again
            zoomControl.style.display = '';
            
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



    htmlToImage.toPng(pdfContent, { scale: 2 })
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
