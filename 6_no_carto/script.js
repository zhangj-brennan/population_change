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
  white: "#6f6f6f",
  black: "#9E0B0F",
  native: "#8E6C3A",
  asian: "#7A4FA3",
  pacific: "#3995B2",
  latino: "#ED1C24"
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
const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming"
};
const ABBR_TO_STATE_FIPS = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_ABBR).map(([fips, abbreviation]) => [abbreviation, fips])
);

const appState = {
  division: "all",
  group: "total",
  metric: "count",
  startYear: 2020,
  endYear: 2025,
  selectedState: null
};

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

buildPopulationChartKey();
buildStateDropdown();
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

function valueForCounty(row) {
  if (!row) return null;

  const values = row.values[appState.group];
  const start = values[appState.startYear];
  const end = values[appState.endYear];

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
      if (!appState.selectedState) return false;
      return featureStateFips(feature) !== appState.selectedState;
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

updateLegend(negativeLimit, positiveLimit);
  updatePopulationChartSelection();
  updateStateDropdown();
  updateStatus();
}

function updateLegend(negativeLimit, positiveLimit) {
  const formatter = appState.metric === "percent"
    ? value => `${d3.format(".1f")(value)}%`
    : value => d3.format(",.0f")(value);

  document.querySelector("#legend-min").textContent =
    formatter(-negativeLimit);

  document.querySelector("#legend-max").textContent =
    `+${formatter(positiveLimit)}`;

  document.querySelector("#legend-label").textContent =
    // `${GROUPS[appState.group].label} · ` +
    // `${appState.startYear}–${appState.endYear} · ` +
    (
      appState.metric === "count"
        ? "Count change"
        : "Percent change"
    ) //+
    // " · color capped at the 90th percentile";
}
function updateStatus() {
  const shownCount = countyRows.filter(row => {
    const divisionMatch =
      appState.division === "all" ||
      row.division === appState.division;

    const stateMatch =
      !appState.selectedState ||
      row.stateFips === appState.selectedState;

    return divisionMatch && stateMatch;
  }).length;

  const stateLabel = appState.selectedState
    ? STATE_FIPS_TO_ABBR[appState.selectedState]
    : "United States";

  document.querySelector("#status").textContent =
    `${d3.format(",")(shownCount)} counties shown · ${stateLabel}`;
}

function showTooltip(event, feature) {
  const row = countyByFips.get(featureFips(feature));
  if (!row) return;
// When zoomed to a state, disable tooltips outside it.
if (
  appState.selectedState &&
  row.stateFips !== appState.selectedState
) {
  return;
}
  const values = row.values[appState.group];
  const start = values[appState.startYear];
  const end = values[appState.endYear];

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
      ${escapeHTML(GROUPS[appState.group].label)}<br>
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

  if (!stateFips) {
    countyLayer
      .transition()
      .duration(550)
      .attr("transform", null);

    stateLayer
      .transition()
      .duration(550)
      .attr("transform", null);

    updateMap();
    return;
  }

  const stateFeature = statesGeoJSON.features.find(feature =>
    String(feature.properties.STATEFP).padStart(2, "0") === stateFips
  );

  if (stateFeature) {
    const [[x0, y0], [x1, y1]] = path.bounds(stateFeature);
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

  updateMap();
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
    key
      .append("button")
      .attr("type", "button")
      .attr("data-value", groupKey)
      .style("--line-color", GROUP_COLORS[groupKey])
      .classed("is-active", groupKey === appState.group)
      .text(group.label)
      .on("click", () => selectPopulationGroup(groupKey));
  });

  populationChartKeySelection = key.selectAll("button");
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
    .on("click", (_, group) => selectPopulationGroup(group.groupKey))
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

function selectPopulationGroup(groupKey) {
  appState.group = groupKey;
  updatePopulationChartSelection();
  hidePopulationChartTooltip();
  updateMap();
}

function updatePopulationChartSelection() {
  if (populationChartLineSelection) {
    populationChartLineSelection
      .classed("is-active", group => group.groupKey === appState.group)
      .classed("is-faded", group => group.groupKey !== appState.group);
  }

  if (populationChartKeySelection) {
    populationChartKeySelection
      .classed("is-active", function() {
        return this.dataset.value === appState.group;
      })
      .classed("is-faded", function() {
        return this.dataset.value !== appState.group;
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

  appState.startYear = availableYears.includes(2020)
    ? 2020
    : availableYears[0];

  appState.endYear = availableYears.includes(2025)
    ? 2025
    : availableYears[availableYears.length - 1];

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
    .sort((a, b) => d3.ascending(a.abbreviation, b.abbreviation));

  states.forEach(state => {
    select.add(
  new Option(
    STATE_NAMES[state.abbreviation],
    state.fips
  )
);
  });
}

function updateStateDropdown() {
  const select = document.querySelector("#state-select");

  if (select) {
    select.value = appState.selectedState || "";
  }
}

function wireStaticControls() {
  wireButtonGroup("#division-controls button", "division");
  wireButtonGroup("#metric-controls button", "metric");
  wireYearControls();

  document.querySelector("#state-select")
    .addEventListener("change", event => {
      selectState(event.target.value || null);
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
