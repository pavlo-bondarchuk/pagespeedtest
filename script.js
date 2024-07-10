document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  const apiKey = document.getElementById("apiKey").value;
  const strategy = document.getElementById("strategy").value;
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");

  loadingSpinner.classList.remove("d-none"); // Показати спіннер
  statusMessage.innerHTML = ""; // Очистити повідомлення

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
      loadingSpinner.classList.add("d-none"); // Приховати спіннер
      statusMessage.innerHTML =
        '<div class="alert alert-success" role="alert">Done</div>'; // Показати повідомлення про успіх
    })
    .catch((error) => {
      console.error("Error:", error);
      loadingSpinner.classList.add("d-none"); // Приховати спіннер у разі помилки
      statusMessage.innerHTML =
        '<div class="alert alert-danger" role="alert">Error</div>'; // Показати повідомлення про помилку
    });
}
