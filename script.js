let intervalId;
const countdownElement = document.getElementById("countdown");

document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const url = document.getElementById("url").value;
  const apiKey = document.getElementById("apiKey").value;
  const strategy = document.getElementById("strategy").checked
    ? "desktop"
    : "mobile";
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");
  const submitButton = document.querySelector('button[type="submit"]');
  const interval = parseInt(document.getElementById("interval").value) * 60; // Перевести в секунди

  // Показати спіннер і очистити повідомлення
  loadingSpinner.classList.remove("d-none");
  statusMessage.innerHTML = "";
  submitButton.disabled = true; // Заблокувати кнопку

  // Очистити результати
  document.getElementById("performanceScore").innerText = "";
  document.getElementById("screenshotContainer").classList.add("d-none");
  document.getElementById("screenshot").src = "";

  clearInterval(intervalId);
  fetchPageSpeedInsights(url, apiKey, strategy, submitButton, interval);
});

document.getElementById("strategy").addEventListener("change", function () {
  const strategyLabel = document.getElementById("strategyLabel");
  strategyLabel.innerText = this.checked ? "Desktop Test" : "Mobile Test";
});

function fetchPageSpeedInsights(url, apiKey, strategy, submitButton, interval) {
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
      const testUrl = `https://pagespeed.web.dev/analysis/${encodeURIComponent(
        url
      )}/zcdeimxovo?form_factor=${strategy}`;

      document.getElementById(
        "performanceScore"
      ).innerText = `Performance Score: ${score}`;
      const metricsTableBody = document.getElementById("metricsTableBody");
      const newRow = `
                <tr>
                    <td><a href="${testUrl}" target="_blank">${currentTime}</a></td>
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
      submitButton.disabled = false; // Розблокувати кнопку
      startCountdown(interval);
    })
    .catch((error) => {
      console.error("Error:", error);
      loadingSpinner.classList.add("d-none");
      statusMessage.innerHTML =
        '<div class="alert alert-danger" role="alert">Error</div>';
      submitButton.disabled = false; // Розблокувати кнопку у разі помилки
    });
}

function startCountdown(duration) {
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
      const strategy = document.getElementById("strategy").checked
        ? "desktop"
        : "mobile";
      const interval = parseInt(document.getElementById("interval").value) * 60; // Перевести в секунди
      fetchPageSpeedInsights(
        url,
        apiKey,
        strategy,
        document.querySelector('button[type="submit"]'),
        interval
      );
    }
  }

  updateCountdown();
  intervalId = setInterval(updateCountdown, 1000);
}
