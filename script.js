const FILES = {
  population: "data/Vintage 2025 counties race & ethnicity 1.csv",
  urbanRural: "cdc_urban_rural.csv",
  counties: "data/counties_2025_s.geojson",
  states: "states.geojson"
};

/*
  CDC/NCHS 2023 urban-rural classification codes, in order from most
  urban (1) to most rural (6). Used directly as the county "type"
  instead of collapsing them into an urban/suburban/rural bucket.
*/
const URBAN_RURAL_CODE_TO_SLUG = {
  1: "large_central_metro",
  2: "large_fringe_metro",
  3: "medium_metro",
  4: "small_metro",
  5: "micropolitan",
  6: "noncore"
};

const URBAN_RURAL_SLUG_TO_LABEL = {
  large_central_metro: "large central metro counties",
  large_fringe_metro: "large fringe metro counties",
  medium_metro: "medium metro counties",
  small_metro: "small metro counties",
  micropolitan: "micropolitan counties",
  noncore: "noncore counties"
};

/*
  Plain labels (no county counts) for the sentence's closed-select display.
  The <select> itself keeps count-suffixed option text for the open
  dropdown list; these back the overlay span shown when it's collapsed.
*/
const SIGN_FILTER_LABELS = {
  all: "increases and decreases",
  positive: "increase only",
  negative: "decrease only"
};

const TYPE_FILTER_LABELS = {
  all: "all county types",
  ...URBAN_RURAL_SLUG_TO_LABEL
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
    label: "total population",
    fields: ["TotalPopulation"]
  },
  white: {
    label: "White, non-Hispanic, population",
    fields: ["White Male", "White Female"]
  },
  black: {
    label: "Black, non-Hispanic, population",
    fields: ["Black Male", "Black Female"]
  },
  latino: {
    label: "Latino population",
    fields: ["Latino Male", "Latino Female"]
  },
  asian: {
    label: "Asian, non-Hispanic, population",
    fields: ["Asian Male", "Asian Female"]
  },
  native: {
    label: "American Indian/Alaska Native, non-Hispanic, population",
    fields: [
      "Indian/Alaska  American Male",
      "Indian/Alaska Native Female"
    ]
  },
  pacific: {
    label: "Native Hawaiian/Pacific Islander, non-Hispanic, population",
    fields: [
      "Hawaiian/Pacific Islander Male",
      "Hawaiian/Pacific Islander Female"
    ]
  }
};

const GROUP_LABELS = Object.fromEntries(
  Object.entries(GROUPS).map(([groupKey, group]) => [groupKey, group.label])
);

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
  highlightedCountyFips: null,
  tableSort: null,
  signFilter: "all"
};

let requestedCountyFips = null;

function readURLState() {
  const params = new URLSearchParams(window.location.search);
  const groups = (params.get("groups") || params.get("group") || "")
    .split(",")
    .filter(groupKey => GROUPS[groupKey]);
  const division = params.get("division");
  const metric = params.get("metric");
  const signFilter = params.get("sign");
  const startYear = Number(params.get("start"));
  const endYear = Number(params.get("end"));
  const selectedState = params.get("state");
  const selectedRegion = params.get("region");
  const county = params.get("county");

  if (groups.length) appState.groups = groups.includes("total") ? ["total"] : groups;
  if (division === "all" || Object.values(URBAN_RURAL_CODE_TO_SLUG).includes(division)) {
    appState.division = division;
  }
  if (["count", "percent"].includes(metric)) appState.metric = metric;
  if (["all", "positive", "negative"].includes(signFilter)) appState.signFilter = signFilter;
  if (Number.isInteger(startYear) && startYear > 0) appState.startYear = startYear;
  if (Number.isInteger(endYear) && endYear > 0) appState.endYear = endYear;

  if (selectedState && STATE_FIPS_TO_ABBR[selectedState]) {
    appState.selectedState = selectedState;
    appState.selectedRegion = null;
  } else if (selectedRegion && REGIONS[selectedRegion]) {
    appState.selectedRegion = selectedRegion;
    appState.selectedState = null;
  }

  requestedCountyFips = county || null;

  if (county && countyByFips.has(county)) {
    appState.highlightedCountyFips = county;
  }
}

