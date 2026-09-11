// ---------------------------------------------------------------------------
// Shared logic for the "largest source of growth" static maps. Each map page
// (asian-growth-map.html, latino-growth-map.html) loads this file and calls
// renderGrowthMap() with the group it wants highlighted. For every county we
// compute which racial/ethnic subgroup added the most people between the
// selected start/end years, then highlight the counties where the requested
// group won that comparison — the two year dropdowns just change which pair
// of years that comparison runs over.
// ---------------------------------------------------------------------------
const FILES = {
  population: "data/Vintage 2025 counties race & ethnicity 1.csv",
  counties: "counties_2025_5mScale.geojson",
  states: "states_2025_5mScale.geojson"
};

const DEFAULT_START_YEAR = 2020;
const DEFAULT_END_YEAR = 2025;

const YEAR_CODE_TO_LABEL = {
  1: 2020,
  3: 2021,
  4: 2022,
  5: 2023,
  6: 2024,
  7: 2025
};

/*
  The subgroups compared against each other for "largest source of growth."
  These are mutually exclusive and (approximately) exhaustive of the total
  population in the source file — Latino is all races/Hispanic, the rest are
  non-Hispanic — so summing their changes approximates the county's total
  population change.
*/
const GROWTH_GROUPS = {
  white: { label: "White, non-Hispanic", fields: ["White Male", "White Female"] },
  black: { label: "Black, non-Hispanic", fields: ["Black Male", "Black Female"] },
  latino: { label: "Latino", fields: ["Latino Male", "Latino Female"] },
  asian: { label: "Asian, non-Hispanic", fields: ["Asian Male", "Asian Female"] },
  native: {
    label: "American Indian/Alaska Native, non-Hispanic",
    fields: ["Indian/Alaska  American Male", "Indian/Alaska Native Female"]
  },
  pacific: {
    label: "Native Hawaiian/Pacific Islander, non-Hispanic",
    fields: ["Hawaiian/Pacific Islander Male", "Hawaiian/Pacific Islander Female"]
  }
};

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePopulationRow(row) {
  const ageGroup = Number(row.AGEGRP);
  const year = Number(row.YEAR);
  const yearLabel = YEAR_CODE_TO_LABEL[year];

  if (ageGroup !== 0 || !yearLabel) {
    return null;
  }

  const fips = String(row.STATE).padStart(2, "0") + String(row.COUNTY).padStart(3, "0");
  const values = { total: numeric(row.TotalPopulation) };

  for (const [groupKey, group] of Object.entries(GROWTH_GROUPS)) {
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

/*
  One record per county, keeping every subgroup's population for every
  available year — the year picked apart at render time (updateFills) rather
  than baked in here, so the two year dropdowns can recompute without
  re-fetching anything.
*/
function buildCountyRecords(populationRows) {
  const grouped = d3.group(populationRows.filter(Boolean), row => row.fips);
  const records = [];

  grouped.forEach((rows, fips) => {
    const byYear = new Map(rows.map(row => [row.year, row]));
    const referenceRow = rows[0];
    if (!referenceRow) return;

    const values = {};
    [...Object.keys(GROWTH_GROUPS), "total"].forEach(groupKey => {
      values[groupKey] = {};
      byYear.forEach((row, year) => {
        values[groupKey][year] = row.values[groupKey];
      });
    });

    records.push({
      fips,
      stateFips: referenceRow.stateFips,
      stateName: referenceRow.stateName,
      countyName: referenceRow.countyName,
      values
    });
  });

  return records;
}

/*
  A group's value in either display unit: its raw change, or its share of
  the county's total population change over the same span (undefined when
  the total change is zero, since "share of nothing" isn't meaningful).
*/
function groupValue(row, groupKey, startYear, endYear, metric) {
  const start = row.values[groupKey]?.[startYear];
  const end = row.values[groupKey]?.[endYear];
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const change = end - start;

  if (metric === "percent") {
    const totalStart = row.values.total?.[startYear];
    const totalEnd = row.values.total?.[endYear];
    if (!Number.isFinite(totalStart) || !Number.isFinite(totalEnd)) return null;
    const totalChange = totalEnd - totalStart;
    if (totalChange === 0) return null;
    return (change / totalChange) * 100;
  }
  return change;
}

function formatGroupValue(value, metric) {
  return metric === "percent" ? `${d3.format("+.1f")(value)}%` : d3.format("+,")(value);
}

/*
  Every subgroup's value between startYear and endYear for one county,
  sorted largest to smallest — the basis for both the dominant-group fill
  and the full per-group breakdown shown in the tooltip.
*/
function computeGroupChanges(row, startYear, endYear, metric) {
  return Object.keys(GROWTH_GROUPS)
    .map(groupKey => ({ groupKey, change: groupValue(row, groupKey, startYear, endYear, metric) }))
    .filter(item => item.change !== null)
    .sort((a, b) => b.change - a.change);
}

/*
  Whichever subgroup added the most people (or the largest share of the
  county's total change) over that span. A dominantChange <= 0 means no
  subgroup actually grew.
*/
function computeDominantGroup(row, startYear, endYear, metric) {
  const [top] = computeGroupChanges(row, startYear, endYear, metric);
  return top
    ? { dominantGroup: top.groupKey, dominantChange: top.change }
    : { dominantGroup: null, dominantChange: -Infinity };
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

async function renderGrowthMap({ groupKey, groupLabel, highlightColor, mutedColor = "#ededed" }) {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#county-map");
  const tooltip = d3.select("#tooltip");
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");
  const statusText = document.querySelector("#status-text");
  const legendGradient = document.querySelector("#growth-legend-gradient");

  try {
    const [geoJSON, statesGeoJSON, populationRows] = await Promise.all([
      d3.json(FILES.counties),
      d3.json(FILES.states),
      d3.csv(FILES.population, parsePopulationRow)
    ]);

    const countyRows = buildCountyRecords(populationRows);
    const countyByFips = new Map(countyRows.map(row => [row.fips, row]));
    const availableYears = Array.from(new Set(Object.values(YEAR_CODE_TO_LABEL))).sort(d3.ascending);

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

    // dominantByFips is recomputed for the current start/end years every
    // time either dropdown changes, and read by both the fill and the
    // tooltip so they always agree on the same pair of years.
    let dominantByFips = new Map();
    let currentStartYear = DEFAULT_START_YEAR;
    let currentEndYear = DEFAULT_END_YEAR;
    let currentMetric = "count";

    function updateFills(startYear, endYear, metric) {
      currentStartYear = startYear;
      currentEndYear = endYear;
      currentMetric = metric;

      dominantByFips = new Map(countyRows.map(row =>
        [row.fips, computeDominantGroup(row, startYear, endYear, metric)]
      ));

      const dominantChanges = Array.from(dominantByFips.values())
        .filter(d => d.dominantChange > 0 && d.dominantGroup === groupKey)
        .map(d => d.dominantChange);
      const maxDominantChange = d3.max(dominantChanges) || 1;

      function fillFor(fips) {
        const dominance = dominantByFips.get(fips);
        if (!dominance || dominance.dominantChange <= 0 || dominance.dominantGroup !== groupKey) {
          return mutedColor;
        }
        return colorRamp(Math.min(dominance.dominantChange / maxDominantChange, 1));
      }

      countySelection.attr("fill", feature => fillFor(featureFips(feature)));

      if (statusText) {
        statusText.textContent = `${d3.format(",")(dominantChanges.length)} counties where ${groupLabel} was the largest source of population growth, ${startYear}–${endYear}`;
      }
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      const changes = computeGroupChanges(row, currentStartYear, currentEndYear, currentMetric);
      const changesList = changes
        .map(({ groupKey, change }, i) => {
          const line = `${escapeHTML(GROWTH_GROUPS[groupKey].label)}: ${formatGroupValue(change, currentMetric)}`;
          return i === 0 ? `<strong>${line}</strong>` : line;
        })
        .join("<br>");

      const totalPopulation = row.values.total?.[currentEndYear];
      const totalText = Number.isFinite(totalPopulation)
        ? `Total population (${currentEndYear}): ${d3.format(",")(totalPopulation)}<br>`
        : "";

      tooltip.style("opacity", 1).attr("aria-hidden", "false");
      tooltip.select("#tooltip-content").html(`
        <strong>${escapeHTML(row.countyName)}, ${escapeHTML(row.stateName)}</strong><br>
        ${totalText}
        ${changesList}
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

    // Year dropdowns — same "can't pick start >= end" guard as the main map.
    function updateYearOptionAvailability() {
      Array.from(startSelect.options).forEach(option => {
        option.disabled = Number(option.value) >= Number(endSelect.value);
      });
      Array.from(endSelect.options).forEach(option => {
        option.disabled = Number(option.value) <= Number(startSelect.value);
      });
    }

    if (startSelect && endSelect) {
      availableYears.forEach(year => {
        startSelect.add(new Option(year, year));
        endSelect.add(new Option(year, year));
      });
      startSelect.value = DEFAULT_START_YEAR;
      endSelect.value = DEFAULT_END_YEAR;
      updateYearOptionAvailability();

      startSelect.addEventListener("change", () => {
        updateYearOptionAvailability();
        hideTooltip();
        updateFills(Number(startSelect.value), Number(endSelect.value), currentMetric);
      });
      endSelect.addEventListener("change", () => {
        updateYearOptionAvailability();
        hideTooltip();
        updateFills(Number(startSelect.value), Number(endSelect.value), currentMetric);
      });
    }

    const metricButtons = document.querySelectorAll("#metric-controls button");
    function setMetric(metric) {
      if (metric === currentMetric) return;
      metricButtons.forEach(b => b.classList.toggle("is-active", b.dataset.value === metric));
      hideTooltip();
      updateFills(currentStartYear, currentEndYear, metric);
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

    updateFills(DEFAULT_START_YEAR, DEFAULT_END_YEAR, currentMetric);

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
