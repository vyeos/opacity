const list = document.getElementById("signalList");
const refreshBtn = document.getElementById("refreshBtn");
const template = document.getElementById("signalTemplate");

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value || "unknown";
  }
}

function renderSignals(signals) {
  list.innerHTML = "";

  if (!signals.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No signals yet. Run your worker to collect feeds.";
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

    list.appendChild(node);
  }
}

async function refresh() {
  try {
    const signals = await window.opacity.listSignals(40);
    renderSignals(signals);
  } catch (error) {
    list.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `Failed to load signals: ${error.message || error}`;
    list.appendChild(empty);
  }
}

refreshBtn.addEventListener("click", refresh);
refresh();
setInterval(refresh, 30000);
