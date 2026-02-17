const list = document.getElementById("signalList");
const filters = document.getElementById("filters");
const refreshBtn = document.getElementById("refreshBtn");
const quitBtn = document.getElementById("quitBtn");
const template = document.getElementById("signalTemplate");

let allSignals = [];
let activeSource = "all";

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || "unknown";
  }
}

function applyFilter() {
  if (activeSource === "all") return allSignals;
  return allSignals.filter((signal) => signal.source === activeSource);
}

function renderSignals() {
  const signals = applyFilter();
  list.innerHTML = "";

  if (!signals.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No signals for this source yet.";
    list.appendChild(empty);
    return;
  }

  for (const signal of signals) {
    const node = template.content.cloneNode(true);
    node.querySelector(".source").textContent = signal.source.toUpperCase();
    node.querySelector(".date").textContent = formatDate(signal.publishedAt);
    node.querySelector(".title").textContent = signal.title;
    node.querySelector(".snippet").textContent = signal.snippet || "No description.";

    const link = node.querySelector(".link");
    link.href = signal.url;
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await window.opacity.openExternal(signal.url);
    });

    const removeBtn = node.querySelector(".remove-btn");
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      const removed = await window.opacity.hideSignal(signal.id);
      if (removed) {
        allSignals = allSignals.filter((item) => item.id !== signal.id);
        renderFilters();
        renderSignals();
      } else {
        removeBtn.disabled = false;
      }
    });

    list.appendChild(node);
  }
}

function renderFilters() {
  filters.innerHTML = "";

  const sourceCounts = allSignals.reduce(
    (acc, signal) => {
      acc[signal.source] = (acc[signal.source] || 0) + 1;
      return acc;
    },
    { all: allSignals.length }
  );

  for (const [source, count] of Object.entries(sourceCounts)) {
    const btn = document.createElement("button");
    btn.className = `filter-btn${activeSource === source ? " active" : ""}`;
    btn.textContent = `${source.toUpperCase()} (${count})`;
    btn.addEventListener("click", () => {
      activeSource = source;
      renderFilters();
      renderSignals();
    });
    filters.appendChild(btn);
  }
}

async function refresh() {
  try {
    allSignals = await window.opacity.listSignals(40);

    if (activeSource !== "all" && !allSignals.some((signal) => signal.source === activeSource)) {
      activeSource = "all";
    }

    renderFilters();
    renderSignals();
  } catch (error) {
    list.innerHTML = "";
    filters.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `Failed to load signals: ${error.message || error}`;
    list.appendChild(empty);
  }
}

refreshBtn.addEventListener("click", refresh);
quitBtn.addEventListener("click", async () => {
  await window.opacity.quitApp();
});
refresh();
setInterval(refresh, 30000);
