// ---------------------------------------------------------------------------
// Shared logic for the "largest factor of growth" static maps (natural
// change vs. immigration vs. domestic migration). Same pattern as
// growth-map.js, but built on the Census components-of-change file, which
// only breaks numbers out two ways — the latest year (annual) and the full
// 2020–2025 span (cumulative) — rather than year by year, so these pages get
// a two-way period toggle instead of start/end year dropdowns.
// ---------------------------------------------------------------------------
const FILES = {
  components: "data/counties_components_of_change.csv",
  counties: "counties_2025_5mScale.geojson",
  states: "states_2025_5mScale.geojson"
};

const PERIODS = {
  annual: { label: "2024–2025", prefix: "annual" },
  cumulative: { label: "2020–2025", prefix: "cumulative" }
};

const DEFAULT_PERIOD = "cumulative";

/*
  The three components compared against each other for "largest factor of
  growth." Natural change + net migration (international + domestic) sum to
  a county's total population change (plus a small unattributed residual).
*/
const FACTORS = {
  natural: { label: "Natural change (births minus deaths)", field: "natural_change" },
  international: { label: "International migration (immigration)", field: "international_migration" },
  domestic: { label: "Domestic migration", field: "domestic_migration" }
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
  west: { label: "West", states: ["AK", "CA", "HI", "OR", "WA"] },
  mountain: { label: "Mountain", states: ["AZ", "CO", "ID", "MT", "NM", "NV", "UT", "WY"] },
  plains: { label: "Plains", states: ["IA", "KS", "MN", "MO", "ND", "NE", "SD"] },
  midwest: { label: "Midwest", states: ["IL", "IN", "MI", "OH"] },
  northeast: {
    label: "Northeast",
    states: ["CT", "DE", "MA", "MD", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"]
  },
  south: {
    label: "South",
    states: ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV"]
  }
};

const ABBR_TO_STATE_FIPS = Object.fromEntries(
  Object.entries(STATE_FIPS_TO_ABBR).map(([fips, abbreviation]) => [abbreviation, fips])
);

const REGION_STATE_FIPS = Object.fromEntries(
  Object.entries(REGIONS).map(([regionKey, region]) => [
    regionKey,
    new Set(region.states.map(abbreviation => ABBR_TO_STATE_FIPS[abbreviation]))
  ])
);

const OUT_OF_SCOPE_FADE_MIX = 0.88;
const ZOOM_TRANSITION_DURATION_MS = 650;
const ZOOM_RESET_DURATION_MS = 550;

function featureStateFips(feature) {
  return String(feature.properties.STATEFP).padStart(2, "0");
}

/*
  Shared by both render functions: pan+zoom the county/state layers to the
  given list of state FIPS codes (or reset to the full map when empty).
*/
function createZoomToStateFips({ countyLayer, stateLayer, highlightLayer, stateFeatures, path }) {
  return function zoomToStateFips(stateFipsList) {
    if (!stateFipsList.length) {
      countyLayer.transition().duration(ZOOM_RESET_DURATION_MS).style("transform", null);
      stateLayer.transition().duration(ZOOM_RESET_DURATION_MS).style("transform", null);
      highlightLayer.transition().duration(ZOOM_RESET_DURATION_MS).style("transform", null);
      return;
    }

    const selectedFeatures = stateFeatures.filter(feature =>
      stateFipsList.includes(featureStateFips(feature))
    );
    if (!selectedFeatures.length) return;

    const featureCollection = { type: "FeatureCollection", features: selectedFeatures };
    const [[x0, y0], [x1, y1]] = path.bounds(featureCollection);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    const scale = Math.max(1, Math.min(8, 0.82 / Math.max(dx / 975, dy / 610)));

    const transform =
      `translate(${975 / 2}px,${610 / 2}px) scale(${scale}) translate(${-x}px,${-y}px)`;

    countyLayer.transition().duration(ZOOM_TRANSITION_DURATION_MS).style("transform", transform);
    stateLayer.transition().duration(ZOOM_TRANSITION_DURATION_MS).style("transform", transform);
    highlightLayer.transition().duration(ZOOM_TRANSITION_DURATION_MS).style("transform", transform);
  };
}

/*
  Shared by both render functions: a thick outline drawn in highlightLayer
  (above both the county fills and the white state borders) for whichever
  county is under the pointer — a plain CSS :hover stroke on the county path
  itself would render *under* the state-outline layer at a state border.
*/
function createHoverOutline({ highlightLayer, path }) {
  return {
    show(feature) {
      highlightLayer.selectAll(".county-hover-outline")
        .data([feature])
        .join("path")
        .attr("class", "county-hover-outline")
        .attr("d", path);
    },
    hide() {
      highlightLayer.selectAll(".county-hover-outline").remove();
    }
  };
}

/*
  Shared by both render functions: populate the state/region <select>
  elements once (no listeners — each render function wires its own).
*/
function populateGeoDropdowns(stateSelect, regionSelect) {
  if (stateSelect) {
    Object.entries(STATE_FIPS_TO_ABBR)
      .map(([fips, abbreviation]) => ({ fips, abbreviation }))
      .sort((a, b) => d3.ascending(STATE_NAMES[a.abbreviation], STATE_NAMES[b.abbreviation]))
      .forEach(state => stateSelect.add(new Option(STATE_NAMES[state.abbreviation], state.fips)));
  }

  if (regionSelect) {
    Object.entries(REGIONS).forEach(([regionKey, region]) => {
      regionSelect.add(new Option(region.label, regionKey));
    });
  }
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseComponentsRow(row) {
  const values = { annual: {}, cumulative: {} };
  Object.keys(PERIODS).forEach(period => {
    const prefix = PERIODS[period].prefix;
    Object.keys(FACTORS).forEach(factorKey => {
      values[period][factorKey] = numeric(row[`${prefix}_${FACTORS[factorKey].field}`]);
    });
    values[period].total = numeric(row[`${prefix}_total_change`]);
  });

  return {
    fips: row.fips,
    stateFips: row.state_fips,
    countyName: row.county_name,
    stateName: row.state_name,
    values
  };
}

/*
  Every factor's value for one county in one period, sorted largest to
  smallest — the basis for both the dominant-factor fill and the tooltip.
*/
function computeFactorValues(row, period) {
  return Object.keys(FACTORS)
    .map(factorKey => ({ factorKey, value: row.values[period][factorKey] }))
    .filter(item => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
}

function computeDominantFactor(row, period) {
  const [top] = computeFactorValues(row, period);
  return top
    ? { dominantFactor: top.factorKey, dominantValue: top.value }
    : { dominantFactor: null, dominantValue: -Infinity };
}

/*
  For a two-factor head-to-head (e.g. natural change vs. immigration): each
  county goes to whichever of the two is bigger. A tie or two non-positive
  values falls back to muted grey (neither factor actually grew the county).
*/
function computeTwoFactorWinner(row, period, factorAKey, factorBKey) {
  const a = row.values[period][factorAKey];
  const b = row.values[period][factorBKey];
  const av = Number.isFinite(a) ? a : -Infinity;
  const bv = Number.isFinite(b) ? b : -Infinity;

  if (av <= 0 && bv <= 0) {
    return { winner: null, value: Math.max(av, bv) };
  }
  return av >= bv ? { winner: factorAKey, value: av } : { winner: factorBKey, value: bv };
}

function featureFips(feature) {
  return String(feature.properties.GEOID).padStart(5, "0");
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function renderComponentsMap({ factorKey, factorLabel, highlightColor, mutedColor = "#ededed" }) {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#county-map");
  const tooltip = d3.select("#tooltip");
  const periodSelect = document.querySelector("#period-select");
  const stateSelect = document.querySelector("#state-select");
  const regionSelect = document.querySelector("#region-select");
  const statusText = document.querySelector("#status-text");
  const legendGradient = document.querySelector("#growth-legend-gradient");

  try {
    const [geoJSON, statesGeoJSON, componentsRows] = await Promise.all([
      d3.json(FILES.counties),
      d3.json(FILES.states),
      d3.csv(FILES.components, parseComponentsRow)
    ]);

    const countyByFips = new Map(componentsRows.map(row => [row.fips, row]));

    const includedFeatures = geoJSON.features.filter(feature =>
      String(feature.properties.STATEFP).padStart(2, "0") !== "72"
    );
    const countiesGeoJSON = { type: "FeatureCollection", features: includedFeatures };
    const stateFeatures = statesGeoJSON.features.filter(feature =>
      String(feature.properties.STATEFP).padStart(2, "0") !== "72"
    );

    const projection = d3.geoAlbersUsa().fitExtent([[8, 8], [967, 602]], countiesGeoJSON);
    const path = d3.geoPath(projection);

    const countyLayer = svg.append("g").attr("class", "county-layer");
    const stateLayer = svg.append("g").attr("class", "state-layer");
    const highlightLayer = svg.append("g").attr("class", "highlight-layer");
    const hoverOutline = createHoverOutline({ highlightLayer, path });

    const TINT_FLOOR_MIX = 0.6;
    const colorTint = d3.interpolateRgb(highlightColor, mutedColor)(TINT_FLOOR_MIX);
    const colorRamp = d3.interpolateRgb(colorTint, highlightColor);
    if (legendGradient) {
      legendGradient.style.background = `linear-gradient(90deg, ${colorTint}, ${highlightColor})`;
    }

    const countySelection = countyLayer.selectAll("path")
      .data(includedFeatures)
      .join("path")
      .attr("class", "county")
      .attr("d", path)
      .on("mousemove", (event, feature) => showTooltip(event, feature))
      .on("mouseleave", hideTooltip);

    stateLayer.selectAll("path")
      .data(stateFeatures)
      .join("path")
      .attr("class", "state-outline")
      .attr("d", path);

    const zoomToStateFips = createZoomToStateFips({ countyLayer, stateLayer, highlightLayer, stateFeatures, path });

    let dominantByFips = new Map();
    let currentPeriod = DEFAULT_PERIOD;
    let selectedStateFips = null;
    let selectedRegionKey = null;

    function isOutOfScope(row) {
      if (!row) return false;
      if (selectedStateFips) return row.stateFips !== selectedStateFips;
      if (selectedRegionKey) return !REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips);
      return false;
    }

    function updateFills(period) {
      currentPeriod = period;

      dominantByFips = new Map(componentsRows.map(row =>
        [row.fips, computeDominantFactor(row, period)]
      ));

      // The color scale's max is scoped to the selected state/region (like
      // the main map) so the most extreme county *in view* always reads as
      // the darkest color, rather than being washed out by a nationwide max.
      const geographyRows = componentsRows.filter(row => !isOutOfScope(row));
      const dominantValues = geographyRows
        .map(row => dominantByFips.get(row.fips))
        .filter(d => d.dominantValue > 0 && d.dominantFactor === factorKey)
        .map(d => d.dominantValue);
      const maxDominantValue = d3.max(dominantValues) || 1;

      function fillFor(fips) {
        const dominance = dominantByFips.get(fips);
        const baseColor = (!dominance || dominance.dominantValue <= 0 || dominance.dominantFactor !== factorKey)
          ? mutedColor
          : colorRamp(Math.min(dominance.dominantValue / maxDominantValue, 1));

        if (isOutOfScope(countyByFips.get(fips))) {
          return d3.interpolateRgb(baseColor, "#ffffff")(OUT_OF_SCOPE_FADE_MIX);
        }
        return baseColor;
      }

      countySelection
        .attr("fill", feature => fillFor(featureFips(feature)))
        .classed("is-out-of-scope", feature => isOutOfScope(countyByFips.get(featureFips(feature))));

      if (statusText) {
        const geographyLabel = selectedStateFips
          ? STATE_NAMES[STATE_FIPS_TO_ABBR[selectedStateFips]]
          : selectedRegionKey
            ? REGIONS[selectedRegionKey].label
            : null;
        const geographySuffix = geographyLabel ? ` in ${geographyLabel}` : "";
        statusText.textContent = `${d3.format(",")(dominantValues.length)} counties${geographySuffix} where ${factorLabel} was the largest factor of population growth, ${PERIODS[period].label}`;
      }
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      if (isOutOfScope(row)) {
        hideTooltip();
        return;
      }

      hoverOutline.show(feature);

      const factorValues = computeFactorValues(row, currentPeriod);
      const factorList = factorValues
        .map(({ factorKey: key, value }, i) => {
          const line = `${escapeHTML(FACTORS[key].label)}: ${d3.format("+,")(value)}`;
          return i === 0 ? `<strong>${line}</strong>` : line;
        })
        .join("<br>");

      const totalChange = row.values[currentPeriod].total;
      const totalText = Number.isFinite(totalChange)
        ? `Total population change (${PERIODS[currentPeriod].label}): ${d3.format("+,")(totalChange)}<br>`
        : "";

      tooltip.style("opacity", 1).attr("aria-hidden", "false");
      tooltip.select("#tooltip-content").html(`
        <strong>${escapeHTML(row.countyName)}, ${escapeHTML(row.stateName)}</strong><br>
        ${totalText}
        ${factorList}
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

      tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${Math.max(0, top)}px`);
    }

    function hideTooltip() {
      tooltip.style("opacity", 0).attr("aria-hidden", "true");
      hoverOutline.hide();
    }

    const tooltipCloseButton = document.querySelector("#tooltip-close");
    if (tooltipCloseButton) {
      tooltipCloseButton.addEventListener("click", event => {
        event.stopPropagation();
        hideTooltip();
      });
    }

    if (periodSelect) {
      periodSelect.value = DEFAULT_PERIOD;
      periodSelect.addEventListener("change", () => {
        hideTooltip();
        updateFills(periodSelect.value);
      });
    }

    function selectState(stateFips) {
      selectedStateFips = stateFips;
      if (stateFips) selectedRegionKey = null;
      if (stateSelect) stateSelect.value = stateFips || "";
      if (regionSelect) regionSelect.value = "";

      zoomToStateFips(stateFips ? [stateFips] : []);
      updateFills(currentPeriod);
    }

    function selectRegion(regionKey) {
      selectedRegionKey = regionKey;
      if (regionKey) selectedStateFips = null;
      if (regionSelect) regionSelect.value = regionKey || "";
      if (stateSelect) stateSelect.value = "";

      zoomToStateFips(regionKey ? Array.from(REGION_STATE_FIPS[regionKey]) : []);
      updateFills(currentPeriod);
    }

    populateGeoDropdowns(stateSelect, regionSelect);

    if (stateSelect) {
      stateSelect.addEventListener("change", () => {
        hideTooltip();
        selectState(stateSelect.value || null);
      });
    }

    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        hideTooltip();
        selectRegion(regionSelect.value || null);
      });
    }


    updateFills(DEFAULT_PERIOD);

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
      server rather than double-clicking this file. For example:
      <code>python3 -m http.server</code>
    `;
  }
}

/*
  Head-to-head version: every county gets colored, on one of two independent
  ramps depending on which factor is bigger there — same "each side fades to
  the same neutral grey" approach as the main map's positive/negative scale.
*/
async function renderTwoFactorMap({
  factorAKey, factorALabel, factorAColor,
  factorBKey, factorBLabel, factorBColor,
  mutedColor = "#ededed"
}) {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#county-map");
  const tooltip = d3.select("#tooltip");
  const periodSelect = document.querySelector("#period-select");
  const stateSelect = document.querySelector("#state-select");
  const regionSelect = document.querySelector("#region-select");
  const statusText = document.querySelector("#status-text");
  const legendGradientA = document.querySelector("#growth-legend-gradient-a");
  const legendGradientB = document.querySelector("#growth-legend-gradient-b");
  const legendMaxA = document.querySelector("#growth-legend-max-a");
  const legendMaxB = document.querySelector("#growth-legend-max-b");

  try {
    const [geoJSON, statesGeoJSON, componentsRows] = await Promise.all([
      d3.json(FILES.counties),
      d3.json(FILES.states),
      d3.csv(FILES.components, parseComponentsRow)
    ]);

    const countyByFips = new Map(componentsRows.map(row => [row.fips, row]));

    const includedFeatures = geoJSON.features.filter(feature =>
      String(feature.properties.STATEFP).padStart(2, "0") !== "72"
    );
    const countiesGeoJSON = { type: "FeatureCollection", features: includedFeatures };
    const stateFeatures = statesGeoJSON.features.filter(feature =>
      String(feature.properties.STATEFP).padStart(2, "0") !== "72"
    );

    const projection = d3.geoAlbersUsa().fitExtent([[8, 8], [967, 602]], countiesGeoJSON);
    const path = d3.geoPath(projection);

    const countyLayer = svg.append("g").attr("class", "county-layer");
    const stateLayer = svg.append("g").attr("class", "state-layer");
    const highlightLayer = svg.append("g").attr("class", "highlight-layer");
    const hoverOutline = createHoverOutline({ highlightLayer, path });

    const TINT_FLOOR_MIX = 0.6;
    const tintA = d3.interpolateRgb(factorAColor, mutedColor)(TINT_FLOOR_MIX);
    const rampA = d3.interpolateRgb(tintA, factorAColor);
    const tintB = d3.interpolateRgb(factorBColor, mutedColor)(TINT_FLOOR_MIX);
    const rampB = d3.interpolateRgb(tintB, factorBColor);

    if (legendGradientA) {
      legendGradientA.style.background = `linear-gradient(90deg, ${tintA}, ${factorAColor})`;
    }
    if (legendGradientB) {
      legendGradientB.style.background = `linear-gradient(90deg, ${tintB}, ${factorBColor})`;
    }

    const countySelection = countyLayer.selectAll("path")
      .data(includedFeatures)
      .join("path")
      .attr("class", "county")
      .attr("d", path)
      .on("mousemove", (event, feature) => showTooltip(event, feature))
      .on("mouseleave", hideTooltip);

    stateLayer.selectAll("path")
      .data(stateFeatures)
      .join("path")
      .attr("class", "state-outline")
      .attr("d", path);

    const zoomToStateFips = createZoomToStateFips({ countyLayer, stateLayer, highlightLayer, stateFeatures, path });

    let winnerByFips = new Map();
    let currentPeriod = DEFAULT_PERIOD;
    let selectedStateFips = null;
    let selectedRegionKey = null;

    function isOutOfScope(row) {
      if (!row) return false;
      if (selectedStateFips) return row.stateFips !== selectedStateFips;
      if (selectedRegionKey) return !REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips);
      return false;
    }

    function updateFills(period) {
      currentPeriod = period;

      winnerByFips = new Map(componentsRows.map(row =>
        [row.fips, computeTwoFactorWinner(row, period, factorAKey, factorBKey)]
      ));

      // The color scale's max on each side is scoped to the selected
      // state/region, same as the single-factor maps.
      const geographyRows = componentsRows.filter(row => !isOutOfScope(row));
      const values = geographyRows.map(row => winnerByFips.get(row.fips));
      const maxA = d3.max(values.filter(d => d.winner === factorAKey), d => d.value) || 1;
      const maxB = d3.max(values.filter(d => d.winner === factorBKey), d => d.value) || 1;

      if (legendMaxA) legendMaxA.textContent = d3.format("+,")(maxA);
      if (legendMaxB) legendMaxB.textContent = d3.format("+,")(maxB);

      function fillFor(fips) {
        const result = winnerByFips.get(fips);
        const baseColor = !result || !result.winner
          ? mutedColor
          : result.winner === factorAKey
            ? rampA(Math.min(result.value / maxA, 1))
            : rampB(Math.min(result.value / maxB, 1));

        if (isOutOfScope(countyByFips.get(fips))) {
          return d3.interpolateRgb(baseColor, "#ffffff")(OUT_OF_SCOPE_FADE_MIX);
        }
        return baseColor;
      }

      countySelection
        .attr("fill", feature => fillFor(featureFips(feature)))
        .classed("is-out-of-scope", feature => isOutOfScope(countyByFips.get(featureFips(feature))));

      if (statusText) {
        const countA = values.filter(d => d.winner === factorAKey).length;
        const countB = values.filter(d => d.winner === factorBKey).length;
        const geographyLabel = selectedStateFips
          ? STATE_NAMES[STATE_FIPS_TO_ABBR[selectedStateFips]]
          : selectedRegionKey
            ? REGIONS[selectedRegionKey].label
            : null;
        const geographySuffix = geographyLabel ? ` in ${geographyLabel}` : "";
        statusText.textContent = `${d3.format(",")(countA)} counties${geographySuffix} where ${factorALabel} led, ${d3.format(",")(countB)} where ${factorBLabel} led, ${PERIODS[period].label}`;
      }
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      if (isOutOfScope(row)) {
        hideTooltip();
        return;
      }

      hoverOutline.show(feature);

      const a = row.values[currentPeriod][factorAKey];
      const b = row.values[currentPeriod][factorBKey];
      const lines = [
        { label: factorALabel, value: a },
        { label: factorBLabel, value: b }
      ]
        .filter(item => Number.isFinite(item.value))
        .sort((x, y) => y.value - x.value)
        .map(({ label, value }, i) => {
          const line = `${escapeHTML(label)}: ${d3.format("+,")(value)}`;
          return i === 0 ? `<strong>${line}</strong>` : line;
        })
        .join("<br>");

      const totalChange = row.values[currentPeriod].total;
      const totalText = Number.isFinite(totalChange)
        ? `Total population change (${PERIODS[currentPeriod].label}): ${d3.format("+,")(totalChange)}<br>`
        : "";

      tooltip.style("opacity", 1).attr("aria-hidden", "false");
      tooltip.select("#tooltip-content").html(`
        <strong>${escapeHTML(row.countyName)}, ${escapeHTML(row.stateName)}</strong><br>
        ${totalText}
        ${lines}
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

      tooltip.style("left", `${Math.max(0, left)}px`).style("top", `${Math.max(0, top)}px`);
    }

    function hideTooltip() {
      tooltip.style("opacity", 0).attr("aria-hidden", "true");
      hoverOutline.hide();
    }

    const tooltipCloseButton = document.querySelector("#tooltip-close");
    if (tooltipCloseButton) {
      tooltipCloseButton.addEventListener("click", event => {
        event.stopPropagation();
        hideTooltip();
      });
    }

    if (periodSelect) {
      periodSelect.value = DEFAULT_PERIOD;
      periodSelect.addEventListener("change", () => {
        hideTooltip();
        updateFills(periodSelect.value);
      });
    }

    function selectState(stateFips) {
      selectedStateFips = stateFips;
      if (stateFips) selectedRegionKey = null;
      if (stateSelect) stateSelect.value = stateFips || "";
      if (regionSelect) regionSelect.value = "";

      zoomToStateFips(stateFips ? [stateFips] : []);
      updateFills(currentPeriod);
    }

    function selectRegion(regionKey) {
      selectedRegionKey = regionKey;
      if (regionKey) selectedStateFips = null;
      if (regionSelect) regionSelect.value = regionKey || "";
      if (stateSelect) stateSelect.value = "";

      zoomToStateFips(regionKey ? Array.from(REGION_STATE_FIPS[regionKey]) : []);
      updateFills(currentPeriod);
    }

    populateGeoDropdowns(stateSelect, regionSelect);

    if (stateSelect) {
      stateSelect.addEventListener("change", () => {
        hideTooltip();
        selectState(stateSelect.value || null);
      });
    }

    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        hideTooltip();
        selectRegion(regionSelect.value || null);
      });
    }


    updateFills(DEFAULT_PERIOD);

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
      server rather than double-clicking this file. For example:
      <code>python3 -m http.server</code>
    `;
  }
}
