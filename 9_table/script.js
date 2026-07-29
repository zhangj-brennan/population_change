const FILES = {
  population: "data/Vintage 2025 counties race & ethnicity 1.csv",
  rucc: "data/Ruralurbancontinuumcodes2023.csv",
  counties: "data/counties_2025_s.geojson"
};

/*
  YEAR codes used in the Vintage 2025 county estimates file.

  The original map compared YEAR 1 with YEAR 7. That same 2020
  baseline is preserved here, while the intervening annual
  estimates are made available in the dropdowns.
*/
const YEAR_CODE_TO_LABEL = {
  1: 2020,
  3: 2021,
  4: 2022,
  5: 2023,
  6: 2024,
  7: 2025
};

const GROUPS = {
  total: {
    label: "Total population",
    fields: ["TotalPopulation"]
  },
  white: {
    label: "White, non-Hispanic",
    fields: ["White Male", "White Female"]
  },
  black: {
    label: "Black, non-Hispanic",
    fields: ["Black Male", "Black Female"]
  },
  native: {
    label: "American Indian/Alaska Native, non-Hispanic",
    fields: [
      "Indian/Alaska  American Male",
      "Indian/Alaska Native Female"
    ]
  },
  asian: {
    label: "Asian, non-Hispanic",
    fields: ["Asian Male", "Asian Female"]
  },
  pacific: {
    label: "Native Hawaiian/Pacific Islander, non-Hispanic",
    fields: [
      "Hawaiian/Pacific Islander Male",
      "Hawaiian/Pacific Islander Female"
    ]
  },
  latino: {
    label: "Latino",
    fields: ["Latino Male", "Latino Female"]
  }
};

const GROUP_COLORS = {
  total: "#111111",
  white: "#f23c3f",
  latino: "#e8ca0d",
  black: "#00b6f1",
  asian: "#32ef94",
  native: "#ff7fe9",
  pacific: "#c7a37c"
};


const STATE_FIPS_TO_ABBR = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY"
};

const ABBR_TO_STATE_FIPS = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_ABBR).map(([fips, abbreviation]) => [abbreviation, fips])
);

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming"
};

const REGIONS = {
  west: {
    label: "West",
    states: ["AK", "CA", "HI", "OR", "WA"]
  },
  mountain: {
    label: "Mountain",
    states: ["AZ", "CO", "ID", "MT", "NM", "NV", "UT", "WY"]
  },
  plains: {
    label: "Plains",
    states: ["IA", "KS", "MN", "MO", "ND", "NE", "SD"]
  },
  midwest: {
    label: "Midwest",
    states: ["IL", "IN", "MI", "OH"]
  },
  northeast: {
    label: "Northeast",
    states: ["CT", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"]
  },
  south: {
    label: "South",
    states: ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV"]
  }
};

const REGION_STATE_FIPS = Object.fromEntries(
  Object.entries(REGIONS).map(([regionKey, region]) => [
    regionKey,
    new Set(region.states.map(abbreviation => ABBR_TO_STATE_FIPS[abbreviation]))
  ])
);


const appState = {
  division: "all",
  groups: ["total"],
  metric: "count",
  startYear: 2020,
  endYear: 2025,
  selectedState: null,
  selectedRegion: null,
  valueFilterMin: null,
  valueFilterMax: null,
  valueFilterSignature: null
};

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  const groups = (params.get("groups") || params.get("group") || "")
    .split(",")
    .filter(groupKey => GROUPS[groupKey]);
  const division = params.get("division");
  const metric = params.get("metric");
  const startYear = Number(params.get("start"));
  const endYear = Number(params.get("end"));
  const selectedState = params.get("state");
  const selectedRegion = params.get("region");
  const filterMin = Number(params.get("min"));
  const filterMax = Number(params.get("max"));

  if (groups.length) appState.groups = groups.includes("total") ? ["total"] : groups;
  if (["all", "urban", "suburban", "rural"].includes(division)) appState.division = division;
  if (["count", "percent"].includes(metric)) appState.metric = metric;
  if (Number.isInteger(startYear) && startYear > 0) appState.startYear = startYear;
  if (Number.isInteger(endYear) && endYear > 0) appState.endYear = endYear;

  if (selectedState && STATE_FIPS_TO_ABBR[selectedState]) {
    appState.selectedState = selectedState;
    appState.selectedRegion = null;
  } else if (selectedRegion && REGIONS[selectedRegion]) {
    appState.selectedRegion = selectedRegion;
    appState.selectedState = null;
  }

  if (Number.isFinite(filterMin) && Number.isFinite(filterMax) && filterMin <= filterMax) {
    appState.valueFilterMin = filterMin;
    appState.valueFilterMax = filterMax;
  }
}

