document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  const apiKey = document.getElementById("apiKey").value;
  const strategy = document.getElementById("strategy").value;
  const statusMessage = document.getElementById("statusMessage");

  statusMessage.innerHTML =
    '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';

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
        data.lighthouseResult.audits["first-contentful-paint"].displayValue;
      const lcp =
        data.lighthouseResult.audits["largest-contentful-paint"].displayValue;
      const tbt =
        data.lighthouseResult.audits["total-blocking-time"].displayValue;
      const cls =
        data.lighthouseResult.audits["cumulative-layout-shift"].displayValue;
      const screenshot =
        data.lighthouseResult.audits["final-screenshot"].details.data;

      document.getElementById(
        "performanceScore"
      ).innerText = `Performance Score: ${score}`;
      const metricsTableBody = document.getElementById("metricsTableBody");
      metricsTableBody.innerHTML = `
                <tr>
                    <td>${fcp}</td>
                    <td>${lcp}</td>
                    <td>${tbt}</td>
                    <td>${cls}</td>
                </tr>
            `;
      document.getElementById("screenshot").src = screenshot;
      document.getElementById("screenshotContainer").classList.remove("d-none");
      document.getElementById("statusMessage").innerHTML =
        '<span class="text-success">Done</span>'; // Змінити на "Done"
    })
    .catch((error) => {
      console.error("Error:", error);
      document.getElementById("statusMessage").innerHTML =
        '<span class="text-danger">Error</span>'; // Показати помилку
    });
}