function updateURLState() {
  const url = new URL(window.location.href);
  url.searchParams.set("groups", appState.groups.join(","));
  url.searchParams.set("division", appState.division);
  url.searchParams.set("metric", appState.metric);
  url.searchParams.set("sign", appState.signFilter);
  url.searchParams.set("start", String(appState.startYear));
  url.searchParams.set("end", String(appState.endYear));

  if (appState.selectedState) url.searchParams.set("state", appState.selectedState);
  else url.searchParams.delete("state");

  if (appState.selectedRegion) url.searchParams.set("region", appState.selectedRegion);
  else url.searchParams.delete("region");

  if (appState.highlightedCountyFips) url.searchParams.set("county", appState.highlightedCountyFips);
  else url.searchParams.delete("county");

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
let highlightLayer;
let featuresByFips = new Map();
let path;
let statesGeoJSON;
let availableYears = [];
let countySearchIndex = [];
let countySearchResults = [];
let countySearchActiveIndex = -1;

readURLState();
buildGroupDropdown();
buildStateDropdown();
buildRegionDropdown();
wireStaticControls();
wireCountySearch();
wireCountyTableSorting();
loadData();

async function loadData() {
  try {
    const [geoJSON, statesGeoJSONData, populationRows, urbanRuralRows] = await Promise.all([
      d3.json(FILES.counties),
      d3.json(FILES.states),
      d3.csv(FILES.population, parsePopulationRow),
      d3.csv(FILES.urbanRural)
    ]);

    const population = populationRows.filter(Boolean);
    const urbanRuralLookup = buildUrbanRuralLookup(urbanRuralRows);

    availableYears = Array.from(
      new Set(population.map(row => row.year))
    ).sort(d3.ascending);

    populateYearControls();

    countyRows = buildCountyRecords(population, urbanRuralLookup);
    countyByFips = new Map(countyRows.map(row => [row.fips, row]));
    buildCountySearchIndex();

    drawMap(geoJSON, statesGeoJSONData);

    if (requestedCountyFips && countyByFips.has(requestedCountyFips)) {
      appState.highlightedCountyFips = requestedCountyFips;
      const row = countyByFips.get(requestedCountyFips);
      document.querySelector("#county-search-input").value =
        `${row.countyName}, ${row.stateName}`;
      appState.selectedState = row.stateFips;
      appState.selectedRegion = null;
      zoomToStateFips([row.stateFips]);
    }

    updateMap();
    updateStateDropdown();
    updateRegionDropdown();

    const searchInput = document.querySelector("#county-search-input");
    searchInput.disabled = false;

    if (appState.highlightedCountyFips) {
      document.querySelector("#county-search-clear").hidden = false;
    }

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

function buildUrbanRuralLookup(rows) {
  const lookup = new Map();

  rows.forEach(row => {
    const fips = String(row.Location).padStart(5, "0");
    const [codeText, ...labelParts] = String(row["2023 Code"] || "").split(" - ");
    const code = Number(codeText);
    const hasCode = Number.isFinite(code) && URBAN_RURAL_CODE_TO_SLUG[code];

    lookup.set(fips, {
      code: hasCode ? code : null,
      division: hasCode ? URBAN_RURAL_CODE_TO_SLUG[code] : null,
      description: labelParts.length ? labelParts.join(" - ") : null
    });
  });

  return lookup;
}

function buildCountyRecords(populationRows, urbanRuralLookup) {
  const grouped = d3.group(populationRows, row => row.fips);
  const records = [];

  grouped.forEach((rows, fips) => {
    const rowsByYear = new Map(rows.map(row => [row.year, row]));
    const referenceRow = rows[0];

    if (!referenceRow) {
      return;
    }

    const urbanRural = urbanRuralLookup.get(fips) || {
      code: null,
      division: null,
      description: null
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
      code: urbanRural.code,
      division: urbanRural.division,
      description: urbanRural.description,
      values
    });
  });

  return records;
}

function drawMap(geoJSON, statesGeoJSONData) {
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
    features: statesGeoJSONData.features.filter(feature =>
      String(feature.properties.STATEFP).padStart(2, "0") !== "72"
    )
  };

  const projection = d3.geoAlbersUsa()
    .fitExtent([[8, 8], [967, 602]], countiesGeoJSON);

  path = d3.geoPath(projection);

  featuresByFips = new Map(includedFeatures.map(feature => [featureFips(feature), feature]));

  countyLayer = svg.append("g").attr("class", "county-layer");
  stateLayer = svg.append("g").attr("class", "state-layer");
  highlightLayer = svg.append("g").attr("class", "highlight-layer");

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

function matchesSignFilter(value) {
  if (appState.signFilter === "positive") return value > 0;
  if (appState.signFilter === "negative") return value < 0;
  return true;
}

function updateSignFilterOptions(geographyRows) {
  const select = document.querySelector("#sign-filter");
  if (!select) return;

  const values = geographyRows.map(valueForCounty);
  const format = d3.format(",");

  const counts = {
    all: values.filter(Number.isFinite).length,
    positive: values.filter(value => value > 0).length,
    negative: values.filter(value => value < 0).length
  };

  Object.entries(counts).forEach(([key, count]) => {
    const option = select.querySelector(`option[value="${key}"]`);
    if (option) {
      option.textContent = key === "all"
        ? SIGN_FILTER_LABELS[key]
        : `${SIGN_FILTER_LABELS[key]} (${format(count)} counties)`;
    }
  });

  syncInlineSelectDisplay(select, "sign-filter-display", SIGN_FILTER_LABELS);
}

function updateTypeFilterOptions(regionRows) {
  const select = document.querySelector("#type-filter");
  if (!select) return;

  const format = d3.format(",");

  const allOption = select.querySelector(`option[value="all"]`);
  if (allOption) {
    allOption.textContent = "all county types";
  }

  Object.keys(URBAN_RURAL_SLUG_TO_LABEL).forEach(slug => {
    const option = select.querySelector(`option[value="${slug}"]`);
    if (!option) return;

    const count = regionRows.filter(row => row.division === slug).length;
    option.textContent = `${URBAN_RURAL_SLUG_TO_LABEL[slug]} (${format(count)})`;
  });

  syncInlineSelectDisplay(select, "type-filter-display", TYPE_FILTER_LABELS);
}

function syncInlineSelectDisplay(select, displayId, labels) {
  const display = document.querySelector(`#${displayId}`);
  if (display) display.textContent = labels[select.value] || select.value;
}

function updateMap() {
  updateMapTitle();

  const regionRows = countyRows.filter(row =>
    (!appState.selectedState || row.stateFips === appState.selectedState) &&
    (
      !appState.selectedRegion ||
      REGION_STATE_FIPS[appState.selectedRegion].has(row.stateFips)
    )
  );

  updateTypeFilterOptions(regionRows);

  const geographyRows = regionRows.filter(row =>
    appState.division === "all" || row.division === appState.division
  );

  updateSignFilterOptions(geographyRows);

  const eligibleRows = geographyRows.filter(row =>
    matchesSignFilter(valueForCounty(row))
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
  Cap losses and gains at the true max within the currently selected
  geography/division, so the ramp always uses its full range: the
  most extreme county on each side always reads as the darkest color.
*/
const negativeLimit = d3.max(negativeValues) || 1;

const positiveLimit = d3.max(positiveValues) || 1;

/*
  Ratio of value to the current max on its side, raised to a power (1 =
  plain linear; >1 would compress modest changes toward grey and reserve
  full saturation for only the most extreme counties, as tried earlier).
*/
const COLOR_CURVE_EXPONENT = 1;

/*
  Percent changes under this threshold (in either direction) render as
  flat grey rather than a barely-there sliver of color, since a change
  that small isn't meaningfully different from no change. Only applies
  to the percent metric — count changes have no equivalent unit to bound
  a "negligible" threshold against.
*/
const NEGLIGIBLE_PERCENT_THRESHOLD = 0.5;

function colorValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (appState.metric === "percent" && Math.abs(value) < NEGLIGIBLE_PERCENT_THRESHOLD) {
    return 0;
  }

  if (value < 0) {
    return -((Math.min(Math.abs(value), negativeLimit) / negativeLimit) ** COLOR_CURVE_EXPONENT);
  }

  if (value > 0) {
    return (Math.min(value, positiveLimit) / positiveLimit) ** COLOR_CURVE_EXPONENT;
  }

  return 0;
}

const filterStep = appState.metric === "percent" ? 5 : 1000;
const trueExtent = d3.extent(values);
const filterDomainMin = Math.floor((trueExtent[0] || 0) / filterStep) * filterStep;
const filterDomainMax = Math.ceil((trueExtent[1] || 0) / filterStep) * filterStep;

/*
  Negative and positive sides are interpolated independently (rather than
  through one continuous diverging scale) so that "approaching zero" never
  fades past the tint floor below. Only the exact zero value renders
  lighter than that, via the flat overrides below and in the legend's
  zero band.
*/
const NEGATIVE_COLOR_FULL = "#E8531C";
const POSITIVE_COLOR_FULL = "#711471";
const NEGATIVE_TINT_FLOOR_MIX = 0.97;
const POSITIVE_TINT_FLOOR_MIX = 0.9;
const NEGATIVE_COLOR_TINT = d3.interpolateRgb(NEGATIVE_COLOR_FULL, LEGEND_ZERO_COLOR)(NEGATIVE_TINT_FLOOR_MIX);
const POSITIVE_COLOR_TINT = d3.interpolateRgb(POSITIVE_COLOR_FULL, LEGEND_ZERO_COLOR)(POSITIVE_TINT_FLOOR_MIX);
const negativeColorRamp = d3.interpolateRgb(NEGATIVE_COLOR_TINT, NEGATIVE_COLOR_FULL);
const positiveColorRamp = d3.interpolateRgb(POSITIVE_COLOR_TINT, POSITIVE_COLOR_FULL);

/*
  Smooth continuous ramp: each side interpolates directly from its tint
  (which meets at LEGEND_ZERO_COLOR) to its full saturated color. Since
  both ramps converge on the same grey at zero, the transition across the
  middle reads as one continuous fade rather than needing a hard band.
*/
function colorScale(scaledValue) {
  if (scaledValue < 0) {
    return negativeColorRamp(Math.min(1, -scaledValue));
  }
  if (scaledValue > 0) {
    return positiveColorRamp(Math.min(1, scaledValue));
  }
  return LEGEND_ZERO_COLOR;
}
  countySelection
    .classed("is-filtered", feature => {
      const row = countyByFips.get(featureFips(feature));
      return !row ||
        (
          appState.division !== "all" &&
          row.division !== appState.division
        ) ||
        !matchesSignFilter(valueForCounty(row));
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
    .attr("fill", feature => {
      const row = countyByFips.get(featureFips(feature));

      if (!row) return "#ededed";

      if (
        appState.division !== "all" &&
        row.division !== appState.division
      ) {
        return "#ededed";
      }

      if (!matchesSignFilter(valueForCounty(row))) {
        return "#ededed";
      }
const value = valueForCounty(row);
const scaledValue = colorValue(value);

if (scaledValue === null) return "#d9d9d9";
return colorScale(scaledValue);
    });

const highlightedFeature = appState.highlightedCountyFips
  ? featuresByFips.get(appState.highlightedCountyFips)
  : null;

highlightLayer
  .selectAll("path")
  .data(highlightedFeature ? [highlightedFeature] : [])
  .join("path")
  .attr("class", "county-highlight-outline")
  .attr("d", path);

const legendGradient = buildLegendGradient(filterDomainMin, filterDomainMax, colorValue, colorScale);

updateLegend(filterDomainMin, filterDomainMax, legendGradient);
  updateStateDropdown();
  updateRegionDropdown();
  updateStatus();
  updateCountyTable();
  updateURLState();
}

const LEGEND_WIDTH_PX = 240;
const LEGEND_ZERO_COLOR = "#EBEAE9";

/*
  Samples colorValue/colorScale continuously across the domain, so the
  legend is a smooth fade matching the map's ramp exactly (both sides
  converge on LEGEND_ZERO_COLOR at zero, so no artificial band is needed
  to mark the crossing).
*/
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

function updateLegend(domainMin, domainMax, gradient) {
  const formatter = appState.metric === "percent"
    ? value => `${d3.format(".0f")(value)}%`
    : value => d3.format(",.0f")(value);

  const gradientElement = document.querySelector("#legend-gradient");

  gradientElement.style.background = gradient;

  document.querySelector("#legend-min").textContent = formatter(domainMin);
  document.querySelector("#legend-max").textContent =
    domainMax > 0 ? `+${formatter(domainMax)}` : formatter(domainMax);

  const span = (domainMax - domainMin) || 1;
  const zeroFraction = Math.min(1, Math.max(0, (0 - domainMin) / span));
  document.querySelector("#legend-zero-label").style.left = `${zeroFraction * 100}%`;

  document.querySelector("#legend-label").textContent =
    `${selectedPopulationLabel()} · ` +
    `${appState.startYear}–${appState.endYear} · ` +
    (appState.metric === "count" ? "count change" : "percent change");
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

  return (
    divisionMatch &&
    stateMatch &&
    regionMatch &&
    Number.isFinite(value) &&
    matchesSignFilter(value)
  );
}

const COUNTY_TABLE_COLUMNS = {
  county: {
    type: "string",
    accessor: d => d.row.countyName
  },
  state: {
    type: "string",
    accessor: d => d.row.stateName
  },
  type: {
    type: "string",
    accessor: d => d.row.description || (d.row.division ? capitalize(d.row.division) : "Unclassified")
  },
  start: {
    type: "number",
    accessor: d => d.start
  },
  end: {
    type: "number",
    accessor: d => d.end
  },
  change: {
    type: "number",
    accessor: d => d.change
  },
  percent: {
    type: "number",
    accessor: d => d.percent
  }
};

function compareCountyTableRows(a, b, column, direction) {
  const config = COUNTY_TABLE_COLUMNS[column];
  const aValue = config.accessor(a);
  const bValue = config.accessor(b);

  const aMissing = config.type === "number" ? !Number.isFinite(aValue) : (aValue === null || aValue === undefined);
  const bMissing = config.type === "number" ? !Number.isFinite(bValue) : (bValue === null || bValue === undefined);

  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  const comparison = d3.ascending(aValue, bValue);
  return direction === "desc" ? -comparison : comparison;
}

function sortCountyTableRows(rows) {
  if (appState.tableSort) {
    const { column, direction } = appState.tableSort;

    return rows.sort((a, b) => {
      const comparison = compareCountyTableRows(a, b, column, direction);
      if (comparison !== 0) return comparison;
      return d3.ascending(a.row.countyName, b.row.countyName);
    });
  }

  return rows.sort((a, b) => {
    const valueDifference = valueForCounty(b.row) - valueForCounty(a.row);
    if (valueDifference !== 0) return valueDifference;
    return d3.ascending(a.row.countyName, b.row.countyName);
  });
}

function handleCountyTableSortClick(column) {
  if (appState.tableSort && appState.tableSort.column === column) {
    appState.tableSort = {
      column,
      direction: appState.tableSort.direction === "asc" ? "desc" : "asc"
    };
  } else {
    appState.tableSort = {
      column,
      direction: COUNTY_TABLE_COLUMNS[column].type === "number" ? "desc" : "asc"
    };
  }

  updateCountyTable();
}

function updateCountyTableSortIndicators() {
  document.querySelectorAll("#county-table thead .sort-button").forEach(button => {
    const column = button.dataset.sortKey;
    const arrow = button.querySelector(".sort-arrow");
    const th = button.closest("th");
    const isActive = appState.tableSort && appState.tableSort.column === column;

    if (isActive) {
      const direction = appState.tableSort.direction;
      arrow.textContent = direction === "asc" ? "▲" : "▼";
      th.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
    } else {
      arrow.textContent = "";
      th.setAttribute("aria-sort", "none");
    }
  });
}

function wireCountyTableSorting() {
  document.querySelectorAll("#county-table thead .sort-button").forEach(button => {
    button.addEventListener("click", () => {
      handleCountyTableSortClick(button.dataset.sortKey);
    });
  });
}

function updateCountyTable() {
  const body = document.querySelector("#county-table-body");
  const summary = document.querySelector("#county-table-summary");
  if (!body || !summary) return;

  const rows = sortCountyTableRows(
    countyRows
      .filter(countyPassesActiveFilters)
      .map(row => {
        const start = selectedPopulationValue(row, appState.startYear);
        const end = selectedPopulationValue(row, appState.endYear);
        const change = end - start;
        const percent = start === 0 ? null : (change / start) * 100;
        return { row, start, end, change, percent };
      })
  );

  updateCountyTableSortIndicators();

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
    const divisionLabel = row.description || (row.division ? capitalize(row.division.replace(/_/g, " ")) : "Unclassified");
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

  const divisionLabel = row.description || (row.division ? capitalize(row.division) : "Unclassified");

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
      County type: ${escapeHTML(divisionLabel)}
      ${row.code === null ? "" : ` (code ${row.code})`}
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

    highlightLayer
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

  highlightLayer
    .transition()
    .duration(650)
    .attr("transform", transform);
}

function buildCountySearchIndex() {
  countySearchIndex = countyRows
    .map(row => ({
      fips: row.fips,
      stateFips: row.stateFips,
      countyName: row.countyName,
      stateName: row.stateName,
      label: `${row.countyName}, ${row.stateName}`
    }))
    .sort((a, b) => d3.ascending(a.countyName, b.countyName));
}

function searchCounties(query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) return [];

  return countySearchIndex
    .filter(entry => entry.label.toLowerCase().includes(normalized))
    .sort((a, b) => {
      const aStarts = a.countyName.toLowerCase().startsWith(normalized) ? 0 : 1;
      const bStarts = b.countyName.toLowerCase().startsWith(normalized) ? 0 : 1;

      if (aStarts !== bStarts) return aStarts - bStarts;

      return d3.ascending(a.countyName, b.countyName);
    })
    .slice(0, 8);
}

function renderCountySearchSuggestions(results) {
  countySearchResults = results;
  countySearchActiveIndex = -1;

  const list = document.querySelector("#county-search-suggestions");
  const input = document.querySelector("#county-search-input");

  list.innerHTML = "";

  if (!results.length) {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    return;
  }

  results.forEach((entry, index) => {
    const item = document.createElement("li");
    item.id = `county-search-option-${index}`;
    item.className = "county-search-option";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", "false");
    item.textContent = entry.label;
    item.addEventListener("mousedown", event => {
      event.preventDefault();
      chooseCountySearchResult(entry);
    });
    list.appendChild(item);
  });

  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function updateCountySearchActiveOption() {
  const options = document.querySelectorAll("#county-search-suggestions .county-search-option");
  const input = document.querySelector("#county-search-input");

  options.forEach((option, index) => {
    const isActive = index === countySearchActiveIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  if (countySearchActiveIndex >= 0 && options[countySearchActiveIndex]) {
    input.setAttribute("aria-activedescendant", options[countySearchActiveIndex].id);
    options[countySearchActiveIndex].scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

function closeCountySearchSuggestions() {
  const list = document.querySelector("#county-search-suggestions");
  const input = document.querySelector("#county-search-input");

  list.hidden = true;
  list.innerHTML = "";
  countySearchResults = [];
  countySearchActiveIndex = -1;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}

function chooseCountySearchResult(entry) {
  const input = document.querySelector("#county-search-input");
  input.value = entry.label;
  closeCountySearchSuggestions();
  selectSearchedCounty(entry.fips);
}

function selectSearchedCounty(fips) {
  const row = countyByFips.get(fips);
  if (!row) return;

  appState.highlightedCountyFips = fips;
  selectState(row.stateFips);
  updateStateDropdown();
  updateRegionDropdown();

  document.querySelector("#county-search-clear").hidden = false;
}

function clearSearchedCounty() {
  if (!appState.highlightedCountyFips) return;

  appState.highlightedCountyFips = null;
  appState.selectedState = null;
  appState.selectedRegion = null;

  zoomToStateFips([]);
  updateMap();
  updateStateDropdown();
  updateRegionDropdown();
}

function wireCountySearch() {
  const input = document.querySelector("#county-search-input");
  const clearButton = document.querySelector("#county-search-clear");

  input.addEventListener("input", () => {
    clearButton.hidden = !input.value;

    if (!input.value) {
      closeCountySearchSuggestions();
      clearSearchedCounty();
      return;
    }

    renderCountySearchSuggestions(searchCounties(input.value));
  });

  input.addEventListener("keydown", event => {
    if (!countySearchResults.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      countySearchActiveIndex = Math.min(countySearchActiveIndex + 1, countySearchResults.length - 1);
      updateCountySearchActiveOption();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      countySearchActiveIndex = Math.max(countySearchActiveIndex - 1, 0);
      updateCountySearchActiveOption();
    } else if (event.key === "Enter") {
      if (countySearchActiveIndex >= 0) {
        event.preventDefault();
        chooseCountySearchResult(countySearchResults[countySearchActiveIndex]);
      }
    } else if (event.key === "Escape") {
      closeCountySearchSuggestions();
    }
  });

  input.addEventListener("blur", () => {
    window.setTimeout(closeCountySearchSuggestions, 100);
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    clearButton.hidden = true;
    closeCountySearchSuggestions();
    clearSearchedCounty();
    input.focus();
  });
}

function buildGroupDropdown() {
  const select = document.querySelector("#group-select");

  Object.entries(GROUPS).forEach(([groupKey, group]) => {
    select.add(new Option(group.label, groupKey));
  });

  select.value = appState.groups[0] || "total";
  syncInlineSelectDisplay(select, "group-select-display", GROUP_LABELS);
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
  updateMapTitle();
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

function updateMapTitle() {
  d3.selectAll("#metric-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.metric; });

  const groupSelect = document.querySelector("#group-select");
  if (groupSelect) {
    groupSelect.value = appState.groups[0] || "total";
    syncInlineSelectDisplay(groupSelect, "group-select-display", GROUP_LABELS);
  }
}

function wireYearControls() {
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");

  startSelect.addEventListener("change", () => {
    appState.startYear = Number(startSelect.value);
    updateYearOptions();
    updateMapTitle();
    hideTooltip();
    updateMap();
  });

  endSelect.addEventListener("change", () => {
    appState.endYear = Number(endSelect.value);
    updateYearOptions();
    updateMapTitle();
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
  d3.selectAll("#metric-controls button")
    .classed("is-active", function () { return this.dataset.value === appState.metric; });

  d3.selectAll("#metric-controls button").on("click", function () {
    appState.metric = this.dataset.value;
    updateMap();
  });

  document.querySelector("#metric-controls .toggle-switch-track")
    .addEventListener("click", () => {
      appState.metric = appState.metric === "count" ? "percent" : "count";
      updateMap();
    });

  const groupSelect = document.querySelector("#group-select");
  groupSelect.addEventListener("change", event => {
    appState.groups = [event.target.value];
    hideTooltip();
    updateMap();
  });

  wireYearControls();

  document.querySelector("#sign-filter")
    .addEventListener("change", event => {
      appState.signFilter = event.target.value;
      updateMap();
    });

  const typeFilterSelect = document.querySelector("#type-filter");
  typeFilterSelect.value = appState.division;
  typeFilterSelect.addEventListener("change", event => {
    appState.division = event.target.value;
    updateMap();
  });

  document.querySelector("#state-select")
    .addEventListener("change", event => {
      const stateFips = event.target.value || null;
      const highlightedRow = countyByFips.get(appState.highlightedCountyFips);

      if (highlightedRow && highlightedRow.stateFips !== stateFips) {
        resetCountySearch();
      }

      selectState(stateFips);
    });

  document.querySelector("#region-select")
    .addEventListener("change", event => {
      const regionKey = event.target.value || null;
      const highlightedRow = countyByFips.get(appState.highlightedCountyFips);

      if (
        highlightedRow &&
        (!regionKey || !REGION_STATE_FIPS[regionKey].has(highlightedRow.stateFips))
      ) {
        resetCountySearch();
      }

      selectRegion(regionKey);
    });
}

function resetCountySearch() {
  appState.highlightedCountyFips = null;

  const input = document.querySelector("#county-search-input");
  const clearButton = document.querySelector("#county-search-clear");

  if (input) input.value = "";
  if (clearButton) clearButton.hidden = true;

  closeCountySearchSuggestions();
}

window.addEventListener("popstate", () => {
  appState.division = "all";
  appState.groups = ["total"];
  appState.metric = "count";
  appState.signFilter = "all";
  appState.startYear = 2020;
  appState.endYear = 2025;
  appState.selectedState = null;
  appState.selectedRegion = null;
  appState.highlightedCountyFips = null;
  appState.tableSort = null;
  readURLState();

  if (!availableYears.length || !countyLayer || !stateLayer) return;

  populateYearControls();
  updateMapTitle();
  updateStateDropdown();
  updateRegionDropdown();

  const signFilterSelect = document.querySelector("#sign-filter");
  if (signFilterSelect) signFilterSelect.value = appState.signFilter;

  const typeFilterSelect = document.querySelector("#type-filter");
  if (typeFilterSelect) typeFilterSelect.value = appState.division;

  const searchInput = document.querySelector("#county-search-input");
  const searchClear = document.querySelector("#county-search-clear");

  if (appState.highlightedCountyFips) {
    const row = countyByFips.get(appState.highlightedCountyFips);
    searchInput.value = row ? `${row.countyName}, ${row.stateName}` : "";
    searchClear.hidden = false;
  } else {
    searchInput.value = "";
    searchClear.hidden = true;
  }

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
