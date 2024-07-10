document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  fetchPageSpeedInsights(url);
  setInterval(() => fetchPageSpeedInsights(url), 300000); // Оновлення кожні 5 хвилин
});

function fetchPageSpeedInsights(url) {
  const apiUrl = `/api/pagespeed?url=${encodeURIComponent(url)}`;

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
    })
    .catch((error) => console.error("Error:", error));
}
