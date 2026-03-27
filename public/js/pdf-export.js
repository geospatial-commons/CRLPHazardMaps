// ----------------------
// DOWNLOAD PDF
// ----------------------

// Make the function async so we can await the font loading
// Add activeAdminLayers as a parameter to the function
async function downloadPdf(layoutConfig) {

    // get all the dynamic content needed for the PDF
    const mapImgElement = document.getElementById('map-image');
    if (!mapImgElement) {
        alert("Map image not ready yet.");
        return;
    }
    const mapDataUrl = mapImgElement.src;
    const logoImg = document.getElementById('wb-logo');
    const hazardIcon = document.getElementById('pdf-hazard-icon');
    const titleText = layoutConfig.mapTitle[0] || document.getElementById('layout-title').textContent || 'Map';
    const locationText = layoutConfig.mapTitle[1] || '';
    let dateText = document.getElementById('footer-date').innerText || '';
    dateText = dateText.split(': ')[1] || 'Unknown Date';

    let checkedHazard = document.querySelector('input[name="hazard-layer"]:checked');
    let hazardLabel = layoutConfig.rasterLabels[checkedHazard.value];
    let mapConfig = layoutConfig.hazardConfig[hazardLabel];
    console.log("mapConfig for PDF generation:", mapConfig);

    const scaleLineEl = document.querySelector(".leaflet-control-scale-line"); //scalebar element in the leaflet map

    // start jspdf setup
    const { jsPDF, GState } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    // setup for drawing elements - dimensions, margins, etc.
    const margin = 2;
    const headerHeight = 14;
    const mapHeight = 170;
    const mapWidth = 230;
    const pdfWidth = 297;
    const padding = 2;
    const footerHeight = 17;
    const mmPerPixel = 3.7795//mapWidth / mapImgWidthPx; // Convert pixel dimensions to mm for PDF
    const logoSizeMM = 10; // Desired logo size in mm (both width and height)


    //let mapImgWidthPx = document.getElementById('map-image').naturalWidth; // Get the original pixel width of the map image
    console.log("Calculated mm per pixel:", mmPerPixel);
    console.log("Scale bar width in pixels:", layoutConfig);


    // --- LOAD CUSTOM FONT ---
    try {
        const fontBase64 = await fetchFontAsBase64('/assets/fonts/OpenSans-Regular.ttf');
        pdf.addFileToVFS('OpenSans-Regular.ttf', fontBase64);
        pdf.addFont('OpenSans-Regular.ttf', 'Open Sans', 'normal');
        pdf.setFont('Open Sans', 'normal');
    } catch (err) {
        console.error("Could not load Open Sans font", err);
        pdf.setFont('helvetica', 'normal');
    }

    // LOAD CUSTOM BOLD FONT
    try {
        const fontBase64Bold = await fetchFontAsBase64('/assets/fonts/OpenSans-Bold.ttf');
        pdf.addFileToVFS('OpenSans-Bold.ttf', fontBase64Bold);
        pdf.addFont('OpenSans-Bold.ttf', 'Open Sans', 'bold');
    } catch (err) {
        console.error("Could not load Open Sans Bold font", err);
    }

    try {
        const fontBase64Condensed = await fetchFontAsBase64('/assets/fonts/OpenSans_Condensed-Regular.ttf');
        pdf.addFileToVFS('OpenSans_Condensed-Regular.ttf', fontBase64Condensed);
        pdf.addFont('OpenSans_Condensed-Regular.ttf', 'Open Sans Condensed', 'normal');
    } catch (err) {
        console.error("Could not load Open Sans Condensed font", err);
    }

    try {
        const fontBase64Italic = await fetchFontAsBase64('/assets/fonts/OpenSans-Italic.ttf');
        pdf.addFileToVFS('OpenSans-Italic.ttf', fontBase64Italic);
        pdf.addFont('OpenSans-Italic.ttf', 'Open Sans', 'italic');
    } catch (err) {
        console.error("Could not load Open Sans Italic font", err);
    }

    pdf.setDrawColor('#323232');
    pdf.setLineWidth(0.2);

    // --- A. HEADER ---
    pdf.setFillColor('#002244');
    pdf.rect(margin, margin, pdfWidth - margin * 2, headerHeight, 'FD');

    //1. draw logo
    if (logoImg) {
        pdf.addImage(logoImg, 'PNG', pdfWidth - margin*2-logoSizeMM, margin + margin, logoSizeMM, logoSizeMM);
    }

    //2. draw border after logo
    pdf.setDrawColor('#ffffff');
    pdf.setLineWidth(0.3);
    pdf.line(margin*3 + logoSizeMM, margin+margin, margin*3 + logoSizeMM, logoSizeMM+margin+margin);

    //3. draw hazard logo; check if image is svg or img
    if (hazardIcon) {
        const src = hazardIcon.src;
        const xPos = margin * 2;
        const yPos = margin * 2;

        // Check if it's an SVG (checks file extension OR data-uri type)
        const isSvg = src.toLowerCase().endsWith('.svg') || src.includes('image/svg+xml');

        if (isSvg) {
            // --- SVG LOGIC ---
            try {
                const response = await fetch(src);
                const svgText = await response.text();
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
                const svgElement = svgDoc.documentElement;

                await pdf.svg(svgElement, {
                    x: xPos,
                    y: yPos,
                    width: logoSizeMM,
                    height: logoSizeMM
                });
            } catch (err) {
                console.error("SVG rendering failed, falling back to addImage", err);
                // Fallback just in case fetch fails
                pdf.addImage(src, 'PNG', xPos, yPos, logoSizeMM, logoSizeMM);
            }
        } else if(!src.toLowerCase().endsWith('app')) {
            console.log("src",src);
            
            // --- RASTER LOGIC (PNG/JPG) ---
            // jsPDF's addImage handles URL strings directly
            try {
                pdf.addImage(src, 'PNG', xPos, yPos, logoSizeMM, logoSizeMM);
            } catch (error) {
                console.log(error);
            }
            
        }
    }

    //4. draw border after logo
    //pdf.setDrawColor('#ffffff');
    //pdf.setLineWidth(0.3);
    //pdf.line(margin*5 + logoSizeMM * 2, margin+margin, margin*5 + logoSizeMM * 2, logoSizeMM+margin+margin);

    //reset line color to original
    pdf.setDrawColor('#323232');

    //set main title
    pdf.setFont('Open Sans', 'bold');
    pdf.setTextColor('#ffffff');
    let fontSize = 16
    pdf.setFontSize(fontSize);
    pdf.text(titleText, margin * 5 + logoSizeMM, margin*2+fontSize/mmPerPixel);

    //set secondary title (location)
    pdf.setFont('Open Sans', 'normal');
    let fontSizeLoc = 14
    pdf.setFontSize(fontSizeLoc);
    pdf.text(locationText, margin * 5 + logoSizeMM, margin*3+fontSize/mmPerPixel + fontSizeLoc/mmPerPixel);
    

    // --- B. ADD THE MAP IMAGE ---
    const mapY = margin + headerHeight + padding;
    pdf.addImage(mapDataUrl, 'PNG', margin, mapY, mapWidth, mapHeight);
    pdf.rect(margin, mapY, mapWidth, mapHeight, 'S'); // Map Border

    // --- C. DRAW THE DYNAMIC LEGEND (Right Panel) ---
    const legendX = margin + mapWidth + 4; // Start right after the map
    let legendY = mapY + 5;

    // Draw Legend Panel Border
    pdf.rect(legendX - 2, mapY, pdfWidth - mapWidth - margin * 3, mapHeight, 'S');

    // 1. Get Hazard Data

    if (checkedHazard) {
        // grab the legend in the mainpage
        const legendDomSwatches = document.querySelectorAll('#legend-content .legend-bar-swatch-color');

        // Grab the opacity value from your slider (convert from 0-100 to 0.0-1.0)
        let opacityVal = document.getElementById('opacity-range').value / 100;

        // Create jsPDF Graphics States
        const transparentState = new GState({ opacity: opacityVal });
        const normalState = new GState({ opacity: 1.0 });

        // Draw Hazard Title
        pdf.setTextColor('#000000');
        pdf.setFont('Open Sans', 'bold');
        pdf.setFontSize(11);
        pdf.text(mapConfig.legend.title, legendX, legendY);
        legendY += 8;

        pdf.setFont("Open Sans", "normal");
        pdf.setFontSize(10);



        // Draw Categorical Labels
        if (mapConfig.legend.type === 'categorical') {
            for (let i = 0; i < mapConfig.legend.labels.length; i++) {
                let label = mapConfig.legend.labels[i];

                if (globalTintClass && legendDomSwatches[i]) {
                    try {
                        const swatchDataUrl = await htmlToImage.toPng(legendDomSwatches[i], {
                            backgroundColor: null,
                            pixelRatio: 2
                        });

                        pdf.addImage(swatchDataUrl, 'PNG', legendX, legendY - 3, 5, 5);
                        pdf.setDrawColor('#cccccc');
                        pdf.setLineWidth(0.1);
                        pdf.rect(legendX, legendY - 3, 5, 5, 'S');
                    } catch (err) {
                        console.error('Failed to render tinted legend swatch:', err);

                        //set original color with opacity if swatch rendering fails
                        pdf.setFillColor(mapConfig.legend.colors[i]);
                        pdf.setDrawColor('#cccccc');
                        pdf.setLineWidth(0.1);
                        pdf.setGState(transparentState);
                        pdf.rect(legendX, legendY - 3, 5, 5, 'FD');
                        pdf.setGState(normalState);
                    }
                } else {
                    pdf.setFillColor(mapConfig.legend.colors[i]);
                    pdf.setDrawColor('#cccccc');
                    pdf.setLineWidth(0.1);
                    pdf.setGState(transparentState);
                    pdf.rect(legendX, legendY - 3, 5, 5, 'FD');
                    pdf.setGState(normalState);
                }

                pdf.setTextColor('#000000');
                pdf.text(label, legendX + 8, legendY + 1);
                legendY += 6;
            }
        }
        // Draw Range Labels (Simulate Gradient)
        else if (mapConfig.legend.type === 'range') {
            let colors = mapConfig.legend.colors;
            let labels = mapConfig.legend.labels;

            let barHeight = 25;
            let blockHeight = barHeight / colors.length;

            // Turn ON opacity for the whole gradient bar
            pdf.setGState(transparentState);

            // Draw stacked color boxes
            for (let i = 0; i < colors.length; i++) {
                pdf.setFillColor(colors[i]);
                pdf.rect(legendX, legendY - 3 + (i * blockHeight), 5, blockHeight, 'F');
            }

            // Turn OFF opacity before drawing the labels
            pdf.setGState(normalState);

            // Distribute labels evenly along the bar
            let numLabels = labels.length;
            for (let i = 0; i < numLabels; i++) {
                let labelY = legendY + 1 + (i * (barHeight / (numLabels - 1 || 1)));
                pdf.text(labels[i], legendX + 8, labelY);
            }
            legendY += barHeight + 8;
        }
    }

    // 2. Add Admin Layers Labels to Legend (If Any)
    if (layoutConfig.activeAdminLayers.length > 0) {
        legendY += 5; // Add spacing before admin section

        pdf.setFont("Open Sans", "bold");
        pdf.setFontSize(11);
        pdf.text('Administrative Data', legendX, legendY);
        legendY += 8;
        pdf.setFont("Open Sans", "normal");
        pdf.setFontSize(10);

        layoutConfig.activeAdminLayers.forEach(layerName => {
            if (layerName === 'Provinces') {
                pdf.setDrawColor(layoutConfig.provincesColor); // Make sure this variable is accessible!
                pdf.setLineWidth(0.4);
                pdf.rect(legendX, legendY - 3, 5, 5, 'S'); // 'S' for Stroke only
                pdf.text('Province', legendX + 8, legendY + 1);
                legendY += 7;
            } else if (layerName === 'Districts') {
                pdf.setDrawColor(layoutConfig.districtsColor); // Make sure this variable is accessible!
                pdf.setLineWidth(0.4);
                pdf.rect(legendX, legendY - 3, 5, 5, 'S');
                pdf.text('District', legendX + 8, legendY + 1);
                legendY += 7;
            } else if (layerName === 'Communities') {
                pdf.setFillColor(layoutConfig.communitiesFill); // Make sure this variable is accessible!
                pdf.setDrawColor(layoutConfig.communitiesStroke);
                pdf.setLineWidth(0.2);
                // pdf.circle(x, y, radius, style) - x,y are the center point
                pdf.circle(legendX + 2.5, legendY - 0.5, 1, 'FD');
                pdf.text('Settlement', legendX + 8, legendY + 1);
                legendY += 7;
            } else if (layerName === 'District Capitals') {
                pdf.setFillColor(layoutConfig.districtCapitalColor); // Make sure this variable is accessible!
                pdf.setDrawColor(layoutConfig.districtCapitalStroke);
                pdf.setLineWidth(0.2);
                pdf.circle(legendX + 2.5, legendY - 0.5, 1, 'FD');
                pdf.text('District Capital', legendX + 8, legendY + 1);
                legendY += 7;
            }

        });
    }

    pdf.setFont("Open Sans", "bold");
    pdf.setFontSize(11);
    pdf.text("Hazard Description", legendX, legendY + 5);
    legendY += 8;
    // Include hazard description in the PDF (from JS state, not DOM) or from textaarea to implement comments
    let txtareatext = document.getElementById("pdf-hazard-description").value
    console.log(txtareatext);
    
    const rasterInfo = txtareatext || layoutConfig.hazardDescription || '';
    if (rasterInfo) {
        pdf.setFont('Open Sans Condensed', 'normal');
        pdf.setFontSize(10);
        const infoLines = pdf.splitTextToSize(rasterInfo, pdfWidth - mapWidth - margin * 4);
        pdf.text(infoLines, legendX, legendY + 5);
    }

    // --- D. DRAW THE FOOTER ---
    const footerY = margin * 3 + headerHeight + mapHeight;
    const footerSpacing = 4;

    pdf.setFillColor('#ffffff');
    pdf.setDrawColor('#323232');
    pdf.setLineWidth(0.2);
    pdf.rect(margin, footerY, pdfWidth - margin * 2, footerHeight, 'FD');

    pdf.setFontSize(8);

    pdf.setFont("Open Sans", "italic");
    pdf.setTextColor('#000000');
    pdf.text(`The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the World Bank Group.`, margin + padding, footerY + padding + footerSpacing);
    pdf.setFont("Open Sans", "normal");
    pdf.text(dateText, margin + padding + 20, footerY + padding + footerSpacing * 2);
    pdf.setFont("Open Sans", "bold");
    pdf.text('Date Created: ', margin + padding, footerY + padding + footerSpacing * 2);
    pdf.text('Feedback: ', margin + padding, footerY + padding + footerSpacing * 3)
    pdf.setTextColor('#0000ff');
    pdf.setFont("Open Sans", "italic");
    pdf.textWithLink("INSERT EMAIL HERE", margin + padding + 15, footerY + padding + footerSpacing * 3, { url: "mailto:tbd@worldbank.org" });


    // ADD SCALE BAR
    let scaleBarWidthmm = scaleLineEl.offsetWidth / mmPerPixel; // Convert scale bar width from pixels to mm for PDF
    console.log("Scale bar width in mm for PDF:", scaleBarWidthmm);
    const scaleSegmentWidth = scaleBarWidthmm / 2;
    const scaleHeight = 3;
    const rightEdge = pdfWidth - margin * 2;
    const scaleCentreX = (legendX + rightEdge) / 2;
    const scaleStartX = scaleCentreX - scaleSegmentWidth;
    // left (filled)
    pdf.setDrawColor('#002244'); //apply drawcolor to both ticks left and right
    pdf.setFillColor('#002244');
    pdf.rect(scaleStartX, footerY + footerSpacing * 2, scaleSegmentWidth, scaleHeight, "F");
    // right (empty)
    pdf.rect(scaleCentreX, footerY + footerSpacing * 2, scaleSegmentWidth, scaleHeight);
    pdf.setTextColor('#002244')
    pdf.setFont('Open Sans', 'bold');
    pdf.text(layoutConfig.scaleBarText, scaleCentreX, footerY + 7, { align: 'center' });


    // --- E. SAVE THE PDF ---
    pdf.save(`${titleText + " - " + locationText}.pdf`);

}

// Helper function to fetch a font file and convert it to Base64
async function fetchFontAsBase64(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}



export { downloadPdf };