function updateURLState() {
  const url = new URL(window.location.href);
  url.searchParams.set("groups", appState.groups.join(","));
  url.searchParams.set("division", appState.division);
  url.searchParams.set("metric", appState.metric);
  url.searchParams.set("start", String(appState.startYear));
  url.searchParams.set("end", String(appState.endYear));

  if (appState.selectedState) url.searchParams.set("state", appState.selectedState);
  else url.searchParams.delete("state");

  if (appState.selectedRegion) url.searchParams.set("region", appState.selectedRegion);
  else url.searchParams.delete("region");

  if (Number.isFinite(appState.valueFilterMin) && Number.isFinite(appState.valueFilterMax)) {
    url.searchParams.set("min", String(appState.valueFilterMin));
    url.searchParams.set("max", String(appState.valueFilterMax));
  } else {
    url.searchParams.delete("min");
    url.searchParams.delete("max");
  }

  window.history.replaceState(null, "", url);
}

const loading = document.querySelector("#loading");
const errorBox = document.querySelector("#error");
const visualization = document.querySelector("#visualization");
const tooltip = d3.select("#tooltip");

let countyRows = [];
let countyByFips = new Map();
let countySelection;
let countyLayer;
let stateLayer;
let path;
let statesGeoJSON;
let availableYears = [];
let nationalPopulationByYear = new Map();
let populationChartLineSelection;
let populationChartKeySelection;

readURLState();
buildPopulationChartKey();
buildStateDropdown();
buildRegionDropdown();
wireStaticControls();
loadData();

async function loadData() {
  try {
    const [geoJSON, populationRows, ruccRows] = await Promise.all([
      d3.json(FILES.counties),
      d3.csv(FILES.population, parsePopulationRow),
      d3.csv(FILES.rucc)
    ]);

    const population = populationRows.filter(Boolean);
    const ruccLookup = buildRuccLookup(ruccRows);

    availableYears = Array.from(
      new Set(population.map(row => row.year))
    ).sort(d3.ascending);

    populateYearControls();

    nationalPopulationByYear = buildNationalPopulationByYear(population);
    drawPopulationChart();

    countyRows = buildCountyRecords(population, ruccLookup);
    countyByFips = new Map(countyRows.map(row => [row.fips, row]));

    drawMap(geoJSON);
    updateMap();

    loading.hidden = true;
    visualization.hidden = false;
  } catch (error) {
    console.error(error);
    loading.hidden = true;
    errorBox.hidden = false;
    errorBox.innerHTML = `
      <strong>The map could not load its data files.</strong><br>
      ${escapeHTML(error.message)}<br><br>
      Because the page imports CSV and GeoJSON files, open it through a local web
      server rather than double-clicking <code>index.html</code>. For example:
      <code>python3 -m http.server</code>
    `;
  }
}

