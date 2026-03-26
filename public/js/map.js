import { downloadPdf } from './pdf-export.js';

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
let hazardLayer, currentHazardLayer, contourLayer;
let hazardConfig = {};
let layoutConfig = {};
let baseMaps = {};
let scaleBarText;
let scaleBarWidth;
let currentHazardDescription = '';


const provSelect = document.getElementById('prov-select');
const distSelect = document.getElementById('dist-select');
const commSelect = document.getElementById('comm-select');
const opacityRange = document.getElementById('opacity-range');
const opacityValue = document.getElementById('opacity-value');
const downloadPdfBtn = document.getElementById('download-pdf-btn');
const previewPdfBtn = document.getElementById('preview-pdf-btn');
const downloadFromPreviewBtn = document.getElementById('download-from-preview-btn');
const resetFiltersBtn = document.getElementById('reset-filters-btn');
const overlay = document.getElementById('loadingOverlay');
const pdfDescription = document.getElementById('pdf-hazard-description');
const legendContent = document.getElementById('legend-content');
const pdfHazardTitle = document.getElementById('pdf-map-title');
const pdfHazardIcon = document.getElementById('pdf-hazard-icon');

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

    baseMaps['Esri Satellite'].addTo(map);

    fetch('hazard-config.json')
        .then(res => res.json())
        .then(data => {
            hazardConfig = data;
        });

    const scaleBar = L.control.scale({
        position: 'bottomright',
        metric: true,
        imperial: false,
        maxWidth: 200
    });
    scaleBar.addTo(map);

    // const contourLayer = L.vectorGrid.protobuf('/tiles/contours/{z}/{x}/{y}.pbf', {
    //     minZoom: 12,
    //     maxNativeZoom: 15,
    //     maxZoom: 18,
    //     vectorTileLayerStyles: {
    //         contours: { weight: 0.5, color: '#080808' }
    //     }
    // }).addTo(map);

    // overlayLayers['Contours'] = contourLayer;

    getProvinces(0, () => {
        overlay.style.display = 'none';
        enableMapInteraction();
        // Trigger invalidateSize after layout settles
        setTimeout(() => map.invalidateSize(), 150);
        // Load context layers after map is ready
        loadContextLayers();
    });
}

// ----------------------
// CONTEXT LAYERS
// ----------------------
// Tracks loaded Leaflet layers keyed by context layer id
const contextLayerInstances = {};

function loadContextLayers() {
    const container = document.getElementById('context-layers');

    fetch('/context-config.json')
        .then(res => res.json())
        .then(layers => {
            container.innerHTML = '';
            layers.forEach(layerConfig => {
                buildContextToggle(container, layerConfig);
            });
        })
        .catch(() => {
            // context-config.json missing or malformed — no crash, no context layers
            container.innerHTML = '<p class="loading-note">Context layers unavailable</p>';
        });
}

function buildContextToggle(container, layerConfig) {
    const row = document.createElement('div');
    row.className = 'context-toggle-row';
    row.dataset.id = layerConfig.id;

    const label = document.createElement('label');
    label.className = 'context-toggle-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layerConfig.default;
    checkbox.dataset.id = layerConfig.id;
    checkbox.setAttribute('aria-label', layerConfig.name);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = layerConfig.name;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    row.appendChild(label);
    container.appendChild(row);

    // If default=true, load immediately
    if (layerConfig.default) {
        fetchAndAddContextLayer(layerConfig, checkbox, row);
    }

    checkbox.addEventListener('change', function () {
        if (this.checked) {
            fetchAndAddContextLayer(layerConfig, checkbox, row);
        } else {
            removeContextLayer(layerConfig.id);
        }
    });

    // Update zoom note on map zoom
    map.on('zoomend', () => updateZoomNote(row, layerConfig));
    updateZoomNote(row, layerConfig);
}

