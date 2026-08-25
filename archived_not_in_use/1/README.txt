COUNTY POPULATION MAP

The three files in data/ are unchanged copies of the originals:

- Vintage 2025 counties race & ethnicity 1.csv
- Ruralurbancontinuumcodes2023.csv
- counties_2025_s.geojson

IMPORTANT
---------
Because index.html imports local CSV and GeoJSON files, it must be opened through
a web server. Double-clicking index.html may produce a blank map because browsers
block local fetch requests.

From this folder in Visual Studio Code's terminal, run:

    python3 -m http.server 8000

Then open:

    http://localhost:8000

You can also use the VS Code Live Server extension.

The browser filters the original population CSV to:
- AGEGRP = 0
- YEAR = 1 (2020)
- YEAR = 7 (2025)

No data file is edited or preprocessed.