function parsePopulationRow(row) {
  const ageGroup = Number(row.AGEGRP);
  const year = Number(row.YEAR);

  const yearLabel = YEAR_CODE_TO_LABEL[year];

  if (ageGroup !== 0 || !yearLabel) {
    return null;
  }

  const fips = String(row.STATE).padStart(2, "0") +
    String(row.COUNTY).padStart(3, "0");

  const values = {};

  for (const [groupKey, group] of Object.entries(GROUPS)) {
    values[groupKey] = d3.sum(group.fields, field => numeric(row[field]));
  }

  return {
    fips,
    stateFips: String(row.STATE).padStart(2, "0"),
    stateName: row.STNAME,
    countyName: row.CTYNAME,
    year: yearLabel,
    values
  };
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRuccLookup(rows) {
  const lookup = new Map();

  rows.forEach(row => {
    if (row.Attribute !== "RUCC_2023") {
      return;
    }

    const fips = String(row.FIPS).replace(/\.0$/, "").padStart(5, "0");
    const rucc = Number(row.Value);

    lookup.set(fips, {
      rucc,
      division: divisionFromRucc(rucc)
    });
  });

  return lookup;
}

function divisionFromRucc(rucc) {
  if (rucc >= 1 && rucc <= 3) return "urban";
  if (rucc >= 4 && rucc <= 6) return "suburban";
  if (rucc >= 7 && rucc <= 9) return "rural";
  return null;
}

function buildCountyRecords(populationRows, ruccLookup) {
  const grouped = d3.group(populationRows, row => row.fips);
  const records = [];

  grouped.forEach((rows, fips) => {
    const rowsByYear = new Map(rows.map(row => [row.year, row]));
    const referenceRow = rows[0];

    if (!referenceRow) {
      return;
    }

    const rucc = ruccLookup.get(fips) || {
      rucc: null,
      division: null
    };

    const values = {};

    Object.keys(GROUPS).forEach(groupKey => {
      values[groupKey] = {};

      rowsByYear.forEach((row, year) => {
        values[groupKey][year] = row.values[groupKey];
      });
    });

    records.push({
      fips,
      stateFips: referenceRow.stateFips,
      stateName: referenceRow.stateName,
      countyName: referenceRow.countyName,
      rucc: rucc.rucc,
      division: rucc.division,
      values
    });
  });

  return records;
}

function drawMap(geoJSON) {
  const svg = d3.select("#county-map");

  const includedFeatures = geoJSON.features.filter(feature => {
    const stateFips = String(feature.properties.STATEFP).padStart(2, "0");
    return stateFips !== "72";
  });

  const countiesGeoJSON = {
    type: "FeatureCollection",
    features: includedFeatures
  };

  statesGeoJSON = {
    type: "FeatureCollection",
    features: Array.from(
      d3.group(includedFeatures, feature =>
        String(feature.properties.STATEFP).padStart(2, "0")
      ),
      ([stateFips, features]) => ({
        type: "Feature",
        properties: {
          STATEFP: stateFips
        },
        geometry: mergeStateGeometry(features)
      })
    )
  };

  const projection = d3.geoAlbersUsa()
    .fitExtent([[8, 8], [967, 602]], countiesGeoJSON);

  path = d3.geoPath(projection);

  countyLayer = svg.append("g").attr("class", "county-layer");
  stateLayer = svg.append("g").attr("class", "state-layer");

  countySelection = countyLayer
    .selectAll("path")
    .data(includedFeatures)
    .join("path")
    .attr("class", "county")
    .attr("d", path)
    .on("mousemove", showTooltip)
    .on("mouseleave", hideTooltip);

  stateLayer
    .selectAll("path")
    .data(statesGeoJSON.features)
    .join("path")
    .attr("class", "state-outline")
    .attr("d", path);
}

function mergeStateGeometry(features) {
  const polygons = [];

  features.forEach(feature => {
    if (!feature.geometry) return;

    if (feature.geometry.type === "Polygon") {
      polygons.push(feature.geometry.coordinates);
    } else if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach(polygon => polygons.push(polygon));
    }
  });

  return {
    type: "MultiPolygon",
    coordinates: polygons
  };
}

function selectedPopulationValue(row, year) {
  if (!row) return null;

  const selectedGroups = appState.groups.length
    ? appState.groups
    : ["total"];

  const values = selectedGroups.map(groupKey =>
    row.values[groupKey]?.[year]
  );

  if (values.some(value => !Number.isFinite(value))) {
    return null;
  }

  return d3.sum(values);
}

function selectedPopulationLabel() {
  if (appState.groups.length === 1) {
    return GROUPS[appState.groups[0]].label;
  }

  return appState.groups
    .map(groupKey => GROUPS[groupKey].label)
    .join(" + ");
}

function valueForCounty(row) {
  if (!row) return null;

  const start = selectedPopulationValue(row, appState.startYear);
  const end = selectedPopulationValue(row, appState.endYear);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  const change = end - start;

  if (appState.metric === "count") {
    return change;
  }

  if (start === 0) {
    return null;
  }

  return (change / start) * 100;
}

function updateMap() {
  const eligibleRows = countyRows.filter(row =>
    appState.division === "all" ||
    row.division === appState.division
  );

  const values = eligibleRows
    .map(valueForCounty)
    .filter(Number.isFinite);

 const negativeValues = values
  .filter(value => value < 0)
  .map(Math.abs)
  .sort(d3.ascending);

const positiveValues = values
  .filter(value => value > 0)
  .sort(d3.ascending);

/*
  Independently cap losses and gains at the 90th percentile.
  This prevents a few extreme counties on either side from
  flattening the rest of the map.
*/
const negativeLimit =
  d3.quantile(negativeValues, 0.90) || 1;

const positiveLimit =
  d3.quantile(positiveValues, 0.90) || 1;

/*
  The square-root transform gives moderate county changes
  more visual separation while preserving direction.
*/
function colorValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return -Math.sqrt(
      Math.min(Math.abs(value), negativeLimit) / negativeLimit
    );
  }

  if (value > 0) {
    return Math.sqrt(
      Math.min(value, positiveLimit) / positiveLimit
    );
  }

  return 0;
}

const filterStep = appState.metric === "percent" ? 5 : 1000;
const trueExtent = d3.extent(values);
const filterDomainMin = Math.floor((trueExtent[0] || 0) / filterStep) * filterStep;
const filterDomainMax = Math.ceil((trueExtent[1] || 0) / filterStep) * filterStep;
const filterSignature = [
  appState.metric,
  appState.startYear,
  appState.endYear,
  [...appState.groups].sort().join(",")
].join("|");

