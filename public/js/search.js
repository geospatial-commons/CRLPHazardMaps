
window.addEventListener('load', () => {

    const nameInput = document.getElementById('unops-name-search');
    const codeInput = document.getElementById('unops-code-search');
    const panel = document.getElementById('search-suggestions-panel');
    const content = document.getElementById('suggestions-content');
    const closeBtn = document.getElementById('close-suggestions');
    const panelTitle = document.getElementById('panel-title');

    let debounceTimer;
    const map = window.map;
    const provSelect = window.provSelect || document.getElementById('prov-select');
    const distSelect = window.distSelect || document.getElementById('dist-select');
    const commSelect = window.commSelect || document.getElementById('comm-select');

    // --- Helper Functions ---

    const showPanel = (title) => {
        panel.classList.remove('hidden');
        panelTitle.innerText = title;
    };

    const hidePanel = () => {
        panel.classList.add('hidden');
        content.innerHTML = '';
    };

    const fetchSuggestions = (type, query) => {
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            hidePanel();
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const endpoint = type === 'name' ? '/api/communities/search/name' : '/api/communities/search/code';
                const response = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
                const data = await response.json();

                renderSuggestions(data);
            } catch (err) {
                console.error("Search error:", err);
            }
        }, 300); // Wait 300ms after user stops typing
    };

    const renderSuggestions = (items) => {
        if (items.length === 0) {
            content.innerHTML = '<div class="suggestion-item">No results found</div>';
            showPanel("0 Results Found");
            return;
        }

        content.innerHTML = items.map(item => {
            // Only show subtitle if secondary_name exists and is different from display_name
            const hasSubtitle = item.secondary_name &&
                item.secondary_name.trim() !== "" &&
                item.secondary_name !== item.display_name;

            return `
                <div class="suggestion-item" 
                    data-lat="${item.coord_y}" 
                    data-lng="${item.coord_x}"
                    data-name="${item.display_name}"
                    data-provcode="${item.norm_prov_code}"
                    data-distcode="${item.norm_dist_code}">
                    <div class="suggestion-main">
                        <strong>${item.display_name}</strong>
                        ${hasSubtitle ? `<div class="suggestion-subtitle">Other names: ${item.secondary_name}</div>` : ''}
                    </div>
                    <small class="suggestion-code">Code: ${item.match_cdc_id || 'N/A'}</small>
                </div>
            `;
        }).join('');

        showPanel(`${items.length} Results Found`);
    };

    // --- Event Listeners ---

    // Handle typing in Name search
    nameInput.addEventListener('input', (e) => {
        codeInput.value = ''; // Clear the other input
        fetchSuggestions('name', e.target.value);
    });

    // Handle typing in Code search
    codeInput.addEventListener('input', (e) => {
        nameInput.value = ''; // Clear the other input
        fetchSuggestions('code', e.target.value);
    });

    // Re-open panel when clicking back into an input if it has text
    [nameInput, codeInput].forEach(input => {
        input.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                const type = e.target.id.includes('name') ? 'name' : 'code';
                fetchSuggestions(type, e.target.value);
            }
        });
    });

    // Handle clicking a suggestion
    content.addEventListener('click', async (e) => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;

        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'flex'; // Show loading overlay during processing

        const { lat, lng, name, provcode, distcode } = item.dataset;

        console.log({ lat, lng, name, provcode, distcode });


        try {
            // 1. Set Province and trigger the fetch for Districts
            if (provSelect.value !== provcode) {
                provSelect.value = provcode;
                provSelect.dispatchEvent(new Event('change'));
            }

            // 2. Wait for DistSelect to be enabled and populated by your existing map.js logic
            await waitForDropdownPopulation(distSelect);

            // 3. Set District and trigger the fetch for Community
            if (distSelect.value !== distcode) {
                distSelect.value = distcode;
                distSelect.dispatchEvent(new Event('change'));
            }

            // 4. Wait for CommSelect to be enabled and populated
            await waitForDropdownPopulation(commSelect);
            //commSelect.value = targetValue;
            //commSelect.dispatchEvent(new Event('change'));

            // 5. CRITICAL: Select the Community by matching data-combined or name
            // We look for a value that matches "lat,lng" OR the text matches the name
            let found = false;
            const targetCoords = `${lat},${lng}`;

            for (let i = 0; i < commSelect.options.length; i++) {
                const opt = commSelect.options[i];
                const combined = opt.getAttribute('data-combined') || "";

                // Check if coordinates match the value OR if they exist inside data-combined
                if (opt.value === targetCoords || combined.includes(targetCoords)) {
                    commSelect.selectedIndex = i;
                    found = true;
                    commSelect.dispatchEvent(new Event('change'));
                    break;
                }
            }

        } catch (err) {
            console.error("Auto-sync failed:", err);
            map.flyTo([parseFloat(lat), parseFloat(lng)], 16, { animate: true, duration: 1.5 });
            overlay.style.display = 'none'; // Hide overlay if we fallback to just flying to location
        }

        overlay.style.display = 'none'; // Hide overlay once done
        hidePanel();
    });

    // Close button
    closeBtn.addEventListener('click', hidePanel);

    // Close if user clicks outside
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== nameInput && e.target !== codeInput) {
            hidePanel();
        }
    });

    // Helper to watch for your map.js async updates
    function waitForDropdownPopulation(selectEl) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                // If the select is no longer disabled and has options, it's ready
                if (!selectEl.disabled && selectEl.options.length > 1) {
                    clearInterval(interval);
                    resolve();
                }
                if (attempts > 50) { // Timeout after 5 seconds
                    clearInterval(interval);
                    reject("Dropdown population timed out");
                }
            }, 100);
        });
    }
});
