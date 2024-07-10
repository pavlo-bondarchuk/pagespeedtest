document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  const apiKey = document.getElementById("apiKey").value;
  const strategy = document.getElementById("strategy").value;
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");

  // Показати спіннер і очистити повідомлення
  loadingSpinner.classList.remove("d-none");
  statusMessage.innerHTML = "";

  // Очистити результати
  document.getElementById("performanceScore").innerText = "";
  const metricsTableBody = document.getElementById("metricsTableBody");
  metricsTableBody.innerHTML = "";
  document.getElementById("screenshotContainer").classList.add("d-none");
  document.getElementById("screenshot").src = "";

  fetchPageSpeedInsights(url, apiKey, strategy);
  setInterval(() => fetchPageSpeedInsights(url, apiKey, strategy), 300000); // Оновлення кожні 5 хвилин
});

function fetchPageSpeedInsights(url, apiKey, strategy) {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&key=${apiKey}&strategy=${strategy}`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      const score = data.lighthouseResult.categories.performance.score * 100;
      const fcp =
        data.lighthouseResult.audits["first-contentful-paint"].displayValue ||
        "error";
      const lcp =
        data.lighthouseResult.audits["largest-contentful-paint"].displayValue ||
        "error";
      const tbt =
        data.lighthouseResult.audits["total-blocking-time"].displayValue ||
        "error";
      const cls =
        data.lighthouseResult.audits["cumulative-layout-shift"].displayValue ||
        "error";
      const screenshot = data.lighthouseResult.audits["final-screenshot"]
        ? data.lighthouseResult.audits["final-screenshot"].details.data
        : "";

      document.getElementById(
        "performanceScore"
      ).innerText = `Performance Score: ${score}`;
      const metricsTableBody = document.getElementById("metricsTableBody");
      metricsTableBody.innerHTML = `
                <tr>
                    <td class="${
                      fcp === "error" ? "error-cell" : ""
                    }">${fcp}</td>
                    <td class="${
                      lcp === "error" ? "error-cell" : ""
                    }">${lcp}</td>
                    <td class="${
                      tbt === "error" ? "error-cell" : ""
                    }">${tbt}</td>
                    <td class="${
                      cls === "error" ? "error-cell" : ""
                    }">${cls}</td>
                </tr>
            `;
      if (screenshot) {
        document.getElementById("screenshot").src = screenshot;
        document
          .getElementById("screenshotContainer")
          .classList.remove("d-none");
      }
      loadingSpinner.classList.add("d-none");
      statusMessage.innerHTML =
        '<div class="alert alert-success" role="alert">Done</div>';
    })
    .catch((error) => {
      console.error("Error:", error);
      loadingSpinner.classList.add("d-none");
      statusMessage.innerHTML =
        '<div class="alert alert-danger" role="alert">Error</div>';
    });
}