if (appState.valueFilterSignature !== filterSignature) {
  appState.valueFilterSignature = filterSignature;

  const hasValidSavedRange =
    Number.isFinite(appState.valueFilterMin) &&
    Number.isFinite(appState.valueFilterMax) &&
    appState.valueFilterMin >= filterDomainMin &&
    appState.valueFilterMax <= filterDomainMax &&
    appState.valueFilterMin <= appState.valueFilterMax;

  if (!hasValidSavedRange) {
    appState.valueFilterMin = filterDomainMin;
    appState.valueFilterMax = filterDomainMax;
  }
}

const colorScale = d3.scaleDiverging()
  .domain([-1, 0, 1])
  .interpolator(
    d3.interpolateRgbBasis([
      "#FFCF01",
      "#ffffff",
      "#3995B2"
    ])
  )
  .clamp(true);
  countySelection
    .classed("is-filtered", feature => {
      const row = countyByFips.get(featureFips(feature));
      return !row ||
        (
          appState.division !== "all" &&
          row.division !== appState.division
        );
    })
    .classed("is-dimmed", feature => {
      const stateFips = featureStateFips(feature);

      if (appState.selectedState) {
        return stateFips !== appState.selectedState;
      }

      if (appState.selectedRegion) {
        return !REGION_STATE_FIPS[appState.selectedRegion].has(stateFips);
      }

      return false;
    })
    .classed("is-value-filtered", feature => {
      const row = countyByFips.get(featureFips(feature));
      const value = valueForCounty(row);

      return Number.isFinite(value) && (
        value < appState.valueFilterMin ||
        value > appState.valueFilterMax
      );
    })
    .attr("fill", feature => {
      const row = countyByFips.get(featureFips(feature));

      if (!row) return "#ededed";

      if (
        appState.division !== "all" &&
        row.division !== appState.division
      ) {
        return "#ededed";
      }
const value = valueForCounty(row);
const scaledValue = colorValue(value);

return scaledValue === null
  ? "#d9d9d9"
  : colorScale(scaledValue);
    });

const legendGradient = buildLegendGradient(
  filterDomainMin,
  filterDomainMax,
  colorValue,
  colorScale
);

updateLegend(filterDomainMin, filterDomainMax, filterStep, legendGradient);
  updatePopulationChartSelection();
  updateStateDropdown();
  updateRegionDropdown();
  updateStatus();
  updateCountyTable();
  updateURLState();
}

function buildLegendGradient(domainMin, domainMax, colorValue, colorScale) {
  const stopCount = 120;
  const span = domainMax - domainMin || 1;
  const stops = [];

  for (let index = 0; index <= stopCount; index += 1) {
    const position = index / stopCount;
    const rawValue = domainMin + position * span;
    const scaledValue = colorValue(rawValue);
    const color = scaledValue === null ? "#d9d9d9" : colorScale(scaledValue);
    stops.push(`${color} ${(position * 100).toFixed(3)}%`);
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function updateLegend(domainMin, domainMax, step, gradient) {
  const formatter = appState.metric === "percent"
    ? value => `${d3.format(".0f")(value)}%`
    : value => d3.format(",.0f")(value);

  const lowerInput = document.querySelector("#legend-lower");
  const upperInput = document.querySelector("#legend-upper");
  const gradientElement = document.querySelector("#legend-gradient");

  gradientElement.style.background = gradient;

  [lowerInput, upperInput].forEach(input => {
    input.min = domainMin;
    input.max = domainMax;
    input.step = step;
  });

  lowerInput.value = appState.valueFilterMin;
  upperInput.value = appState.valueFilterMax;

  document.querySelector("#legend-min").textContent = formatter(domainMin);
  document.querySelector("#legend-max").textContent =
    domainMax > 0 ? `+${formatter(domainMax)}` : formatter(domainMax);

  document.querySelector("#legend-lower-value").textContent =
    formatter(appState.valueFilterMin);
  document.querySelector("#legend-upper-value").textContent =
    appState.valueFilterMax > 0
      ? `+${formatter(appState.valueFilterMax)}`
      : formatter(appState.valueFilterMax);

  document.querySelector("#legend-label").textContent =
    `${selectedPopulationLabel()} · ` +
    `${appState.startYear}–${appState.endYear} · ` +
    (appState.metric === "count" ? "count change" : "percent change") +
    ` · filter in ${appState.metric === "count" ? "1,000-person" : "5-point"} increments`;
}

function updateLegendFilterFromInputs(changed) {
  const lowerInput = document.querySelector("#legend-lower");
  const upperInput = document.querySelector("#legend-upper");
  let lower = Number(lowerInput.value);
  let upper = Number(upperInput.value);

  if (lower > upper) {
    if (changed === "lower") lower = upper;
    else upper = lower;
  }

  appState.valueFilterMin = lower;
  appState.valueFilterMax = upper;
  updateMap();
}

function countyPassesActiveFilters(row) {
  if (!row) return false;

  const divisionMatch =
    appState.division === "all" ||
    row.division === appState.division;

  const stateMatch =
    !appState.selectedState ||
    row.stateFips === appState.selectedState;

  const regionMatch =
    !appState.selectedRegion ||
    REGION_STATE_FIPS[appState.selectedRegion].has(row.stateFips);

  const value = valueForCounty(row);
  const valueMatch =
    Number.isFinite(value) &&
    value >= appState.valueFilterMin &&
    value <= appState.valueFilterMax;

  return divisionMatch && stateMatch && regionMatch && valueMatch;
}

function updateCountyTable() {
  const body = document.querySelector("#county-table-body");
  const summary = document.querySelector("#county-table-summary");
  if (!body || !summary) return;

  const rows = countyRows
    .filter(countyPassesActiveFilters)
    .map(row => {
      const start = selectedPopulationValue(row, appState.startYear);
      const end = selectedPopulationValue(row, appState.endYear);
      const change = end - start;
      const percent = start === 0 ? null : (change / start) * 100;
      return { row, start, end, change, percent };
    })
    .sort((a, b) => {
      const valueDifference = valueForCounty(b.row) - valueForCounty(a.row);
      if (valueDifference !== 0) return valueDifference;
      return d3.ascending(a.row.countyName, b.row.countyName);
    });

  document.querySelector("#county-table-start-year").textContent = appState.startYear;
  document.querySelector("#county-table-end-year").textContent = appState.endYear;

  summary.textContent =
    `${d3.format(",")(rows.length)} counties · ${selectedPopulationLabel()}`;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7" class="county-table-empty">No counties match the current filters.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = rows.map(({ row, start, end, change, percent }) => {
    const divisionLabel = row.division ? capitalize(row.division) : "Unclassified";
    return `
      <tr>
        <td>${escapeHTML(row.countyName)}</td>
        <td>${escapeHTML(row.stateName)}</td>
        <td>${escapeHTML(divisionLabel)}</td>
        <td class="numeric">${d3.format(",")(start)}</td>
        <td class="numeric">${d3.format(",")(end)}</td>
        <td class="numeric">${signedInteger(change)}</td>
        <td class="numeric">${percent === null ? "N/A" : signedPercent(percent)}</td>
      </tr>
    `;
  }).join("");
}

