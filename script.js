let intervalId;
const countdownElement = document.getElementById("countdown");

document.getElementById("urlForm").addEventListener("submit", function (event) {
  event.preventDefault();
  startTest();
});

document.getElementById("strategy").addEventListener("change", function () {
  const strategyLabel = document.getElementById("strategyLabel");
  strategyLabel.innerText = this.checked ? "Desktop Test" : "Mobile Test";
});

function startTest() {
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
  statusMessage.classList.add("d-none");
  submitButton.disabled = true; // Заблокувати кнопку

  // Очистити результати
  document.getElementById("performanceScore").innerText = "";
  document.getElementById("screenshotContainer").classList.add("d-none");
  document.getElementById("screenshot").src = "";

  clearInterval(intervalId);
  fetchPageSpeedInsights(url, apiKey, strategy, submitButton, interval);
}

function fetchPageSpeedInsights(url, apiKey, strategy, submitButton, interval) {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url
  )}&key=${apiKey}&strategy=${strategy}`;

  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      const score = data.lighthouseResult.categories.performance.score * 100;
      const fcp =
        data.lighthouseResult.audits["first-contentful-paint"].numericValue ||
        "error";
      const lcp =
        data.lighthouseResult.audits["largest-contentful-paint"].numericValue ||
        "error";
      const tbt =
        data.lighthouseResult.audits["total-blocking-time"].numericValue ||
        "error";
      const cls =
        data.lighthouseResult.audits["cumulative-layout-shift"].numericValue ||
        "error";
      const screenshot = data.lighthouseResult.audits["final-screenshot"]
        ? data.lighthouseResult.audits["final-screenshot"].details.data
        : "";

      const currentTime = new Date().toLocaleTimeString();
      const reportId = data.lighthouseResult.id; // Отримання ідентифікатора звіту з відповіді API
      const testUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(
        url
      )}&form_factor=${strategy}&utm_source=PSI&utm_medium=report_card&utm_campaign=progressive-web-apps&utm_term=show-latest&report_id=${reportId}`;

      document.getElementById(
        "performanceScore"
      ).innerText = `Performance Score: ${score}`;
      const metricsTableBody = document.getElementById("metricsTableBody");
      const newRow = `
                <tr>
                    <td><a href="${testUrl}" target="_blank">${currentTime}</a></td>
                    <td class="${getPerformanceClass(fcp, "fcp")}">${fcp}</td>
                    <td class="${getPerformanceClass(lcp, "lcp")}">${lcp}</td>
                    <td class="${getPerformanceClass(tbt, "tbt")}">${tbt}</td>
                    <td class="${getPerformanceClass(cls, "cls")}">${cls}</td>
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
      statusMessage.classList.remove("d-none");
      submitButton.disabled = false; // Розблокувати кнопку
      startCountdown(interval);
    })
    .catch((error) => {
      console.error("Error:", error);
      loadingSpinner.classList.add("d-none");
      statusMessage.innerHTML =
        '<div class="alert alert-danger" role="alert">Error</div>';
      statusMessage.classList.remove("d-none");
      submitButton.disabled = false; // Розблокувати кнопку у разі помилки
      startCountdown(interval); // Запустити таймер знову у разі помилки
    });
}

function getPerformanceClass(value, metric) {
  if (value === "error") {
    return "error-cell";
  }

  switch (metric) {
    case "fcp":
    case "lcp":
      if (value <= 1000) return "fast";
      if (value <= 2500) return "average";
      return "slow";
    case "tbt":
      if (value <= 300) return "fast";
      if (value <= 600) return "average";
      return "slow";
    case "cls":
      if (value <= 0.1) return "fast";
      if (value <= 0.25) return "average";
      return "slow";
    default:
      return "";
  }
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
      document.querySelector('button[type="submit"]').click();
    }
  }

  updateCountdown();
  intervalId = setInterval(updateCountdown, 1000);
}
