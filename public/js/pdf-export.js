// ----------------------
// DOWNLOAD PDF
// ----------------------

// Make the function async so we can await the font loading
// Add activeAdminLayers as a parameter to the function
async function downloadPdf(layoutConfig) {
    const mapImgElement = document.getElementById('map-image');
    if (!mapImgElement) {
        alert("Map image not ready yet.");
        return;
    }
    const mapDataUrl = mapImgElement.src;

    const logoImg = document.getElementById('wb-logo');
    const titleText = document.getElementById('layout-title').textContent || 'Map';
    const dateText = document.getElementById('footer-date').innerText || '';
    const { jsPDF, GState } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const margin = 2;
    const headerHeight = 12;
    const mapHeight = 170;
    const mapWidth = 220;
    const pdfWidth = 297;
    const padding = 2;
    
    let mapImgWidthPx = document.getElementById('map-image').naturalWidth; // Get the original pixel width of the map image
    let mmPerPixel = mapWidth / mapImgWidthPx; // Convert pixel dimensions to mm for PDF
    console.log("Calculated mm per pixel:", mmPerPixel);
    console.log("Scale bar width in pixels:", layoutConfig);
    let scaleBarWidthmm = layoutConfig.scaleBarWidth * mmPerPixel; // Convert scale bar width from pixels to mm for PDF
    console.log("Scale bar width in mm for PDF:", scaleBarWidthmm);

    let checkedHazard = document.querySelector('input[name="hazard-layer"]:checked');
    let hazardLabel = layoutConfig.rasterLabels[checkedHazard.value];
    let mapConfig = layoutConfig.hazardConfig[hazardLabel];
    console.log("mapConfig for PDF generation:", mapConfig);

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

    // // LOAD CUSTOM BOLD FONT
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

    pdf.setDrawColor(50, 50, 50);
    pdf.setLineWidth(0.2);

    // --- A. HEADER ---
    pdf.setFillColor(28, 69, 110);
    pdf.rect(margin, margin, pdfWidth - margin * 2, headerHeight, 'FD');

    if (logoImg) {
        pdf.addImage(logoImg, 'PNG', margin + 2, margin + 2, 8, 8);
    }

    pdf.setFont('Open Sans', 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(15);
    pdf.text(titleText, margin + 15, margin + 8);
    pdf.setFont('Open Sans', 'normal');

    // --- B. ADD THE MAP IMAGE ---
    const mapY = margin + 14;
    pdf.addImage(mapDataUrl, 'PNG', margin, mapY, mapWidth, mapHeight);
    pdf.rect(margin, mapY, mapWidth, mapHeight, 'S'); // Map Border

    // --- C. DRAW THE DYNAMIC LEGEND (Right Panel) ---
    const legendX = margin + mapWidth + 4; // Start right after the map
    let legendY = mapY + 5;

    // Draw Legend Panel Border
    pdf.rect(legendX - 2, mapY, pdfWidth - mapWidth - margin * 3, mapHeight, 'S');

    // 1. Get Hazard Data

    if (checkedHazard) {
        // Grab the opacity value from your slider (convert from 0-100 to 0.0-1.0)
        let opacityVal = document.getElementById('opacity-range').value / 100;

        // Create jsPDF Graphics States
        const transparentState = new GState({ opacity: opacityVal });
        const normalState = new GState({ opacity: 1.0 });

        // Draw Hazard Title
        pdf.setTextColor(0, 0, 0);
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
                let color = mapConfig.legend.colors[i];

                pdf.setFillColor(color);

                // Turn ON opacity
                pdf.setGState(transparentState);
                pdf.rect(legendX, legendY - 3, 5, 5, 'F');

                // Turn OFF opacity so the text isn't transparent!
                pdf.setGState(normalState);

                pdf.text(label, legendX + 8, legendY + 1);
                legendY += 7; // Move down for the next item
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

    // 2. Draw Admin Layers (If Any)
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
                pdf.setLineWidth(0.8);
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
                pdf.circle(legendX + 2.5, legendY - 0.5, 2.5, 'FD');
                pdf.text('Community', legendX + 8, legendY + 1);
                legendY += 7;
            }
        });
    }

    console.log(mapConfig)
    pdf.setFont("Open Sans", "bold");
    pdf.setFontSize(11);
    pdf.text(mapConfig.legend.title, legendX, legendY + 5);
    legendY += 8;
    // Include textarea with id raster-info in the PDF
    const rasterInfo = document.getElementById('raster-info').value;
    if (rasterInfo) {
        pdf.setFont('Open Sans Condensed', 'normal');
        pdf.setFontSize(10);
        const infoLines = pdf.splitTextToSize(rasterInfo, pdfWidth - mapWidth - margin * 4);
        pdf.text(infoLines, legendX, legendY + 5);
    }

    // --- D. DRAW THE FOOTER ---
    const footerY = margin * 3 + headerHeight + mapHeight;
    const footerSpacing = 4;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(50, 50, 50);
    pdf.setLineWidth(0.2);
    pdf.rect(margin, footerY, 293, 20, 'FD');

    pdf.setFontSize(8);

    pdf.setFont("Open Sans", "normal");
    pdf.text(`The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the World Bank Group.`, margin + padding, footerY + padding + footerSpacing);
    pdf.setTextColor(0, 0, 0);
    pdf.text(dateText, margin + padding, footerY + padding + footerSpacing * 2);
    pdf.setTextColor(0, 0, 255);
    pdf.textWithLink("Feedback: INSERT EMAIL HERE", margin + padding, footerY + padding + footerSpacing * 3, { url: "mailto:tbd@worldbank.org" });
    

    // ADD SCALE BAR
    const scaleSegmentWidth = scaleBarWidthmm / 2;
    const scaleHeight = 4;
    const rightEdge = pdfWidth - margin * 2;
    const scaleCentreX = (legendX + rightEdge) / 2;
    const scaleStartX = scaleCentreX - scaleSegmentWidth;
    // left (filled)
    pdf.setFillColor('#004972');
    pdf.rect(scaleStartX, footerY + footerSpacing * 2, scaleSegmentWidth, scaleHeight, "F");
    // right (empty)
    pdf.setDrawColor('#004972');
    pdf.rect(scaleCentreX, footerY + footerSpacing * 2, scaleSegmentWidth, scaleHeight);
    pdf.setTextColor('#004972')
    pdf.setFont('Open Sans', 'bold');
    console.log(layoutConfig.scaleBarText);
    pdf.text(layoutConfig.scaleBarText, scaleCentreX, footerY + 7, {align: 'center'});


    // --- E. SAVE THE PDF ---
    pdf.save(`${titleText}.pdf`);

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

export { downloadPdf, fetchFontAsBase64 };