function updateStatus() {
  const shownCount = countyRows.filter(countyPassesActiveFilters).length;

  let geographyLabel = "United States";

  if (appState.selectedState) {
    geographyLabel = STATE_NAMES[STATE_FIPS_TO_ABBR[appState.selectedState]];
  } else if (appState.selectedRegion) {
    geographyLabel = REGIONS[appState.selectedRegion].label;
  }

  document.querySelector("#status").textContent =
    `${d3.format(",")(shownCount)} counties shown · ${geographyLabel}`;
}

function showTooltip(event, feature) {
  const row = countyByFips.get(featureFips(feature));
  if (!row) return;

  if (
    (appState.selectedState && row.stateFips !== appState.selectedState) ||
    (
      appState.selectedRegion &&
      !REGION_STATE_FIPS[appState.selectedRegion].has(row.stateFips)
    )
  ) {
    hideTooltip();
    return;
  }

  const start = selectedPopulationValue(row, appState.startYear);
  const end = selectedPopulationValue(row, appState.endYear);

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return;
  }

  const change = end - start;
  const percent = start === 0
    ? null
    : (change / start) * 100;

  const divisionLabel = row.division
    ? capitalize(row.division)
    : "Unclassified";

  tooltip
    .style("opacity", 1)
    .attr("aria-hidden", "false")
    .html(`
      <strong>${escapeHTML(row.countyName)}, ${escapeHTML(row.stateName)}</strong><br>
      Selected race groups: ${escapeHTML(selectedPopulationLabel())}<br>
      ${appState.startYear}: ${d3.format(",")(start)}<br>
      ${appState.endYear}: ${d3.format(",")(end)}<br>
      Change: ${signedInteger(change)}<br>
      Percent: ${percent === null ? "N/A" : signedPercent(percent)}<br>
      County type: ${divisionLabel}
      ${row.rucc === null ? "" : ` (RUCC ${row.rucc})`}
    `);

  positionTooltip(event);
}

function positionTooltip(event) {
  const wrap = document.querySelector(".map-wrap");
  const tooltipNode = document.querySelector("#tooltip");
  const bounds = wrap.getBoundingClientRect();

  let left = event.clientX - bounds.left + 14;
  let top = event.clientY - bounds.top + 14;

  const tooltipWidth = tooltipNode.offsetWidth;
  const tooltipHeight = tooltipNode.offsetHeight;

  if (left + tooltipWidth > bounds.width) {
    left = event.clientX - bounds.left - tooltipWidth - 14;
  }

  if (top + tooltipHeight > bounds.height) {
    top = event.clientY - bounds.top - tooltipHeight - 14;
  }

  tooltip
    .style("left", `${Math.max(0, left)}px`)
    .style("top", `${Math.max(0, top)}px`);
}

