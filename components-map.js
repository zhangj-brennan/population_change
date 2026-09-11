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

/*
  A factor's value in either display unit: the raw count, or its share of
  the county's total population change over the same period (undefined when
  the total is zero, since "share of nothing" isn't meaningful).
*/
function factorValue(row, period, factorKey, metric) {
  const raw = row.values[period][factorKey];
  if (!Number.isFinite(raw)) return null;
  if (metric === "percent") {
    const total = row.values[period].total;
    if (!Number.isFinite(total) || total === 0) return null;
    return (raw / total) * 100;
  }
  return raw;
}

function formatFactorValue(value, metric) {
  return metric === "percent" ? `${d3.format("+.1f")(value)}%` : d3.format("+,")(value);
}

/*
  Every factor's value for one county in one period, sorted largest to
  smallest — the basis for both the dominant-factor fill and the tooltip.
*/
function computeFactorValues(row, period, metric) {
  return Object.keys(FACTORS)
    .map(factorKey => ({ factorKey, value: factorValue(row, period, factorKey, metric) }))
    .filter(item => item.value !== null)
    .sort((a, b) => b.value - a.value);
}

function computeDominantFactor(row, period, metric) {
  const [top] = computeFactorValues(row, period, metric);
  return top
    ? { dominantFactor: top.factorKey, dominantValue: top.value }
    : { dominantFactor: null, dominantValue: -Infinity };
}

/*
  For a two-factor head-to-head (e.g. natural change vs. immigration): each
  county goes to whichever of the two is bigger, in whichever unit (count or
  percent of total change) is currently displayed. A tie or two non-positive
  values falls back to muted grey (neither factor actually grew the county).
*/
function computeTwoFactorWinner(row, period, factorAKey, factorBKey, metric) {
  const a = factorValue(row, period, factorAKey, metric);
  const b = factorValue(row, period, factorBKey, metric);
  const av = Number.isFinite(a) ? a : -Infinity;
  const bv = Number.isFinite(b) ? b : -Infinity;

  if (av <= 0 && bv <= 0) {
    return { winner: null, value: Math.max(av, bv) };
  }
  return av >= bv ? { winner: factorAKey, value: av } : { winner: factorBKey, value: bv };
}

async function renderComponentsMap({ factorKey, factorLabel, highlightColor, mutedColor = "#ededed" }) {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#county-map");
  const tooltip = d3.select("#tooltip");
  const periodSelect = document.querySelector("#period-select");
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

    let dominantByFips = new Map();
    let currentPeriod = DEFAULT_PERIOD;
    let currentMetric = "count";

    function updateFills(period, metric) {
      currentPeriod = period;
      currentMetric = metric;

      dominantByFips = new Map(componentsRows.map(row =>
        [row.fips, computeDominantFactor(row, period, metric)]
      ));

      const dominantValues = Array.from(dominantByFips.values())
        .filter(d => d.dominantValue > 0 && d.dominantFactor === factorKey)
        .map(d => d.dominantValue);
      const maxDominantValue = d3.max(dominantValues) || 1;

      function fillFor(fips) {
        const dominance = dominantByFips.get(fips);
        if (!dominance || dominance.dominantValue <= 0 || dominance.dominantFactor !== factorKey) {
          return mutedColor;
        }
        return colorRamp(Math.min(dominance.dominantValue / maxDominantValue, 1));
      }

      countySelection.attr("fill", feature => fillFor(featureFips(feature)));

      if (statusText) {
        statusText.textContent = `${d3.format(",")(dominantValues.length)} counties where ${factorLabel} was the largest factor of population growth, ${PERIODS[period].label}`;
      }
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      const factorValues = computeFactorValues(row, currentPeriod, currentMetric);
      const factorList = factorValues
        .map(({ factorKey: key, value }, i) => {
          const line = `${escapeHTML(FACTORS[key].label)}: ${formatFactorValue(value, currentMetric)}`;
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
        updateFills(periodSelect.value, currentMetric);
      });
    }

    const metricButtons = document.querySelectorAll("#metric-controls button");
    function setMetric(metric) {
      if (metric === currentMetric) return;
      metricButtons.forEach(b => b.classList.toggle("is-active", b.dataset.value === metric));
      hideTooltip();
      updateFills(currentPeriod, metric);
    }
    metricButtons.forEach(button => {
      button.addEventListener("click", () => setMetric(button.dataset.value));
    });
    const metricTrack = document.querySelector("#metric-controls .toggle-switch-track");
    if (metricTrack) {
      metricTrack.addEventListener("click", () => {
        setMetric(currentMetric === "count" ? "percent" : "count");
      });
    }

    updateFills(DEFAULT_PERIOD, currentMetric);

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

    let winnerByFips = new Map();
    let currentPeriod = DEFAULT_PERIOD;
    let currentMetric = "count";

    function updateFills(period, metric) {
      currentPeriod = period;
      currentMetric = metric;

      winnerByFips = new Map(componentsRows.map(row =>
        [row.fips, computeTwoFactorWinner(row, period, factorAKey, factorBKey, metric)]
      ));

      const values = Array.from(winnerByFips.values());
      const maxA = d3.max(values.filter(d => d.winner === factorAKey), d => d.value) || 1;
      const maxB = d3.max(values.filter(d => d.winner === factorBKey), d => d.value) || 1;

      if (legendMaxA) legendMaxA.textContent = formatFactorValue(maxA, metric);
      if (legendMaxB) legendMaxB.textContent = formatFactorValue(maxB, metric);

      function fillFor(fips) {
        const result = winnerByFips.get(fips);
        if (!result || !result.winner) return mutedColor;
        if (result.winner === factorAKey) return rampA(Math.min(result.value / maxA, 1));
        return rampB(Math.min(result.value / maxB, 1));
      }

      countySelection.attr("fill", feature => fillFor(featureFips(feature)));

      if (statusText) {
        const countA = values.filter(d => d.winner === factorAKey).length;
        const countB = values.filter(d => d.winner === factorBKey).length;
        statusText.textContent = `${d3.format(",")(countA)} counties where ${factorALabel} led, ${d3.format(",")(countB)} where ${factorBLabel} led, ${PERIODS[period].label}`;
      }
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      const a = factorValue(row, currentPeriod, factorAKey, currentMetric);
      const b = factorValue(row, currentPeriod, factorBKey, currentMetric);
      const lines = [
        { label: factorALabel, value: a },
        { label: factorBLabel, value: b }
      ]
        .filter(item => Number.isFinite(item.value))
        .sort((x, y) => y.value - x.value)
        .map(({ label, value }, i) => {
          const line = `${escapeHTML(label)}: ${formatFactorValue(value, currentMetric)}`;
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
        updateFills(periodSelect.value, currentMetric);
      });
    }

    const metricButtons = document.querySelectorAll("#metric-controls button");
    function setMetric(metric) {
      if (metric === currentMetric) return;
      metricButtons.forEach(b => b.classList.toggle("is-active", b.dataset.value === metric));
      hideTooltip();
      updateFills(currentPeriod, metric);
    }
    metricButtons.forEach(button => {
      button.addEventListener("click", () => setMetric(button.dataset.value));
    });
    const metricTrack = document.querySelector("#metric-controls .toggle-switch-track");
    if (metricTrack) {
      metricTrack.addEventListener("click", () => {
        setMetric(currentMetric === "count" ? "percent" : "count");
      });
    }

    updateFills(DEFAULT_PERIOD, currentMetric);

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
