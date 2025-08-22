let intervalId = null;
let isRunning = false;
let mode = "single"; // 'single' | 'multiple'

// ===== Event listeners =====
document.getElementById("urlForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isRunning) return;
  await startTest();
});

document.getElementById("strategy").addEventListener("change", function () {
  document.getElementById("strategyLabel").innerText = this.checked
    ? "Desktop Test"
    : "Mobile Test";
});

document.getElementById("modeToggle").addEventListener("change", function () {
  mode = this.checked ? "multiple" : "single";
  document.getElementById("modeLabel").innerText = this.checked
    ? "Multiple URLs"
    : "Single URL";
  // показувати інтервал тільки в single-режимі
  document
    .getElementById("intervalWrap")
    .classList.toggle("d-none", mode === "multiple");
  // сховати countdown в multiple-режимі
  document
    .getElementById("countdown")
    .classList.toggle("d-none", mode === "multiple");
});

// ===== Main entry =====
async function startTest() {
  let baseUrl = document.getElementById("url").value.trim();
  let apiKey = document.getElementById("apiKey").value.trim();
  const strategy = document.getElementById("strategy").checked
    ? "desktop"
    : "mobile";
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");
  const submitButton = document.querySelector('button[type="submit"]');

  // часта помилка: переплутані поля
  if (/^https?:\/\//i.test(apiKey) && !/^https?:\/\//i.test(baseUrl)) {
    [baseUrl, apiKey] = [apiKey, baseUrl];
    console.warn("Heuristic swap: URL <-> API key");
  }
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = "https://" + baseUrl;

  // UI start
  isRunning = true;
  loadingSpinner.classList.remove("d-none");
  statusMessage.classList.add("d-none");
  submitButton.disabled = true;

  clearInterval(intervalId); // стоп будь-якого попереднього таймера

  if (mode === "single") {
    const interval = parseInt(document.getElementById("interval").value, 10); // seconds
    await runSingleOnce(baseUrl, apiKey, strategy, submitButton, interval);
  } else {
    // multiple
    // прибрати попередню кнопку експорту, якщо була
    const oldBtn = document.getElementById("exportBtn");
    if (oldBtn) oldBtn.remove();
    await runCrawl(baseUrl, apiKey, strategy);
  }

  // UI finish (подальші оновлення робляться всередині режимів)
  loadingSpinner.classList.add("d-none");
  submitButton.disabled = false;
  isRunning = false;
}

// ===== Single URL mode (continuous with countdown) =====
async function runSingleOnce(url, apiKey, strategy, submitButton, interval) {
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");

  try {
    await fetchPageSpeedInsights(url, apiKey, strategy);
    // успіх
    statusMessage.innerHTML =
      '<div class="alert alert-success" role="alert">Done</div>';
    statusMessage.classList.remove("d-none");
  } catch (e) {
    console.error("Single test error:", e);
    statusMessage.innerHTML =
      '<div class="alert alert-danger" role="alert">Error</div>';
    statusMessage.classList.remove("d-none");
  } finally {
    loadingSpinner.classList.add("d-none");
    submitButton.disabled = false;
    // тільки в single-режимі запускаємо таймер автоперезапуску
    if (mode === "single" && interval > 0) {
      startCountdown(interval);
    }
    // прокрутка до таблиці
    scrollToTable();
  }
}

// ===== Multiple URLs mode (sitemap crawl) =====
async function runCrawl(baseUrl, apiKey, strategy) {
  const statusMessage = document.getElementById("statusMessage");
  const tbody = document.getElementById("metricsTableBody");

  let urls = [];
  try {
    urls = await getUrlsFromSitemap(baseUrl);
  } catch (e) {
    console.warn(e);
  }

  if (!urls.length) {
    urls = [baseUrl];
    statusMessage.innerHTML =
      '<div class="alert alert-warning" role="alert">Sitemap not found or blocked by CORS. Running only the start URL.</div>';
    statusMessage.classList.remove("d-none");
  } else {
    statusMessage.classList.add("d-none");
  }

  let done = 0;
  const total = urls.length;
  for (const url of urls) {
    await safePSI(url, apiKey, strategy, tbody);
    done++;
    showProgress(`${done}/${total} processed`);
    await delay(1500);
  }

  showExportButton();
  showProgress("");
  statusMessage.innerHTML = `<div class="alert alert-success" role="alert">Done. Processed ${done} page(s).</div>`;
  statusMessage.classList.remove("d-none");
  scrollToTable();
}