function hideTooltip() {
  tooltip
    .style("opacity", 0)
    .attr("aria-hidden", "true");
}

function selectState(stateFips) {
  appState.selectedState = stateFips;

  if (stateFips) {
    appState.selectedRegion = null;
  }

  zoomToStateFips(stateFips ? [stateFips] : []);
  updateMap();
}

function selectRegion(regionKey) {
  appState.selectedRegion = regionKey;

  if (regionKey) {
    appState.selectedState = null;
  }

  const stateFipsList = regionKey
    ? Array.from(REGION_STATE_FIPS[regionKey])
    : [];

  zoomToStateFips(stateFipsList);
  updateMap();
}

function zoomToStateFips(stateFipsList) {
  if (!stateFipsList.length) {
    countyLayer
      .transition()
      .duration(550)
      .attr("transform", null);

    stateLayer
      .transition()
      .duration(550)
      .attr("transform", null);

    return;
  }

  const selectedFeatures = statesGeoJSON.features.filter(feature =>
    stateFipsList.includes(
      String(feature.properties.STATEFP).padStart(2, "0")
    )
  );

  if (!selectedFeatures.length) return;

  const featureCollection = {
    type: "FeatureCollection",
    features: selectedFeatures
  };

  const [[x0, y0], [x1, y1]] = path.bounds(featureCollection);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const x = (x0 + x1) / 2;
  const y = (y0 + y1) / 2;

  const scale = Math.max(
    1,
    Math.min(8, 0.82 / Math.max(dx / 975, dy / 610))
  );

  const transform =
    `translate(${975 / 2},${610 / 2}) ` +
    `scale(${scale}) ` +
    `translate(${-x},${-y})`;

  countyLayer
    .transition()
    .duration(650)
    .attr("transform", transform);

  stateLayer
    .transition()
    .duration(650)
    .attr("transform", transform);
}

function buildNationalPopulationByYear(populationRows) {
  const totals = new Map();

  availableYears.forEach(year => {
    const yearRows = populationRows.filter(row => row.year === year);
    const values = {};

    Object.keys(GROUPS).forEach(groupKey => {
      values[groupKey] = d3.sum(
        yearRows,
        row => row.values[groupKey]
      );
    });

    totals.set(year, values);
  });

  return totals;
}

function populationPercentChange(groupKey, year) {
  const baselineYear = availableYears[0];
  const baseline = nationalPopulationByYear.get(baselineYear)?.[groupKey];
  const value = nationalPopulationByYear.get(year)?.[groupKey];

  if (
    !Number.isFinite(baseline) ||
    !Number.isFinite(value) ||
    baseline === 0
  ) {
    return null;
  }

  return ((value - baseline) / baseline) * 100;
}

function buildPopulationChartKey() {
  const key = d3.select("#population-chart-key");

  Object.entries(GROUPS).forEach(([groupKey, group]) => {
    const label = key
      .append("label")
      .attr("class", "population-chart-key-option")
      .style("--line-color", GROUP_COLORS[groupKey]);

    label
      .append("input")
      .attr("type", "checkbox")
      .attr("value", groupKey)
      .property("checked", appState.groups.includes(groupKey))
      .on("change", function() {
        selectPopulationGroup(groupKey, this.checked);
      });

    label
      .append("span")
      .attr("class", "population-chart-key-label")
      .text(group.label);
  });

  populationChartKeySelection = key.selectAll("input");
}

