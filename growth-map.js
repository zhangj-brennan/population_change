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
  Every subgroup's change between startYear and endYear for one county,
  sorted largest to smallest — the basis for both the dominant-group fill
  and the full per-group breakdown shown in the tooltip.
*/
function computeGroupChanges(row, startYear, endYear) {
  return Object.keys(GROWTH_GROUPS)
    .map(groupKey => {
      const start = row.values[groupKey]?.[startYear];
      const end = row.values[groupKey]?.[endYear];
      const change = Number.isFinite(start) && Number.isFinite(end) ? end - start : null;
      return { groupKey, change };
    })
    .filter(item => item.change !== null)
    .sort((a, b) => b.change - a.change);
}

/*
  Whichever subgroup added the most people over that span. A dominantChange
  <= 0 means no subgroup actually grew.
*/
function computeDominantGroup(row, startYear, endYear) {
  const [top] = computeGroupChanges(row, startYear, endYear);
  return top
    ? { dominantGroup: top.groupKey, dominantChange: top.change }
    : { dominantGroup: null, dominantChange: -Infinity };
}

function featureFips(feature) {
  return String(feature.properties.GEOID).padStart(5, "0");
}

function featureStateFips(feature) {
  return String(feature.properties.STATEFP).padStart(2, "0");
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csvField(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function renderGrowthMap({ groupKey, groupLabel, highlightColor, mutedColor = "#ededed" }) {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#county-map");
  const tooltip = d3.select("#tooltip");
  const startSelect = document.querySelector("#start-year");
  const endSelect = document.querySelector("#end-year");
  const stateSelect = document.querySelector("#state-select");
  const regionSelect = document.querySelector("#region-select");
  const statusText = document.querySelector("#status-text");
  const legendGradient = document.querySelector("#growth-legend-gradient");
  const tableToggle = document.querySelector("#county-table-toggle");
  const tableExport = document.querySelector("#county-table-export");
  const tableWrap = document.querySelector("#county-table-wrap");
  const tableBody = document.querySelector("#county-table-body");
  const tableColStartPop = document.querySelector("#county-table-col-start-pop");
  const tableColEndPop = document.querySelector("#county-table-col-end-pop");

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
    const highlightLayer = svg.append("g").attr("class", "highlight-layer");

    const TINT_FLOOR_MIX = 0.6;
    const colorTint = d3.interpolateRgb(highlightColor, mutedColor)(TINT_FLOOR_MIX);
    const colorRamp = d3.interpolateRgb(colorTint, highlightColor);
    if (legendGradient) {
      legendGradient.style.background = `linear-gradient(90deg, ${colorTint}, ${highlightColor})`;
    }

    // A thick outline drawn in highlightLayer (above both the county fills
    // and the white state borders) for whichever county is under the
    // pointer — a plain CSS :hover stroke on the county path itself would
    // render *under* the state-outline layer at a state border.
    function showHoverOutline(feature) {
      highlightLayer.selectAll(".county-hover-outline")
        .data([feature])
        .join("path")
        .attr("class", "county-hover-outline")
        .attr("d", path);
    }

    function hideHoverOutline() {
      highlightLayer.selectAll(".county-hover-outline").remove();
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
    let selectedStateFips = null;
    let selectedRegionKey = null;

    // Whether a county falls outside the selected state/region — faded out
    // (fill mixed toward white), not just its normal group color, so the
    // fade is visible no matter what color the county would otherwise be.
    function isOutOfScope(row) {
      if (!row) return false;
      if (selectedStateFips) return row.stateFips !== selectedStateFips;
      if (selectedRegionKey) return !REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips);
      return false;
    }

    const OUT_OF_SCOPE_FADE_MIX = 0.88;

    function updateTableHeaders() {
      const groupLabel = escapeHTML(GROWTH_GROUPS[groupKey].label);
      if (tableColStartPop) tableColStartPop.innerHTML = `${groupLabel}<br>population (${currentStartYear})`;
      if (tableColEndPop) tableColEndPop.innerHTML = `${groupLabel}<br>population (${currentEndYear})`;
    }

    function updateFills(startYear, endYear) {
      currentStartYear = startYear;
      currentEndYear = endYear;
      updateTableHeaders();

      dominantByFips = new Map(countyRows.map(row =>
        [row.fips, computeDominantGroup(row, startYear, endYear)]
      ));

      // The color scale's max is scoped to the selected state/region (like
      // the main map) so the most extreme county *in view* always reads as
      // the darkest color, rather than being washed out by a nationwide max.
      const geographyRows = countyRows.filter(row => {
        if (selectedStateFips) return row.stateFips === selectedStateFips;
        if (selectedRegionKey) return REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips);
        return true;
      });

      const dominantChanges = geographyRows
        .map(row => dominantByFips.get(row.fips))
        .filter(d => d.dominantChange > 0 && d.dominantGroup === groupKey)
        .map(d => d.dominantChange);
      const maxDominantChange = d3.max(dominantChanges) || 1;

      function fillFor(fips) {
        const dominance = dominantByFips.get(fips);
        const baseColor = (!dominance || dominance.dominantChange <= 0 || dominance.dominantGroup !== groupKey)
          ? mutedColor
          : colorRamp(Math.min(dominance.dominantChange / maxDominantChange, 1));

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
        statusText.textContent = `${d3.format(",")(dominantChanges.length)} counties${geographySuffix} where ${groupLabel} was the largest source of population growth, ${startYear}–${endYear}`;
      }

      updateTable();
    }

    // Table + CSV export — same rows either way: every in-scope county
    // where the page's own group is the largest source of growth, sorted
    // by that group's change, largest first.
    function computeTableRows() {
      return countyRows
        .filter(row => !isOutOfScope(row))
        .map(row => ({ row, dominance: dominantByFips.get(row.fips) }))
        .filter(({ dominance }) => dominance?.dominantGroup === groupKey)
        .sort((a, b) => (b.dominance?.dominantChange ?? -Infinity) - (a.dominance?.dominantChange ?? -Infinity));
    }

    function updateTable() {
      if (!tableBody || tableWrap?.hidden) return;

      const rows = computeTableRows();

      if (!rows.length) {
        tableBody.innerHTML = `
          <tr><td colspan="7" class="county-table-empty">No counties match the current filters.</td></tr>
        `;
        return;
      }

      tableBody.innerHTML = rows.map(({ row, dominance }) => {
        const groupLabelText = dominance?.dominantGroup ? GROWTH_GROUPS[dominance.dominantGroup].label : "None";
        const totalPopulation = row.values.total?.[currentEndYear];
        const startGroupPopulation = row.values[groupKey]?.[currentStartYear];
        const endGroupPopulation = row.values[groupKey]?.[currentEndYear];
        return `
          <tr>
            <td>${escapeHTML(row.countyName)}</td>
            <td>${escapeHTML(row.stateName)}</td>
            <td>${escapeHTML(groupLabelText)}</td>
            <td class="numeric">${Number.isFinite(dominance?.dominantChange) ? d3.format("+,")(dominance.dominantChange) : "N/A"}</td>
            <td class="numeric">${Number.isFinite(totalPopulation) ? d3.format(",")(totalPopulation) : "N/A"}</td>
            <td class="numeric">${Number.isFinite(startGroupPopulation) ? d3.format(",")(startGroupPopulation) : "N/A"}</td>
            <td class="numeric">${Number.isFinite(endGroupPopulation) ? d3.format(",")(endGroupPopulation) : "N/A"}</td>
          </tr>
        `;
      }).join("");
    }

    if (tableToggle && tableWrap) {
      tableToggle.addEventListener("click", () => {
        const isHidden = tableWrap.hidden;
        tableWrap.hidden = !isHidden;
        tableToggle.textContent = isHidden ? "Hide table" : "Show table";
        tableToggle.setAttribute("aria-expanded", String(isHidden));
        if (isHidden) updateTable();
      });
    }

    if (tableExport) {
      tableExport.addEventListener("click", () => {
        const rows = computeTableRows();
        const groupLabel = GROWTH_GROUPS[groupKey].label;
        const header = [
          "County", "State", "Largest group", "Change", `Total population (${currentEndYear})`,
          `${groupLabel} population (${currentStartYear})`, `${groupLabel} population (${currentEndYear})`
        ];

        const lines = [header, ...rows.map(({ row, dominance }) => [
          row.countyName,
          row.stateName,
          dominance?.dominantGroup ? GROWTH_GROUPS[dominance.dominantGroup].label : "None",
          Number.isFinite(dominance?.dominantChange) ? dominance.dominantChange : "",
          row.values.total?.[currentEndYear] ?? "",
          row.values[groupKey]?.[currentStartYear] ?? "",
          row.values[groupKey]?.[currentEndYear] ?? ""
        ])].map(fields => fields.map(csvField).join(",")).join("\r\n");

        const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${groupKey}-growth-${currentStartYear}-${currentEndYear}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }

    function showTooltip(event, feature) {
      const fips = featureFips(feature);
      const row = countyByFips.get(fips);
      if (!row) return;

      if (
        (selectedStateFips && row.stateFips !== selectedStateFips) ||
        (selectedRegionKey && !REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips))
      ) {
        hideTooltip();
        return;
      }

      showHoverOutline(feature);

      const ownChange = row.values[groupKey]?.[currentEndYear] - row.values[groupKey]?.[currentStartYear];
      const changesList = `<strong>${escapeHTML(GROWTH_GROUPS[groupKey].label)}: ${d3.format("+,")(ownChange)}</strong>`;

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
      hideHoverOutline();
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
        updateFills(Number(startSelect.value), Number(endSelect.value));
      });
      endSelect.addEventListener("change", () => {
        updateYearOptionAvailability();
        hideTooltip();
        updateFills(Number(startSelect.value), Number(endSelect.value));
      });
    }

    // State/region dropdowns — pan+zoom to the selected geography and scope
    // the color scale to it, same behavior as the main map.
    const ZOOM_TRANSITION_DURATION_MS = 650;
    const ZOOM_RESET_DURATION_MS = 550;

    function zoomToStateFips(stateFipsList) {
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
    }

    function selectState(stateFips) {
      selectedStateFips = stateFips;
      if (stateFips) selectedRegionKey = null;
      if (stateSelect) stateSelect.value = stateFips || "";
      if (regionSelect) regionSelect.value = "";

      zoomToStateFips(stateFips ? [stateFips] : []);
      updateFills(currentStartYear, currentEndYear);
    }

    function selectRegion(regionKey) {
      selectedRegionKey = regionKey;
      if (regionKey) selectedStateFips = null;
      if (regionSelect) regionSelect.value = regionKey || "";
      if (stateSelect) stateSelect.value = "";

      const stateFipsList = regionKey ? Array.from(REGION_STATE_FIPS[regionKey]) : [];
      zoomToStateFips(stateFipsList);
      updateFills(currentStartYear, currentEndYear);
    }

    if (stateSelect) {
      Object.entries(STATE_FIPS_TO_ABBR)
        .map(([fips, abbreviation]) => ({ fips, abbreviation }))
        .sort((a, b) => d3.ascending(STATE_NAMES[a.abbreviation], STATE_NAMES[b.abbreviation]))
        .forEach(state => stateSelect.add(new Option(STATE_NAMES[state.abbreviation], state.fips)));

      stateSelect.addEventListener("change", () => {
        hideTooltip();
        selectState(stateSelect.value || null);
      });
    }

    if (regionSelect) {
      Object.entries(REGIONS).forEach(([regionKey, region]) => {
        regionSelect.add(new Option(region.label, regionKey));
      });

      regionSelect.addEventListener("change", () => {
        hideTooltip();
        selectRegion(regionSelect.value || null);
      });
    }

    updateFills(DEFAULT_START_YEAR, DEFAULT_END_YEAR);

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