function fetchAndAddContextLayer(layerConfig, checkbox, row) {
    // Guard against double-add
    if (contextLayerInstances[layerConfig.id] && map.hasLayer(contextLayerInstances[layerConfig.id])) {
        return;
    }

    // Remove stale zoom note / unavailable note
    const existingNote = row.querySelector('.context-zoom-note, .context-unavailable, .context-loading');
    if (existingNote) existingNote.remove();

    const loadingNote = document.createElement('p');
    loadingNote.className = 'context-zoom-note context-loading';
    loadingNote.textContent = 'Loading...';
    checkbox.disabled = true;
    row.appendChild(loadingNote);

    // prov-boundaries reuses the existing provincesLayer to avoid a duplicate
    // fetch and double boundary lines (simplified context copy vs detailed provinces copy)
    if (layerConfig.id === 'prov-boundaries') {
        loadingNote.remove();
        checkbox.disabled = false;
        if (provincesLayer) {
            contextLayerInstances['prov-boundaries'] = provincesLayer;
            overlayLayers[layerConfig.name] = provincesLayer;
            if (checkbox.checked && !map.hasLayer(provincesLayer)) {
                provincesLayer.addTo(map);
            }
        }
        updateZoomNote(row, layerConfig);
        return;
    }

    if (layerConfig.type === 'geojson') {
        fetch(layerConfig.url)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                loadingNote.remove();
                checkbox.disabled = false;

                const leafletLayer = L.geoJSON(data, {
                    style: layerConfig.id === 'prov-boundaries' ? {
                        color: provincesColor,
                        weight: 2,
                        fillOpacity: 0
                    } : undefined,
                    pointToLayer: layerConfig.id === 'district-capitals' ? function (feature, latlng) {
                        return L.circleMarker(latlng, {
                            radius: 4,
                            fillColor: '#FFD700',
                            color: '#000',
                            weight: 1,
                            fillOpacity: 0.9
                        });
                    } : undefined,
                    onEachFeature: function (f, l) {
                        if (f.properties && f.properties.name) {
                            l.bindPopup(`<b>${f.properties.name}</b>`);
                        }
                    }
                });

                contextLayerInstances[layerConfig.id] = leafletLayer;
                if (checkbox.checked) {
                    leafletLayer.addTo(map);
                }
                overlayLayers[layerConfig.name] = leafletLayer;
                updateZoomNote(row, layerConfig);
            })
            .catch(() => {
                loadingNote.remove();
                checkbox.disabled = false;
                checkbox.checked = false;
                const errNote = document.createElement('p');
                errNote.className = 'context-unavailable';
                errNote.textContent = `${layerConfig.name} unavailable`;
                row.appendChild(errNote);
            });
    }
    else if (layerConfig.type === 'tiles') {
        loadingNote.remove();
        checkbox.disabled = false;
        contourLayer = L.vectorGrid.protobuf(layerConfig.url, {
            minZoom: layerConfig.minZoom,
            maxNativeZoom: layerConfig.maxNativeZoom,
            maxZoom: layerConfig.maxZoom,
            vectorTileLayerStyles: {
                contours: { weight: 0.5, color: '#080808' }
            }
        });
        contextLayerInstances[layerConfig.id] = contourLayer;
        if (checkbox.checked) {
            contourLayer.addTo(map);
        }
        overlayLayers[layerConfig.name] = contourLayer;
        updateZoomNote(row, layerConfig);
    }
    // else if (layerConfig.type === 'raster') {
    //     loadingNote.remove();
    //     checkbox.disabled = false;
    //     const rasterLayer = L.tileLayer(layerConfig.url, {
    //         minZoom: layerConfig.minZoom || 1,
    //         maxZoom: layerConfig.maxZoom || 18,
    //         opacity: 0.7,
    //         zIndex: 150
    //     });
    //     contextLayerInstances[layerConfig.id] = rasterLayer;
    //     if (checkbox.checked) {
    //         rasterLayer.addTo(map);
    //     }
    //     overlayLayers[layerConfig.name] = rasterLayer;
    //     updateZoomNote(row, layerConfig);
    // }
}

function removeContextLayer(id) {
    const layer = contextLayerInstances[id];
    if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
    }
}