function drawPopulationChart() {
  const svg = d3.select("#population-chart");
  svg.selectAll("*").remove();

  const width = 280;
  const height = 210;
  const margin = {
    top: 10,
    right: 12,
    bottom: 28,
    left: 38
  };

  const series = Object.keys(GROUPS).map(groupKey => ({
    groupKey,
    values: availableYears.map(year => ({
      year,
      value: populationPercentChange(groupKey, year)
    }))
  }));

  const allValues = series
    .flatMap(group => group.values.map(point => point.value))
    .filter(Number.isFinite);

  const yExtent = d3.extent(allValues);
  const yPadding = Math.max(
    0.5,
    ((yExtent[1] || 0) - (yExtent[0] || 0)) * 0.12
  );

  const x = d3.scalePoint()
    .domain(availableYears)
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([
      Math.min(0, (yExtent[0] || 0) - yPadding),
      Math.max(0, (yExtent[1] || 0) + yPadding)
    ])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const line = d3.line()
    .defined(point => Number.isFinite(point.value))
    .x(point => x(point.year))
    .y(point => y(point.value));

  svg.append("g")
    .attr("class", "population-chart-grid")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickSize(-(width - margin.left - margin.right))
        .tickFormat("")
    );

  svg.append("g")
    .attr("class", "population-chart-axis")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .tickFormat(d3.format("d"))
    );

  svg.append("g")
    .attr("class", "population-chart-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(value => `${d3.format(".1f")(value)}%`)
    );

  const zeroY = y(0);

  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", zeroY)
    .attr("y2", zeroY)
    .attr("stroke", "#777")
    .attr("stroke-width", 0.8);

  populationChartLineSelection = svg.append("g")
    .selectAll("path")
    .data(series)
    .join("path")
    .attr("class", "population-line")
    .attr("data-group", group => group.groupKey)
    .attr("stroke", group => GROUP_COLORS[group.groupKey])
    .attr("d", group => line(group.values))
    .on("click", (_, group) => togglePopulationGroup(group.groupKey))
    .on("mousemove", showPopulationChartTooltip)
    .on("mouseleave", hidePopulationChartTooltip);

  svg.append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .each(function(group) {
      d3.select(this)
        .selectAll("circle")
        .data(group.values.filter(point => Number.isFinite(point.value)))
        .join("circle")
        .attr("class", "population-chart-dot")
        .attr("cx", point => x(point.year))
        .attr("cy", point => y(point.value))
        .attr("r", 1.8)
        .attr("fill", GROUP_COLORS[group.groupKey]);
    });

  updatePopulationChartSelection();
}

function togglePopulationGroup(groupKey) {
  const isSelected = appState.groups.includes(groupKey);
  selectPopulationGroup(groupKey, !isSelected);
}

function selectPopulationGroup(groupKey, checked) {
  if (groupKey === "total") {
    if (checked) {
      appState.groups = ["total"];
    } else if (appState.groups.length === 1) {
      return;
    }
  } else if (checked) {
    appState.groups = appState.groups
      .filter(key => key !== "total");

    if (!appState.groups.includes(groupKey)) {
      appState.groups.push(groupKey);
    }
  } else {
    appState.groups = appState.groups
      .filter(key => key !== groupKey);

    if (!appState.groups.length) {
      appState.groups = ["total"];
    }
  }

  updatePopulationChartSelection();
  hidePopulationChartTooltip();
  hideTooltip();
  updateMap();
}

function updatePopulationChartSelection() {
  if (populationChartLineSelection) {
    populationChartLineSelection
      .classed("is-active", group =>
        appState.groups.includes(group.groupKey)
      )
      .classed("is-faded", group =>
        !appState.groups.includes(group.groupKey)
      );
  }

  if (populationChartKeySelection) {
    populationChartKeySelection
      .property("checked", function() {
        return appState.groups.includes(this.value);
      });
  }
}

function showPopulationChartTooltip(event, group) {
  const chartWrap = document.querySelector(".population-chart-wrap");
  const chartTooltip = d3.select("#population-chart-tooltip");
  const bounds = chartWrap.getBoundingClientRect();

  const values = group.values
    .map(point =>
      `${point.year}: ${
        Number.isFinite(point.value)
          ? signedPercent(point.value)
          : "N/A"
      }`
    )
    .join("<br>");

  chartTooltip
    .style("opacity", 1)
    .attr("aria-hidden", "false")
    .html(`
      <strong>${escapeHTML(GROUPS[group.groupKey].label)}</strong><br>
      Percent change from ${availableYears[0]}<br>
      ${values}
    `);

  const tooltipNode = document.querySelector("#population-chart-tooltip");
  let left = event.clientX - bounds.left + 10;
  let top = event.clientY - bounds.top + 10;

  if (left + tooltipNode.offsetWidth > bounds.width) {
    left = event.clientX - bounds.left - tooltipNode.offsetWidth - 10;
  }

  if (top + tooltipNode.offsetHeight > bounds.height) {
    top = event.clientY - bounds.top - tooltipNode.offsetHeight - 10;
  }

  chartTooltip
    .style("left", `${Math.max(0, left)}px`)
    .style("top", `${Math.max(0, top)}px`);
}

function hidePopulationChartTooltip() {
  d3.select("#population-chart-tooltip")
    .style("opacity", 0)
    .attr("aria-hidden", "true");
}

