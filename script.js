document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  const apiKey = document.getElementById("apiKey").value;
  fetchPageSpeedInsights(url, apiKey);
  setInterval(() => fetchPageSpeedInsights(url, apiKey), 300000);
});

function fetchPageSpeedInsights(url, apiKey) {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&key=${apiKey}`;

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
