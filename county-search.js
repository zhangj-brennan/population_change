// ---------------------------------------------------------------------------
// County search typeahead shared by the static maps (growth-map.js,
// components-map.js) — same behavior and markup IDs as main.html's box in
// script.js. Picking a county hands its FIPS to onSelect (the map zooms to
// its state and outlines it); clearing the box calls onClear.
// ---------------------------------------------------------------------------
function wireCountySearch({ rows, onSelect, onClear }) {
  const input = document.querySelector("#county-search-input");
  const clearButton = document.querySelector("#county-search-clear");
  const list = document.querySelector("#county-search-suggestions");
  if (!input || !clearButton || !list) return { reset() {} };

  const index = rows
    .map(row => ({ fips: row.fips, countyName: row.countyName, label: `${row.countyName}, ${row.stateName}` }))
    .sort((a, b) => d3.ascending(a.countyName, b.countyName));

  let results = [];
  let activeIndex = -1;

  function search(query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    return index
      .filter(entry => entry.label.toLowerCase().includes(normalized))
      .sort((a, b) => {
        const aStarts = a.countyName.toLowerCase().startsWith(normalized) ? 0 : 1;
        const bStarts = b.countyName.toLowerCase().startsWith(normalized) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return d3.ascending(a.countyName, b.countyName);
      })
      .slice(0, 8);
  }

  function close() {
    list.hidden = true;
    list.innerHTML = "";
    results = [];
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function choose(entry) {
    input.value = entry.label;
    clearButton.hidden = false;
    close();
    onSelect(entry.fips);
  }

  function render(nextResults) {
    results = nextResults;
    activeIndex = -1;
    list.innerHTML = "";

    if (!results.length) {
      close();
      return;
    }

    results.forEach((entry, i) => {
      const item = document.createElement("li");
      item.id = `county-search-option-${i}`;
      item.className = "county-search-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      item.textContent = entry.label;
      item.addEventListener("mousedown", event => {
        event.preventDefault();
        choose(entry);
      });
      list.appendChild(item);
    });

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function updateActiveOption() {
    const options = list.querySelectorAll(".county-search-option");
    options.forEach((option, i) => {
      const isActive = i === activeIndex;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    if (activeIndex >= 0 && options[activeIndex]) {
      input.setAttribute("aria-activedescendant", options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  input.addEventListener("input", () => {
    clearButton.hidden = !input.value;

    if (!input.value) {
      close();
      onClear();
      return;
    }

    render(search(input.value));
  });

  input.addEventListener("keydown", event => {
    if (!results.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      updateActiveOption();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveOption();
    } else if (event.key === "Enter") {
      if (activeIndex >= 0) {
        event.preventDefault();
        choose(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      close();
    }
  });

  input.addEventListener("blur", () => {
    window.setTimeout(close, 100);
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    clearButton.hidden = true;
    close();
    onClear();
    input.focus();
  });

  // Empties the box without calling onClear — for when the map has already
  // moved on (e.g. the user picked a different state or region).
  return {
    reset() {
      input.value = "";
      clearButton.hidden = true;
      close();
    }
  };
}