async function safePSI(url, apiKey, strategy, tbody) {
  try {
    await fetchPageSpeedInsights(url, apiKey, strategy);
  } catch (e) {
    console.error("PSI error:", e);
    const currentTime = new Date().toLocaleTimeString();
    tbody.insertAdjacentHTML(
      "afterbegin",
      `<tr>
        <td>${currentTime}</td>
        <td class="error-cell">error</td>
        <td class="error-cell">error</td>
        <td class="error-cell">error</td>
        <td class="error-cell">error</td>
        <td class="error-cell">error</td>
      </tr>`
    );
  }
}

// ===== PSI fetch + render one row (shared by both modes) =====
async function fetchPageSpeedInsights(pageUrl, apiKey, strategy) {
  const tbody = document.getElementById("metricsTableBody");
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    pageUrl
  )}&key=${apiKey}&strategy=${strategy}`;

  const res = await fetch(apiUrl);
  const data = await res.json();

  const audits = data?.lighthouseResult?.audits || {};
  const score = Math.round(
    (data?.lighthouseResult?.categories?.performance?.score || 0) * 100
  );

  const fcpText = audits["first-contentful-paint"]?.displayValue || "error";
  const lcpText = audits["largest-contentful-paint"]?.displayValue || "error";
  const tbtText = audits["total-blocking-time"]?.displayValue || "error";
  const clsText = audits["cumulative-layout-shift"]?.displayValue || "error";

  const fcpNum = audits["first-contentful-paint"]?.numericValue; // ms
  const lcpNum = audits["largest-contentful-paint"]?.numericValue; // ms
  const tbtNum = audits["total-blocking-time"]?.numericValue; // ms
  const clsNum = audits["cumulative-layout-shift"]?.numericValue; // unitless

  const reportId = data?.lighthouseResult?.id || "";
  const testUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(
    pageUrl
  )}&form_factor=${strategy}&report_id=${reportId}`;

  const currentTime = new Date().toLocaleTimeString();

  const rowHtml = `
    <tr>
      <td><a href="${testUrl}" target="_blank">${currentTime}</a></td>
      <td>${score}</td>
      <td class="${classByMetric(fcpText, "fcp", fcpNum)}">${fcpText}</td>
      <td class="${classByMetric(lcpText, "lcp", lcpNum)}">${lcpText}</td>
      <td class="${classByMetric(tbtText, "tbt", tbtNum)}">${tbtText}</td>
      <td class="${classByMetric(clsText, "cls", clsNum)}">${clsText}</td>
    </tr>
  `;
  tbody.insertAdjacentHTML("afterbegin", rowHtml);
}

// ===== Classification by numericValue =====
function classByMetric(displayText, metric, numericValue) {
  if (displayText === "error" || numericValue == null) return "error-cell";
  switch (metric) {
    case "fcp":
    case "lcp":
      if (numericValue <= 1000) return "fast";
      if (numericValue <= 2500) return "average";
      return "slow";
    case "tbt":
      if (numericValue <= 300) return "fast";
      if (numericValue <= 600) return "average";
      return "slow";
    case "cls":
      if (numericValue <= 0.1) return "fast";
      if (numericValue <= 0.25) return "average";
      return "slow";
    default:
      return "";
  }
}

// ===== Countdown (single mode) =====
function startCountdown(durationSec) {
  const el = document.getElementById("countdown");
  let remaining = durationSec;

  function tick() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.innerHTML = `Next test in: ${m}:${s.toString().padStart(2, "0")}`;
    if (remaining > 0) {
      remaining--;
    } else {
      clearInterval(intervalId);
      document.querySelector('button[type="submit"]').click();
    }
  }

  tick();
  intervalId = setInterval(tick, 1000);
}

