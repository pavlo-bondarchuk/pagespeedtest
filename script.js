let intervalId;

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
  document.getElementById("screenshotContainer").classList.add("d-none");
  document.getElementById("screenshot").src = "";

  clearInterval(intervalId);
  startCountdown();

  fetchPageSpeedInsights(url, apiKey, strategy);
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

      const currentTime = new Date().toLocaleTimeString();

      document.getElementById(
        "performanceScore"
      ).innerText = `Performance Score: ${score}`;
      const metricsTableBody = document.getElementById("metricsTableBody");
      const newRow = `
                <tr>
                    <td>${currentTime}</td>
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
      metricsTableBody.insertAdjacentHTML("afterbegin", newRow);

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

function startCountdown() {
  const countdownElement = document.getElementById("countdown");
  const duration = 300; // 5 хвилин
  let timeRemaining = duration;

  function updateCountdown() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    countdownElement.innerHTML = `Next test in: ${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
    if (timeRemaining > 0) {
      timeRemaining--;
    } else {
      clearInterval(intervalId);
      const url = document.getElementById("url").value;
      const apiKey = document.getElementById("apiKey").value;
      const strategy = document.getElementById("strategy").value;
      fetchPageSpeedInsights(url, apiKey, strategy);
      startCountdown();
    }
  }

  updateCountdown();
  intervalId = setInterval(updateCountdown, 1000);
}
