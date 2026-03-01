const COLORS = [
  "rgb(59, 130, 246)",
  "rgb(34, 197, 94)",
  "rgb(239, 68, 68)",
  "rgb(168, 85, 247)",
  "rgb(249, 115, 22)",
  "rgb(20, 184, 166)",
];

document.addEventListener("DOMContentLoaded", () => {
  const canvases = document.querySelectorAll("canvas[data-collector]");
  canvases.forEach(initChart);
});

async function initChart(canvas) {
  const siteId = canvas.dataset.site;
  const collector = canvas.dataset.collector;
  const metrics = canvas.dataset.metrics.split(",");

  try {
    const res = await fetch(`/api/stats/${siteId}/${collector}`);
    const json = await res.json();

    if (!json.data || json.data.length === 0) {
      canvas.parentElement.innerHTML += "<p><em>No data available yet.</em></p>";
      return;
    }

    const labels = json.data.map((row) => row.date);
    const datasets = metrics.map((metric, i) => ({
      label: metric.replace(/_/g, " "),
      data: json.data.map((row) => row[metric] ?? 0),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + "20",
      tension: 0.3,
      fill: false,
    }));

    new Chart(canvas, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { display: true, title: { display: false } },
          y: { display: true, beginAtZero: true },
        },
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  } catch (err) {
    console.error(`Failed to load chart for ${collector}:`, err);
  }
}

async function triggerRun() {
  const btn = document.getElementById("run-btn");
  btn.disabled = true;
  btn.textContent = "Running...";
  btn.setAttribute("aria-busy", "true");

  try {
    const res = await fetch("/api/run", { method: "POST" });
    const json = await res.json();
    if (json.success) {
      btn.textContent = "Done!";
      setTimeout(() => location.reload(), 1500);
    } else {
      btn.textContent = "Failed";
      alert("Run failed: " + (json.error || "Unknown error"));
    }
  } catch (err) {
    btn.textContent = "Error";
    alert("Request failed: " + err.message);
  } finally {
    btn.setAttribute("aria-busy", "false");
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Run Now";
    }, 3000);
  }
}
