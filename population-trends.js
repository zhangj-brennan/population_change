// ---------------------------------------------------------------------------
// County population trend chart (population-trends.html). Plots every
// county's population, 2020-2025, as its own line; a dropdown switches which
// population series (total, or one racial/ethnic subgroup) the lines track.
// ---------------------------------------------------------------------------
const FILES = {
  population: "data/Vintage 2025 counties race & ethnicity 1.csv",
  urbanRural: "cdc_urban_rural.csv"
};

// NCHS 2023 urban-rural classification scheme, in order from most urban to
// most rural — same order/labels as the "2023 Code" column in the CDC file.
const URBAN_RURAL_TYPES = [
  "1 - Large central metro",
  "2 - Large fringe metro",
  "3 - Medium metro",
  "4 - Small metro",
  "5 - Micropolitan",
  "6 - Noncore"
];

const YEAR_CODE_TO_LABEL = {
  1: 2020,
  3: 2021,
  4: 2022,
  5: 2023,
  6: 2024,
  7: 2025
};

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

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

// Same subgroup definitions as growth-map.js: Male/Female fields summed
// because the source file's own "Total" columns are inconsistently filled.
const POPULATION_GROUPS = {
  total: { label: "Total population", fields: null },
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

  for (const [groupKey, group] of Object.entries(POPULATION_GROUPS)) {
    if (!group.fields) continue;
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

// One record per county, keeping every subgroup's population for every year.
function buildCountyRecords(populationRows, urbanRuralByFips) {
  const grouped = d3.group(populationRows.filter(Boolean), row => row.fips);
  const records = [];

  grouped.forEach((rows, fips) => {
    const byYear = new Map(rows.map(row => [row.year, row]));
    const referenceRow = rows[0];
    if (!referenceRow) return;

    const values = {};
    Object.keys(POPULATION_GROUPS).forEach(groupKey => {
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
      urbanRuralType: urbanRuralByFips.get(fips) ?? null,
      values
    });
  });

  return records;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Distance (in chart pixels) beyond which the cursor no longer counts as
// hovering any line, so moving into empty space clears the highlight.
const HOVER_DISTANCE_PX = 24;

const INCREASE_COLOR = "#711471";
const DECREASE_COLOR = "#F5A623";
const NO_CHANGE_COLOR = "#999";

function lineColor(finalValue) {
  if (finalValue > 0) return INCREASE_COLOR;
  if (finalValue < 0) return DECREASE_COLOR;
  return NO_CHANGE_COLOR;
}

async function renderPopulationTrendChart() {
  const loading = document.querySelector("#loading");
  const errorBox = document.querySelector("#error");
  const visualization = document.querySelector("#visualization");
  const svg = d3.select("#trend-chart");
  const chartWrap = document.querySelector("#chart-wrap");
  const tooltip = d3.select("#tooltip");
  const seriesSelect = document.querySelector("#series-select");
  const stateSelect = document.querySelector("#state-select");
  const regionSelect = document.querySelector("#region-select");
  const urbanRuralSelect = document.querySelector("#urban-rural-select");
  const statusText = document.querySelector("#status-text");

  try {
    const [populationRows, urbanRuralRows] = await Promise.all([
      d3.csv(FILES.population, parsePopulationRow),
      d3.csv(FILES.urbanRural)
    ]);
    const urbanRuralByFips = new Map(
      urbanRuralRows.map(row => [row.Location.trim(), row["2023 Code"]])
    );
    const countyRows = buildCountyRecords(populationRows, urbanRuralByFips);
    const countyByFips = new Map(countyRows.map(row => [row.fips, row]));

    loading.hidden = true;
    visualization.hidden = false;

    const width = 975;
    const height = 560;
    const margin = { top: 16, right: 24, bottom: 72, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`);
    const root = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleLinear().domain([2020, 2025]).range([0, innerWidth]);
    const yScale = d3.scaleLinear().range([innerHeight, 0]);

    const xAxisG = root.append("g")
      .attr("class", "trend-axis trend-axis-x")
      .attr("transform", `translate(0,${innerHeight})`);
    const yAxisG = root.append("g").attr("class", "trend-axis trend-axis-y");

    const linesGroup = root.append("g").attr("class", "trend-lines");
    const highlightPath = root.append("path").attr("class", "trend-line-highlight").attr("fill", "none");
    const yearCountsGroup = root.append("g").attr("class", "trend-year-counts");

    const lineGen = d3.line()
      .defined(d => Number.isFinite(d.value))
      .x(d => xScale(d.year))
      .y(d => yScale(d.value));

    // Value plotted is the subgroup's share of the county's total population
    // (0-1), minus that same share in 2020 — every line starts at 0 in 2020
    // and shows the percentage-point change since then, so counties of very
    // different sizes are comparable on one y-axis.
    function seriesForRow(row, groupKey) {
      const shareSeries = YEARS.map(year => {
        const total = row.values.total?.[year];
        const subgroup = row.values[groupKey]?.[year];
        return Number.isFinite(total) && total > 0 && Number.isFinite(subgroup)
          ? subgroup / total
          : undefined;
      });

      const baseline = shareSeries[0];
      return YEARS.map((year, i) => ({
        year,
        value: Number.isFinite(baseline) && Number.isFinite(shareSeries[i])
          ? shareSeries[i] - baseline
          : undefined
      }));
    }

    let pathByFips = new Map();
    let colorByFips = new Map();
    let seriesByFips = new Map();
    let sortedByYear = [];
    let currentGroupKey = "white";
    let selectedStateFips = null;
    let selectedRegionKey = null;
    let selectedUrbanRuralType = null;

    function inScope(row) {
      if (selectedStateFips && row.stateFips !== selectedStateFips) return false;
      if (selectedRegionKey && !REGION_STATE_FIPS[selectedRegionKey].has(row.stateFips)) return false;
      if (selectedUrbanRuralType && row.urbanRuralType !== selectedUrbanRuralType) return false;
      return true;
    }

    function render(groupKey) {
      currentGroupKey = groupKey;
      const groupLabel = POPULATION_GROUPS[groupKey].label;
      const visibleRows = countyRows.filter(inScope);

      seriesByFips = new Map();
      const allValues = [];

      visibleRows.forEach(row => {
        const series = seriesForRow(row, groupKey);
        series.forEach(d => { if (Number.isFinite(d.value)) allValues.push(d.value); });
        seriesByFips.set(row.fips, series);
      });

      // Domain is symmetric around zero — so 0 always sits at the vertical
      // center of the chart — but rescales to the current filtered data's
      // range each render. This has to happen before lineGen() is called
      // below, since lineGen reads yScale's domain at call time — computing
      // paths first and rescaling after would draw every line against the
      // previous render's domain.
      const maxAbs = d3.max(allValues, Math.abs) || 0.01;
      yScale.domain([-maxAbs, maxAbs]).nice();
      const niceMaxAbs = Math.max(...yScale.domain().map(Math.abs));
      yScale.domain([-niceMaxAbs, niceMaxAbs]);

      xAxisG.call(
        d3.axisBottom(xScale).tickValues(YEARS).tickFormat(d3.format("d")).tickSize(-innerHeight)
      );
      yAxisG.call(
        d3.axisLeft(yScale).ticks(6).tickFormat(d3.format("+.2%")).tickSize(-innerWidth)
      );

      pathByFips = new Map();
      colorByFips = new Map();
      visibleRows.forEach(row => {
        const series = seriesByFips.get(row.fips);
        pathByFips.set(row.fips, lineGen(series));
        colorByFips.set(row.fips, lineColor(series[series.length - 1].value));
      });

      const lineSelection = linesGroup.selectAll("path.trend-line-base")
        .data(visibleRows, d => d.fips);

      lineSelection.enter()
        .append("path")
        .attr("class", "trend-line-base")
        .attr("fill", "none")
        .merge(lineSelection)
        .attr("d", d => pathByFips.get(d.fips))
        .attr("stroke", d => colorByFips.get(d.fips));

      lineSelection.exit().remove();

      const yearCounts = [];
      sortedByYear = YEARS.map((year, yearIndex) => {
        const arr = [];
        let increase = 0;
        let decrease = 0;
        let noChange = 0;
        visibleRows.forEach(row => {
          const value = seriesByFips.get(row.fips)[yearIndex].value;
          if (Number.isFinite(value)) {
            arr.push({ fips: row.fips, y: yScale(value) });
            if (value > 0) increase++;
            else if (value < 0) decrease++;
            else noChange++;
          }
        });
        arr.sort((a, b) => a.y - b.y);
        yearCounts.push({ year, increase, decrease, noChange });
        return arr;
      });

      // 2020 is every county's baseline (always 0/0), so it's skipped here.
      const yearCountSelection = yearCountsGroup.selectAll("g.trend-year-count")
        .data(yearCounts.filter(d => d.year !== 2020), d => d.year);

      const yearCountEnter = yearCountSelection.enter()
        .append("g")
        .attr("class", "trend-year-count");
      yearCountEnter.append("text").attr("class", "trend-year-count-increase");
      yearCountEnter.append("text").attr("class", "trend-year-count-decrease");
      yearCountEnter.append("text").attr("class", "trend-year-count-nochange");

      const yearCountMerged = yearCountEnter.merge(yearCountSelection)
        .attr("transform", d => `translate(${xScale(d.year)},0)`);

      yearCountMerged.select(".trend-year-count-increase")
        .attr("y", innerHeight + 30)
        .text(d => `▲ ${d.increase.toLocaleString()}`);

      yearCountMerged.select(".trend-year-count-decrease")
        .attr("y", innerHeight + 42)
        .text(d => `▼ ${d.decrease.toLocaleString()}`);

      yearCountMerged.select(".trend-year-count-nochange")
        .attr("y", innerHeight + 54)
        .text(d => `No change: ${d.noChange.toLocaleString()}`);

      yearCountSelection.exit().remove();

      lastHoveredFips = null;
      highlightPath.style("opacity", 0);
      tooltip.style("opacity", 0).attr("aria-hidden", "true");

      const geographyLabel = selectedStateFips
        ? STATE_NAMES[STATE_FIPS_TO_ABBR[selectedStateFips]]
        : selectedRegionKey
          ? REGIONS[selectedRegionKey].label
          : null;
      const geographySuffix = geographyLabel ? ` in ${geographyLabel}` : "";
      const urbanRuralSuffix = selectedUrbanRuralType
        ? ` (${selectedUrbanRuralType.replace(/^\d+\s*-\s*/, "")})`
        : "";
      statusText.textContent =
        `${visibleRows.length.toLocaleString()} counties${geographySuffix}${urbanRuralSuffix} — change in ${groupLabel} share of total population since 2020`;
    }

    function nearestCounty(mouseX, mouseY) {
      const yearIndex = Math.max(0, Math.min(YEARS.length - 1, Math.round(xScale.invert(mouseX) - 2020)));
      const arr = sortedByYear[yearIndex];
      if (!arr.length) return null;

      const insertion = d3.bisector(d => d.y).left(arr, mouseY);
      const candidates = [arr[insertion - 1], arr[insertion]].filter(Boolean);
      if (!candidates.length) return null;

      const nearest = candidates.reduce((best, candidate) =>
        Math.abs(candidate.y - mouseY) < Math.abs(best.y - mouseY) ? candidate : best
      );

      return Math.abs(nearest.y - mouseY) <= HOVER_DISTANCE_PX ? nearest.fips : null;
    }

    // getBoundingClientRect() (and d3.pointer(), which calls
    // getScreenCTM() internally) forces the browser to run layout
    // synchronously. With thousands of <path> elements in the chart, doing
    // that on every single mousemove is what causes the lag — so the rect
    // is measured once and cached, refreshed only on resize/scroll and when
    // a hover starts, and mouse coordinates are converted with plain
    // arithmetic instead.
    let chartRect = null;
    let lastHoveredFips = null;

    function refreshChartRect() {
      chartRect = chartWrap.getBoundingClientRect();
    }

    function pointFromEvent(event) {
      const scaleX = width / chartRect.width;
      const scaleY = height / chartRect.height;
      const svgX = (event.clientX - chartRect.left) * scaleX;
      const svgY = (event.clientY - chartRect.top) * scaleY;
      return [svgX - margin.left, svgY - margin.top];
    }

    function positionTooltip(event) {
      const x = event.clientX - chartRect.left;
      const y = event.clientY - chartRect.top;
      tooltip.style("left", `${x + 14}px`).style("top", `${y + 14}px`);
    }

    function hideHover() {
      lastHoveredFips = null;
      highlightPath.style("opacity", 0);
      tooltip.style("opacity", 0).attr("aria-hidden", "true");
    }

    function handleMouseMove(event) {
      const [mouseX, mouseY] = pointFromEvent(event);
      const fips = nearestCounty(mouseX, mouseY);

      if (!fips) {
        hideHover();
        return;
      }

      if (fips !== lastHoveredFips) {
        lastHoveredFips = fips;
        const row = countyByFips.get(fips);
        highlightPath
          .attr("d", pathByFips.get(fips))
          .style("opacity", 1)
          .raise();

        const lines = seriesByFips.get(fips)
          .map(d => `${d.year}: ${Number.isFinite(d.value) ? d3.format("+.2%")(d.value) : "N/A"}`)
          .join("<br>");

        tooltip.style("opacity", 1).attr("aria-hidden", "false");
        tooltip.select("#tooltip-content").html(`
          <strong>${escapeHTML(row.countyName)}, ${escapeHTML(row.stateName)}</strong><br>
          ${lines}
        `);
      }

      positionTooltip(event);
    }

    // Coalesce bursts of mousemove events (high-poll-rate mice/trackpads
    // can fire far more often than the screen repaints) into at most one
    // update per animation frame.
    let pendingEvent = null;
    let rafScheduled = false;

    function scheduleMouseMove(event) {
      pendingEvent = event;
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        handleMouseMove(pendingEvent);
      });
    }

    refreshChartRect();
    window.addEventListener("resize", refreshChartRect);

    root.append("rect")
      .attr("class", "trend-overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .on("mouseenter", refreshChartRect)
      .on("mousemove", scheduleMouseMove)
      .on("mouseleave", hideHover);

    if (seriesSelect) {
      seriesSelect.addEventListener("change", () => render(seriesSelect.value));
    }

    function selectState(stateFips) {
      selectedStateFips = stateFips;
      if (stateFips) selectedRegionKey = null;
      if (stateSelect) stateSelect.value = stateFips || "";
      if (regionSelect) regionSelect.value = "";
      render(currentGroupKey);
    }

    function selectRegion(regionKey) {
      selectedRegionKey = regionKey;
      if (regionKey) selectedStateFips = null;
      if (regionSelect) regionSelect.value = regionKey || "";
      if (stateSelect) stateSelect.value = "";
      render(currentGroupKey);
    }

    if (stateSelect) {
      Object.entries(STATE_FIPS_TO_ABBR)
        .map(([fips, abbreviation]) => ({ fips, abbreviation }))
        .sort((a, b) => d3.ascending(STATE_NAMES[a.abbreviation], STATE_NAMES[b.abbreviation]))
        .forEach(state => stateSelect.add(new Option(STATE_NAMES[state.abbreviation], state.fips)));

      stateSelect.addEventListener("change", () => {
        hideHover();
        selectState(stateSelect.value || null);
      });
    }

    if (regionSelect) {
      Object.entries(REGIONS).forEach(([regionKey, region]) => {
        regionSelect.add(new Option(region.label, regionKey));
      });

      regionSelect.addEventListener("change", () => {
        hideHover();
        selectRegion(regionSelect.value || null);
      });
    }

    if (urbanRuralSelect) {
      URBAN_RURAL_TYPES.forEach(type => {
        urbanRuralSelect.add(new Option(type.replace(/^\d+\s*-\s*/, ""), type));
      });

      urbanRuralSelect.addEventListener("change", () => {
        hideHover();
        selectedUrbanRuralType = urbanRuralSelect.value || null;
        render(currentGroupKey);
      });
    }

    render("white");
  } catch (error) {
    loading.hidden = true;
    errorBox.hidden = false;
    errorBox.textContent = "Something went wrong loading the population data.";
    console.error(error);
  }
}

renderPopulationTrendChart();
