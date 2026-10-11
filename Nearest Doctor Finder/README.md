# Nearest Doctor Finder — HTML/CSS/JavaScript

This is a plain HTML, CSS and JavaScript conversion of the supplied React/TanStack project.

## Files
- `index.html` — page structure
- `style.css` — responsive styles and gradient design
- `script.js` — Google Sheets CSV loading, operational-status filtering, distance calculation, address lookup, GPS, and specialty/payment/visit filters

## Important: Google Sheet
The JavaScript is configured with the Google Sheet ID from the supplied project:
`1cQuwXUh8VmU1lcROrO4vPsWDw0g2MQCjM_QaVrUkpHo`

The sheet must be shared as **Anyone with the link → Viewer** for public CSV fetching to work. No demo/sample doctor records are included. If this is not the intended sheet, replace `SHEET_ID` and `SHEET_GID` at the top of `script.js`.

Expected column order:
`Sr. No. | Doctor Name | Specialist | Doctor City | Status | Hospital Name and Address | Google location | Cash / Insurance | OPD / IPD`

## Run it
Because the app fetches a Google Sheet and uses browser geolocation, run it from a local web server rather than opening `index.html` directly.

### Option 1: VS Code
1. Extract the ZIP.
2. Open the folder in VS Code.
3. Install the **Live Server** extension (free).
4. Right-click `index.html` → **Open with Live Server**.

### Option 2: Python
Open a terminal in this folder and run:
`python -m http.server 8000`

Then open `http://localhost:8000`.

## Distance accuracy
- User-entered addresses are geocoded using OpenStreetMap Nominatim.
- Doctor records use the pre-computed pincode coordinates from the original project when available; otherwise, they fall back to a known city centre. City-centre distances are marked with `≈` because they are approximate.
- To improve exactness, add latitude/longitude columns to the Google Sheet or geocode each hospital address.

## Notes
- Free third-party services are used; they have usage policies and rate limits.
- This static frontend exposes only data from a publicly viewable sheet. Do not use a public sheet for private patient or hospital data.