function populateYearControls() {
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");

  startSelect.innerHTML = "";
  endSelect.innerHTML = "";

  availableYears.forEach(year => {
    startSelect.add(new Option(year, year));
    endSelect.add(new Option(year, year));
  });

  if (!availableYears.includes(appState.startYear)) {
    appState.startYear = availableYears.includes(2020)
      ? 2020
      : availableYears[0];
  }

  if (!availableYears.includes(appState.endYear)) {
    appState.endYear = availableYears.includes(2025)
      ? 2025
      : availableYears[availableYears.length - 1];
  }

  if (appState.startYear >= appState.endYear) {
    appState.startYear = availableYears[0];
    appState.endYear = availableYears[availableYears.length - 1];
  }

  startSelect.value = appState.startYear;
  endSelect.value = appState.endYear;

  updateYearOptions();
  updateYearTitle();
}

function updateYearOptions() {
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");

  Array.from(startSelect.options).forEach(option => {
    option.disabled = Number(option.value) >= appState.endYear;
  });

  Array.from(endSelect.options).forEach(option => {
    option.disabled = Number(option.value) <= appState.startYear;
  });
}

function updateYearTitle() {
  const title = document.querySelector(".map-header h1");

  if (title) {
    title.textContent =
      `County population change, ${appState.startYear}–${appState.endYear}`;
  }
}

function wireYearControls() {
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");

  startSelect.addEventListener("change", () => {
    appState.startYear = Number(startSelect.value);
    updateYearOptions();
    updateYearTitle();
    hideTooltip();
    updateMap();
  });

  endSelect.addEventListener("change", () => {
    appState.endYear = Number(endSelect.value);
    updateYearOptions();
    updateYearTitle();
    hideTooltip();
    updateMap();
  });
}

function buildStateDropdown() {
  const select = document.querySelector("#state-select");

  const states = Object.entries(STATE_FIPS_TO_ABBR)
    .map(([fips, abbreviation]) => ({
      fips,
      abbreviation
    }))
    .sort((a, b) => d3.ascending(
      STATE_NAMES[a.abbreviation],
      STATE_NAMES[b.abbreviation]
    ));

  states.forEach(state => {
    select.add(new Option(STATE_NAMES[state.abbreviation], state.fips));
  });
}

function updateStateDropdown() {
  const select = document.querySelector("#state-select");

  if (select) {
    select.value = appState.selectedState || "";
  }
}

function buildRegionDropdown() {
  const select = document.querySelector("#region-select");

  Object.entries(REGIONS).forEach(([regionKey, region]) => {
    select.add(new Option(region.label, regionKey));
  });
}

function updateRegionDropdown() {
  const select = document.querySelector("#region-select");

  if (select) {
    select.value = appState.selectedRegion || "";
  }
}

function wireStaticControls() {
  d3.selectAll("#division-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.division; });
  d3.selectAll("#metric-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.metric; });

  wireButtonGroup("#division-controls button", "division");
  wireButtonGroup("#metric-controls button", "metric");
  wireYearControls();

  document.querySelector("#legend-lower")
    .addEventListener("input", () => updateLegendFilterFromInputs("lower"));

  document.querySelector("#legend-upper")
    .addEventListener("input", () => updateLegendFilterFromInputs("upper"));

  document.querySelector("#state-select")
    .addEventListener("change", event => {
      selectState(event.target.value || null);
    });

  document.querySelector("#region-select")
    .addEventListener("change", event => {
      selectRegion(event.target.value || null);
    });
}

function wireButtonGroup(selector, stateKey) {
  d3.selectAll(selector).on("click", function () {
    appState[stateKey] = this.dataset.value;

    d3.selectAll(selector).classed("is-active", false);
    d3.select(this).classed("is-active", true);

    updateMap();
  });
}

window.addEventListener("popstate", () => {
  appState.division = "all";
  appState.groups = ["total"];
  appState.metric = "count";
  appState.startYear = 2020;
  appState.endYear = 2025;
  appState.selectedState = null;
  appState.selectedRegion = null;
  appState.valueFilterMin = null;
  appState.valueFilterMax = null;
  appState.valueFilterSignature = null;
  readURLState();

  if (!availableYears.length || !countyLayer || !stateLayer) return;

  populateYearControls();
  d3.selectAll("#division-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.division; });
  d3.selectAll("#metric-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.metric; });
  updatePopulationChartSelection();

  const stateFipsList = appState.selectedState
    ? [appState.selectedState]
    : appState.selectedRegion
      ? Array.from(REGION_STATE_FIPS[appState.selectedRegion])
      : [];
  zoomToStateFips(stateFipsList);
  updateMap();
});

function featureFips(feature) {
  return String(feature.properties.GEOID).padStart(5, "0");
}

function featureStateFips(feature) {
  return String(feature.properties.STATEFP).padStart(2, "0");
}

function signedInteger(value) {
  const formatted = d3.format(",.0f")(value);
  return value > 0 ? `+${formatted}` : formatted;
}

function signedPercent(value) {
  const formatted = `${d3.format(".1f")(value)}%`;
  return value > 0 ? `+${formatted}` : formatted;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