// ===== Sitemap helpers (multiple mode) =====
async function getUrlsFromSitemap(baseUrl) {
  const sitemapUrl = /sitemap\.xml$/i.test(baseUrl)
    ? baseUrl
    : baseUrl.endsWith("/")
    ? `${baseUrl}sitemap.xml`
    : `${baseUrl}/sitemap.xml`;

  const txt = await fetchTextWithCors(sitemapUrl);
  if (!txt) return [];

  // parse as XML
  let urls = parseSitemapXML(txt);
  if (urls.length) return uniqueLimit(urls, 500);

  // if HTML page with links to sub-sitemaps
  const subMaps = parseSitemapHTMLForSubmaps(txt);
  if (subMaps.length) {
    const collected = new Set();
    for (const sm of subMaps) {
      const smTxt = await fetchTextWithCors(sm);
      parseSitemapXML(smTxt).forEach((u) => collected.add(u));
    }
    return uniqueLimit([...collected], 500);
  }

  return [];
}

function parseSitemapXML(xmlText) {
  try {
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return [];
    const sitemapNodes = [...doc.getElementsByTagName("sitemap")];
    if (sitemapNodes.length) {
      return sitemapNodes
        .map((n) => n.getElementsByTagName("loc")[0]?.textContent?.trim())
        .filter(Boolean);
    }
    return [...doc.getElementsByTagName("loc")].map((n) =>
      n.textContent.trim()
    );
  } catch {
    return [];
  }
}

function parseSitemapHTMLForSubmaps(htmlText) {
  try {
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    return [...doc.querySelectorAll('a[href*="sitemap"]')]
      .map((a) => a.getAttribute("href"))
      .filter(Boolean)
      .map((href) => normalizeUrl(href));
  } catch {
    return [];
  }
}

function normalizeUrl(u) {
  try {
    return new URL(u, location.href).toString();
  } catch {
    return u;
  }
}

function uniqueLimit(arr, limit) {
  const s = new Set(arr);
  return [...s].slice(0, limit);
}

async function fetchTextWithCors(url) {
  const tries = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://r.jina.ai/http://` + url.replace(/^https?:\/\//i, ""),
    `https://cors.isomorphic-git.org/${url}`,
  ];
  for (const u of tries) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.ok) return await r.text();
    } catch {}
  }
  return "";
}

// ===== Export CSV (multiple mode) =====
function showExportButton() {
  if (document.getElementById("exportBtn")) return;
  const btn = document.createElement("button");
  btn.id = "exportBtn";
  btn.className = "btn btn-success mb-3";
  btn.textContent = "Export CSV";
  btn.addEventListener("click", exportTableToCSV);

  const results = document.getElementById("results");
  const tableWrap = results.querySelector(".table-responsive");
  results.insertBefore(btn, tableWrap);
}

function exportTableToCSV() {
  const rows = document.querySelectorAll("table tr");
  let csv = "";
  rows.forEach((row) => {
    const cols = Array.from(row.querySelectorAll("th, td")).map(
      (cell) => `"${cell.innerText.replace(/"/g, '""')}"`
    );
    csv += cols.join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "pagespeed_results.csv";
  link.click();
}

// ===== UI helpers =====
function showProgress(text) {
  const statusMessage = document.getElementById("statusMessage");
  if (!text) {
    statusMessage.classList.add("d-none");
    statusMessage.innerHTML = "";
    return;
  }
  statusMessage.innerHTML = `<div class="alert alert-info" role="alert">${text}</div>`;
  statusMessage.classList.remove("d-none");
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function scrollToTable() {
  const table = document.querySelector(".table-responsive");
  if (!table) return;
  const offset = table.getBoundingClientRect().top + window.pageYOffset - 100;
  window.scrollTo({ top: offset, behavior: "smooth" });
}
