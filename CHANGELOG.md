# Changelog

All notable changes to the CRLP Hazard Mapping Application are documented here.

---

## [1.1.0] - 2026-03-27

### Added
- Security middleware: Helmet (HTTP security headers), rate limiting (100 req/15 min per IP), and express-validator param validation on all tile and API routes
- Contours context layer (100m interval) available as a vector overlay at zoom 12+
- Earthquake SVG icon added to assets (layer hidden pending national dataset)

### Changed
- Hazard layer data files renamed to `[hazard]_rp[year]` convention (`flood_rp20`, `landslide_rp20`, `avalanche_rp100`, `earthquake_rp475`, `contours_100m`)
- Contours renamed to "Contours - 100m" throughout UI, preview legend, and PDF export
- Earthquake hidden from hazard selector (national earthquake dataset in development)
- Tint controls (Blue/Red) hidden from sidebar — hazard colors are accurate without tinting
- Custom map title input hidden from Export section — will be replaced with inline editable field

### Fixed
- All MBTile connections now use `openOptional()` — server no longer crashes if a layer file is absent; missing layers return 404 instead of 500

---

## [1.0.0] - 2026-03-23

### Added
- WB Design System shell: 224px navy sidebar, 56px header with WB logo, full-viewport map layout
- Legend bar (36px, above map) with per-hazard color swatches
- PDF preview modal with Download and Close controls
- Scale bar in PDF export footer
- Context layers section in sidebar with dynamic toggle controls
- Tint controls (Blue/Red/Reset) for hazard layer color adjustment
- Opacity slider for hazard layer visibility
- `context-config.json` for configurable context layer definitions
- Vendored `html-to-image` and `jsPDF` libraries for offline-safe PDF export
- `.gstack/` directory with design audit reports and QA baselines
- Design audit baseline (B+ score, AI Slop A)

### Changed
- Complete HTML/CSS restructure from horizontal control panel to vertical sidebar layout
- Replaced Leaflet native layer control with custom sidebar-integrated basemap switcher
- Updated landing page to full-bleed WB-branded composition (removed white card container)
- PDF export header color updated from `#004972` → `#002244` (WB Navy token)
- Sidebar interactive elements: touch targets increased to `min-height: 32px`
- Sidebar scrollbar: width 4px → 5px, opacity 0.2 → 0.35 with hover state at 0.55
- Hazard source label: `font-size: 10px → 11px`
- Province/District/Community selects: `padding: 7px 8px`, `font-size: 12px → 13px`

### Fixed
- WCAG AA contrast: `.hazard-source` opacity 0.35 → 0.50 (~3.4:1 on navy)
- WCAG AA contrast: `#map-title::placeholder` opacity 0.30 → 0.45
- Focus ring consistency: `.hazard-option` `outline-offset: 1px → 2px`
- Added `aria-label` to basemap switcher buttons
- CSS variable scope: `landing.css` now defines `:root { --wb-blue; --wb-navy }` independently
- `.gitignore`: added `.gstack/` to prevent design reports from being committed