function updateZoomNote(row, layerConfig) {
    if (!map) return;
    const existingNote = row.querySelector('.context-zoom-note:not(.context-loading)');
    const currentZoom = map.getZoom();
    if (layerConfig.minZoom && currentZoom < layerConfig.minZoom) {
        if (!existingNote) {
            const note = document.createElement('p');
            note.className = 'context-zoom-note';
            note.textContent = 'Zoom in to view';
            row.appendChild(note);
        }
    } else {
        if (existingNote) existingNote.remove();
    }
}

// ----------------------
// BASEMAP SWITCHER
// ----------------------
document.querySelectorAll('.basemap-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const target = this.dataset.basemap;
        if (!baseMaps[target]) return;
        Object.values(baseMaps).forEach(bm => {
            if (map.hasLayer(bm)) map.removeLayer(bm);
        });
        baseMaps[target].addTo(map);
        document.querySelectorAll('.basemap-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

// ----------------------
// PROVINCES
// ----------------------
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

            renderProvinces('all', quality);

            if (quality == 0) {
                callback();
                quality = 1;
                getProvinces(quality);
            } else {
                if (callback) callback();
            }
        })
        .catch(err => {
            console.error("Error loading provinces:", err);
            if (callback) callback();
        });
}

function renderProvinces(selectedProvId, quality) {
    if (provincesLayer) {
        map.removeLayer(provincesLayer);
    }
    if (!provincesData) return;

    provincesLayer = L.geoJSON(provincesData, {
        style: {
            color: provincesColor,
            weight: 2,
            fillOpacity: 0
        },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>Province:</b> ${f.properties.name}`);
        }
    });

    // Sync to context layer instance so the toggle controls this layer
    contextLayerInstances['prov-boundaries'] = provincesLayer;
    overlayLayers['Provinces'] = provincesLayer;

    // Only add to map if the prov-boundaries toggle is checked (or not yet rendered)
    const adminCheckbox = document.querySelector('input[data-id="prov-boundaries"]');
    if (!adminCheckbox || adminCheckbox.checked) {
        provincesLayer.addTo(map);
    }

    if (selectedProvId === 'all' && quality == 0) {
        map.fitBounds(provincesLayer.getBounds(), { padding: [30, 30] });
    }
}

// ----------------------
// DISTRICTS
// ----------------------
function renderDistricts(data, selectedDistId) {
    console.log("Rendering districts with selectedDistId:", selectedDistId);
    if (districtsLayer) {
        map.removeLayer(districtsLayer);
    }
    if (!data) return;

    districtsLayer = L.geoJSON(data, {
        style: {
            color: districtsColor,
            weight: 1,
            fillOpacity: 0
        },
        onEachFeature: function (f, l) {
            l.bindPopup(`<b>District:</b> ${f.properties.name}`);
        }
    }).addTo(map);

    overlayLayers['Districts'] = districtsLayer;

    if (districtsLayer.getLayers().length > 0) {
        if (selectedDistId !== 'all') {
            let distLayer = districtsLayer.getLayers().find(l => l.feature.properties.distID == selectedDistId);
            if (distLayer) map.fitBounds(distLayer.getBounds(), { padding: [30, 30] });
        } else {
            map.fitBounds(districtsLayer.getBounds(), { padding: [30, 30] });
        }
    }
}

// ----------------------
// COMMUNITIES
// ----------------------
function renderCommunities(distId) {
    if (communityLayer) map.removeLayer(communityLayer);
    if (!distId) return;

    fetch(`/api/communities/${distId}`)
        .then(res => res.json())
        .then(data => {
            commSelect.innerHTML = '<option value="all">-- All Communities --</option>';
            var sortedCommunities = data.features.sort((a, b) =>
                a.properties.name.localeCompare(b.properties.name)
            );
            sortedCommunities.forEach(f => {
                var name = f.properties.name;
                var coords = f.geometry.coordinates;
                var opt = new Option(name, `${coords[1]},${coords[0]}`);
                var uniqueIdentifier = `${name}_${coords[1]},${coords[0]}`;
                opt.dataset.combined = uniqueIdentifier;
                commSelect.appendChild(opt);
            });

            communityLayer = L.geoJSON(data, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 5,
                        fillColor: communitiesFill,
                        color: communitiesStroke,
                        weight: 1,
                        fillOpacity: 0.9
                    });
                },
                onEachFeature: function (f, l) {
                    l.bindPopup(`<b>Settlement:</b> ${f.properties.name}`, { className: 'community-popup' });
                    l.on('click', function () {
                        const clickedName = f.properties.name;
                        const clickedCoords = f.geometry.coordinates;
                        const targetCombined = `${clickedName}_${clickedCoords[1]},${clickedCoords[0]}`;
                        for (let i = 0; i < commSelect.options.length; i++) {
                            if (commSelect.options[i].dataset.combined === targetCombined) {
                                commSelect.selectedIndex = i;
                                commSelect.dispatchEvent(new Event('change'));
                                break;
                            }
                        }
                    });
                }
            }).addTo(map);

            overlayLayers['Communities'] = communityLayer;
            commSelect.disabled = false;
        });
}

// ----------------------
// MAP INTERACTION
// ----------------------
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
    distSelect.disabled = provId === 'all';
    commSelect.innerHTML = '<option value="all">-- Select District --</option>';
    commSelect.disabled = true;

    if (districtsLayer) map.removeLayer(districtsLayer);
    if (communityLayer) map.removeLayer(communityLayer);

    renderProvinces(provId);

    if (provId === 'all') {
        map.fitBounds(provincesLayer.getBounds(), { padding: [30, 30] });
        return;
    }

    overlay.style.display = 'flex';
    fetch(`/api/districts/${provId}`)
        .then(res => res.json())
        .then(data => {
            districtsData = data;
            let sortedDists = data.features.map(f => ({
                name: f.properties.name,
                provId: f.properties.provID,
                distId: f.properties.distID
            })).sort((a, b) => a.name.localeCompare(b.name));
            sortedDists.forEach(d => distSelect.appendChild(new Option(d.name, d.distId)));
            overlay.style.display = 'none';
            renderDistricts(data, 'all');
        })
        .catch(err => console.error("Error loading districts:", err));
});

distSelect.addEventListener('change', function () {
    const distId = this.value;
    renderDistricts(districtsData, distId);
    if (distId !== 'all') {
        if (communityLayer) {
            map.removeLayer(communityLayer);
        }
        renderCommunities(distId);
        commSelect.innerHTML = '<option value="all">-- Select District --</option>';
        commSelect.disabled = true;
    }
});

resetFiltersBtn.addEventListener('click', function () {
    provSelect.value = 'all';
    distSelect.innerHTML = '<option value="all">-- Select a Province --</option>';
    distSelect.disabled = true;
    commSelect.innerHTML = '<option value="all">-- Select a District --</option>';
    commSelect.disabled = true;

    districtsData = null;

    if (districtsLayer) {
        map.removeLayer(districtsLayer);
        delete overlayLayers['Districts'];
        districtsLayer = null;
    }
    if (communityLayer) {
        map.removeLayer(communityLayer);
        delete overlayLayers['Communities'];
        communityLayer = null;
    }

    // Reset hazard layer
    if (currentHazardLayer) {
        map.removeLayer(currentHazardLayer);
        currentHazardLayer = null;
    }
    hazardLayer = null;
    currentHazardDescription = '';
    if (pdfDescription) pdfDescription.textContent = '';

    // Reset hazard radio to None
    const noneRadio = document.querySelector('input[name="hazard-layer"][value="none"]');
    if (noneRadio) noneRadio.checked = true;

    // Reset legend bar
    updateLegendBar('none');

    renderProvinces('all');
    map.setView([33.93, 67.68], 6);
});

commSelect.addEventListener('change', function () {
    if (this.value === 'all') return;
    var coords = this.value.split(',').map(Number);
    const selectedCombined = this.options[this.selectedIndex].dataset.combined;

    map.flyTo([coords[0], coords[1]], 16, { animate: true, duration: 1.5 });

    // After fly completes, open the popup for the matching marker
    map.once('moveend', function () {
        if (!communityLayer) return;
        communityLayer.eachLayer(function (layer) {
            const f = layer.feature;
            const c = f.geometry.coordinates;
            const combined = `${f.properties.name}_${c[1]},${c[0]}`;
            if (combined === selectedCombined) {
                layer.openPopup();
            }
        });
    });
});

// ----------------------
// RASTER / HAZARD LAYER
// ----------------------
document.querySelectorAll('input[name="hazard-layer"]')
    .forEach(radio => {
        radio.addEventListener('change', function () {
            let hazardLabel = rasterLabels[this.value];
            hazardLayer = hazardConfig[hazardLabel] ? hazardConfig[hazardLabel].hazardLayer : null;

            if (hazardConfig[hazardLabel]) {
                currentHazardDescription = hazardConfig[hazardLabel].text.description;
                if (pdfDescription) pdfDescription.textContent = currentHazardDescription; // Update hazard description below map
                if (pdfHazardTitle) pdfHazardTitle.textContent = currentHazardDescription; // Update PDF map title
                if (pdfHazardIcon) {
                    pdfHazardIcon.src = `/assets/img/${hazardConfig[hazardLabel].icon}`;
                    pdfHazardIcon.style.display = "inline-block";
                }// Update PDF hazard icon}
            } else {
                currentHazardDescription = '';
                if (pdfDescription) pdfDescription.textContent = '';
                if (pdfHazardTitle) {
                    pdfHazardTitle.textContent = '';
                    pdfHazardIcon.style.display = "none";

                }
                if (pdfHazardIcon) pdfHazardIcon.src = '';

            }

            // Update PDF content active raster label
            //document.getElementById('active-raster').textContent = hazardLabel;

            globalTintClass = '';
            if (tintBlueBtn) tintBlueBtn.classList.remove('active');
            if (tintRedBtn) tintRedBtn.classList.remove('active');
            resetLegend();
            updateLegendBar(this.value);
            toggleRaster(hazardLayer);

            //update pdf header title

        });
    });

function toggleRaster(hazardLayer) {
    if (currentHazardLayer) {
        map.removeLayer(currentHazardLayer);
        currentHazardLayer = null;
    }
    if (!hazardLayer) return;
    showRaster(hazardLayer);
}

function showRaster(hazardLayer) {
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
        // Re-apply tint if one was active before this layer loaded
        // if (globalTintClass) applyTint(globalTintClass);
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
    // Sync opacity to live legend swatches
    document.querySelectorAll('#legend-content .legend-bar-swatch-color').forEach(el => {
        el.style.opacity = this.value / 100;
    });
});

// ---- TINT BUTTONS ----
const tintBlueBtn = document.getElementById('tint-blue-btn');
const tintRedBtn = document.getElementById('tint-red-btn');
const tintResetBtn = document.getElementById('tint-reset-btn');

function applyTint(tintClass) {
    globalTintClass = tintClass;

    if (currentHazardLayer) {
        const container = currentHazardLayer.getContainer();
        if (container) {
            container.classList.remove('red-tint-layer', 'blue-tint-layer');
            if (tintClass === 'hazard-blue') container.classList.add('blue-tint-layer');
            if (tintClass === 'hazard-red') container.classList.add('red-tint-layer');
        }
    }

    // Apply tint to legend swatches
    document.querySelectorAll('#legend-content .legend-bar-swatch-color').forEach(el => {
        el.classList.remove('red-tint-layer', 'blue-tint-layer');
        if (tintClass === 'hazard-blue') el.classList.add('blue-tint-layer');
        if (tintClass === 'hazard-red') el.classList.add('red-tint-layer');
    });

    // Update button active state
    [tintBlueBtn, tintRedBtn].forEach(btn => btn.classList.remove('active'));
    if (tintClass === 'hazard-blue') tintBlueBtn.classList.add('active');
    if (tintClass === 'hazard-red') tintRedBtn.classList.add('active');
}

if (tintBlueBtn) tintBlueBtn.addEventListener('click', () => applyTint('hazard-blue'));
if (tintRedBtn) tintRedBtn.addEventListener('click', () => applyTint('hazard-red'));
if (tintResetBtn) tintResetBtn.addEventListener('click', () => applyTint(''));

// ----------------------
// LEGEND BAR (above map)
// ----------------------
function updateLegendBar(hazardValue) {
    if (!legendContent) return;

    if (hazardValue === 'none' || !hazardConfig) {
        legendContent.innerHTML = '<em>Select a hazard layer to view the legend</em>';
        return;
    }

    const hazardLabel = rasterLabels[hazardValue];
    const mapConfig = hazardConfig[hazardLabel];
    if (!mapConfig || !mapConfig.legend) {
        legendContent.innerHTML = '<em>Select a hazard layer to view the legend</em>';
        return;
    }

    const opacityVal = opacityRange.value / 100;
    let html = `<span class="legend-bar-label">${mapConfig.legend.title}</span>`;

    if (mapConfig.legend.type === 'categorical') {
        mapConfig.legend.labels.forEach((label, i) => {
            const color = mapConfig.legend.colors[i];
            html += `<span class="legend-bar-swatch">
                <span class="legend-bar-swatch-color" style="background:${color};opacity:${opacityVal}"></span>
                ${label}
            </span>`;
        });
    } else if (mapConfig.legend.type === 'range') {
        const colors = mapConfig.legend.colors;
        const labels = mapConfig.legend.labels;
        const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
        html += `<span class="legend-bar-swatch">
            <span class="legend-bar-swatch-color" style="background:${gradient};width:48px;opacity:${opacityVal};border-radius:2px"></span>
            <span>${labels[labels.length - 1]}</span>
            <span style="color:var(--wb-gray-500)">→</span>
            <span>${labels[0]}</span>
        </span>`;
    }

    legendContent.innerHTML = html;
}

// ----------------------
// PDF LEGEND (in pdf-wrapper)
// ----------------------
function buildLegend(activeAdminLayers = []) {
    let hazardLabel = rasterLabels[document.querySelector('input[name="hazard-layer"]:checked').value];
    let mapConfig = hazardConfig[hazardLabel];
    document.getElementById('hazard-legend-title').textContent = mapConfig.legend.title;
    let legItemsContainer = document.getElementById('hazard-legend-items');
    legItemsContainer.innerHTML = '';

    if (mapConfig.legend.type === 'categorical') {
        for (let i = 0; i < mapConfig.legend.labels.length; i++) {
            let label = mapConfig.legend.labels[i];
            let color = mapConfig.legend.colors[i];
            let opacityVal = document.getElementById('opacity-range').value;

            legItemsContainer.innerHTML += `
            <div class="legend-item">
                <span class="legend-color ${globalTintClass}" style="background-color: ${color}; display: block; opacity: ${opacityVal / 100}"></span>
                <span class="legend-label">${label}</span>
            </div>`;
        }
    } else if (mapConfig.legend.type === 'range') {
        let opacityVal = document.getElementById('opacity-range').value;
        let colors = mapConfig.legend.colors;
        let labels = mapConfig.legend.labels;
        let gradientString = `linear-gradient(to bottom, ${colors.join(', ')})`;
        let labelsHtml = labels.map(label => `<span class="legend-label">${label}</span>`).join('');
        legItemsContainer.innerHTML += `
        <div class="legend-item-range" style="display: flex; align-items: stretch; gap: 10px; margin-top: 5px;">
            <div class="legend-gradient-bar ${globalTintClass}"
                 style="background: ${gradientString}; opacity: ${opacityVal / 100};">
            </div>
            <div class="legend-range-labels">${labelsHtml}</div>
        </div>`;
    }

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
                document.querySelector(".legend-label.admin-comm").textContent = 'Settlement';
            }
        });
    }
}

function resetLegend() {
    document.getElementById('hazard-legend-title').textContent = '';
    document.querySelectorAll('.legend-color').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.legend-label').forEach(el => el.textContent = '');
    document.getElementById('admin-legend-title').textContent = '';
}

// ----------------------
// CREATE PDF LAYOUT
// ----------------------
function createPdfLayout(download = true) {
    const mapElement = document.getElementById('map');
    const zoomControl = document.querySelector(".leaflet-control-zoom");
    const scaleBar = document.querySelector(".leaflet-control-scale-line");
    const mapContainerLayout = document.getElementById('map-container');
    const scaleBarLayout = document.getElementById('scale-bar');
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    document.getElementById('footer-date').innerHTML = `<strong>Date Created: </strong> ${formattedDate}`;

    const scaleLineEl = document.querySelector(".leaflet-control-scale-line"); //scalebar element in the leaflet map
    scaleBarWidth = scaleLineEl.style.width || (scaleLineEl.offsetWidth + 'px');
    scaleBarText = scaleLineEl.textContent;

    let activeAdminLayers = Object.entries(overlayLayers)
        .filter(([key, layer]) => map.hasLayer(layer))
        .map(([key]) => key);

    buildLegend(activeAdminLayers);

    // Hide zoom and scale controls for clean screenshot
    if (zoomControl) zoomControl.style.display = 'none';
    if (scaleBar) scaleBar.style.display = 'none';

    // Temporarily resize map to exact PDF dimensions (230mm × 170mm at 96dpi)
    // 1mm = 3.7795px → 230mm = 869px, 170mm = 642px
    const PDF_MAP_W = 869;
    const PDF_MAP_H = 642;
    const origWidth = mapElement.style.width;
    const origHeight = mapElement.style.height;
    const origFlex = mapElement.style.flex;
    mapElement.style.width = PDF_MAP_W + 'px';
    mapElement.style.height = PDF_MAP_H + 'px';
    mapElement.style.flex = 'none';
    map.invalidateSize({ animate: false });

    htmlToImage.toPng(mapElement, { width: PDF_MAP_W, height: PDF_MAP_H, pixelRatio: 2 })
        .then(function (dataUrl) {
            // Restore map dimensions
            mapElement.style.width = origWidth;
            mapElement.style.height = origHeight;
            mapElement.style.flex = origFlex;
            map.invalidateSize({ animate: false });

            if (zoomControl) zoomControl.style.display = '';
            if (scaleBar) scaleBar.style.display = '';

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
                </div>`;

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

            // mapTitle: use user-entered value or fall back to location string
            const mapTitleInput = document.getElementById('map-title');
            const mapTitle = (mapTitleInput && mapTitleInput.value.trim()) ? mapTitleInput.value.trim() : titleText;
            const hazardTitle = document.getElementById("pdf-map-title").innerText

            layoutConfig = {
                hazardConfig: hazardConfig,
                rasterLabels: rasterLabels,
                scaleBarWidth: parseFloat(scaleBarWidth),
                scaleBarText: scaleBarText,
                overlayLayers: overlayLayers,
                activeAdminLayers: activeAdminLayers,
                provincesColor: provincesColor,
                districtsColor: districtsColor,
                communitiesStroke: communitiesStroke,
                communitiesFill: communitiesFill,
                hazardDescription: currentHazardDescription,
                mapTitle: [hazardTitle, mapTitle],
            };

            if (download) {
                downloadPdf(layoutConfig);
            } else {
                // Show preview modal
                const wrapper = document.getElementById('pdf-wrapper');
                wrapper.style.zIndex = 1000;
            }
        })
        .catch(err => {
            mapElement.style.width = origWidth;
            mapElement.style.height = origHeight;
            mapElement.style.flex = origFlex;
            map.invalidateSize({ animate: false });
            if (zoomControl) zoomControl.style.display = '';
            if (scaleBar) scaleBar.style.display = '';
            console.error('PDF capture failed:', err);
        });
}

downloadPdfBtn.addEventListener('click', function () {
    createPdfLayout(true);
});

if (previewPdfBtn) {
    previewPdfBtn.addEventListener('click', function () {
        createPdfLayout(false);
    });
}

if (downloadFromPreviewBtn) {
    downloadFromPreviewBtn.addEventListener('click', function () {
        if (layoutConfig && layoutConfig.hazardConfig) {
            downloadPdf(layoutConfig);
        }
    });
}

window.createPdfLayout = createPdfLayout;
window.downloadPdf = downloadPdf;

// ----------------------
// START APP
// ----------------------
document.addEventListener('DOMContentLoaded', () => {
    initMap();
});

// Invalidate map size on window resize to prevent tile clipping
window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
});
