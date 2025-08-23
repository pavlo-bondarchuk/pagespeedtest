let intervalId = null;
let isRunning = false;
let mode = "single"; // 'single' | 'multiple'
const STORAGE_KEY = "psi_session_settings_v1";

// Кеш посилань на елементи
const urlEl = document.getElementById("url");
const apiKeyEl = document.getElementById("apiKey");
const strategyEl = document.getElementById("strategy");
const strategyLbl = document.getElementById("strategyLabel");
const modeToggleEl = document.getElementById("modeToggle"); // є у твоєму HTML
const intervalEl = document.getElementById("interval");
const urlListEl = document.getElementById("urlList"); // є лише в multiple-режимі
const useProxyEl = document.getElementById("useProxy"); // є лише в multiple-режимі

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

  const multiple = mode === "multiple";
  document.getElementById("intervalWrap").classList.toggle("d-none", multiple);
  document.getElementById("countdown").classList.toggle("d-none", multiple);
  document.getElementById("urlListWrap").classList.toggle("d-none", !multiple);
  document.getElementById("proxyWrap").classList.toggle("d-none", !multiple);
});
// Зберігати при зміні будь-якого налаштування
urlEl?.addEventListener("input", saveSettings);
apiKeyEl?.addEventListener("input", saveSettings);
strategyEl?.addEventListener("change", saveSettings);
modeToggleEl?.addEventListener("change", saveSettings);
intervalEl?.addEventListener("change", saveSettings);
urlListEl?.addEventListener("input", saveSettings);
useProxyEl?.addEventListener("change", saveSettings);

// Завантажити збережене при відкритті/перезавантаженні сторінки
document.addEventListener("DOMContentLoaded", loadSettings);
document.addEventListener("DOMContentLoaded", () => {
  [...document.querySelectorAll('[data-bs-toggle="tooltip"]')].forEach(
    (el) => new bootstrap.Tooltip(el)
  );
});

// ===== Main entry =====
async function startTest() {
  saveSettings();
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
    const manualList = document.getElementById("urlList").value.trim();
    const useProxy = document.getElementById("useProxy").checked;
    // прибрати стару кнопку експорту, якщо була
    const oldBtn = document.getElementById("exportBtn");
    if (oldBtn) oldBtn.remove();
    await runCrawl(baseUrl, apiKey, strategy, { useProxy, manualList });
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
async function runCrawl(baseUrl, apiKey, strategy, { useProxy, manualList }) {
  const statusMessage = document.getElementById("statusMessage");
  const tbody = document.getElementById("metricsTableBody");

  let urls = [];
  if (manualList) {
    urls = manualList
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    try {
      urls = await getUrlsFromSitemap(baseUrl, useProxy);
    } catch (e) {
      console.warn(e);
    }
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
     <td class="error-cell">error</td>
     <td class="error-cell">—</td>
     <td class="error-cell">0</td>
     <td class="error-cell">error</td>
     <td class="error-cell">error</td>
     <td class="error-cell">error</td>
     <td class="error-cell">error</td>
     <td class="error-cell">error</td>
     <td class="error-cell">—</td>
     <td class="error-cell">—</td>
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
  const ttfbText = audits["server-response-time"]?.displayValue || "error";
  const sizeText =
    audits["total-byte-weight"]?.displayValue || formatBytes(sizeNum);

  const ttfbNum = audits["server-response-time"]?.numericValue; // ms
  const sizeNum = audits["total-byte-weight"]?.numericValue; // bytes
  const fcpNum = audits["first-contentful-paint"]?.numericValue; // ms
  const lcpNum = audits["largest-contentful-paint"]?.numericValue; // ms
  const tbtNum = audits["total-blocking-time"]?.numericValue; // ms
  const clsNum = audits["cumulative-layout-shift"]?.numericValue; // unitless

  const reportId = data?.lighthouseResult?.id || "";
  const testUrl = `https://pagespeed.web.dev/report?url=${encodeURIComponent(
    pageUrl
  )}&form_factor=${strategy}&report_id=${reportId}`;

  const status = statusByScore(score);

  const rowHtml = `
  <tr>
    <td class="${status.cls}">${status.text}</td>
    <td><a href="${pageUrl}" target="_blank" class="text-decoration-underline">${escapeHtml(
    pageUrl
  )}</a></td>
    <td>${score}</td>
    <td class="${classByMetric(ttfbText, "ttfb", ttfbNum)}">${ttfbText}</td>
    <td class="${classByMetric(fcpText, "fcp", fcpNum)}">${fcpText}</td>
    <td class="${classByMetric(lcpText, "lcp", lcpNum)}">${lcpText}</td>
    <td class="${classByMetric(clsText, "cls", clsNum)}">${clsText}</td>
    <td class="${classByMetric(tbtText, "tbt", tbtNum)}">${tbtText}</td>
    <td>${sizeText}</td>
    <td><a href="${testUrl}" target="_blank" class="text-decoration-underline">Open</a></td>
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
    case "ttfb": // NEW
      if (numericValue <= 200) return "fast";
      if (numericValue <= 500) return "average";
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
async function getUrlsFromSitemap(baseUrl, useProxy = true) {
  const u = new URL(
    /^https?:\/\//i.test(baseUrl) ? baseUrl : "https://" + baseUrl
  );
  const origin = u.origin;
  const pathPrefix = u.pathname.replace(/\/$/, ""); // напр. "/uk" або ""

  const candidates = [];
  if (
    /sitemap(\_|-)index\.xml$/i.test(baseUrl) ||
    /sitemap\.xml$/i.test(baseUrl)
  ) {
    candidates.push(baseUrl);
  } else {
    if (pathPrefix) candidates.push(`${origin}${pathPrefix}/sitemap.xml`);
    candidates.push(`${origin}/sitemap.xml`);
    candidates.push(`${origin}/sitemap_index.xml`);
  }

  let txt = "";
  for (const s of candidates) {
    txt = await fetchTextWithCors(s, useProxy);
    if (txt) break;
  }
  if (!txt) return [];

  let urls = parseSitemapXML(txt);
  if (!urls.length) {
    const subMaps = parseSitemapHTMLForSubmaps(txt);
    if (subMaps.length) {
      const collected = new Set();
      for (const sm of subMaps) {
        const subTxt = await fetchTextWithCors(sm, useProxy);
        parseSitemapXML(subTxt).forEach((x) => collected.add(x));
      }
      urls = [...collected];
    }
  }

  if (pathPrefix) {
    const prefix = `${origin}${pathPrefix}/`;
    urls = urls.filter((x) => x.startsWith(prefix));
  }

  return uniqueLimit(urls, 500);
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

async function fetchTextWithCors(url, useProxy = true) {
  const proxies = [
    `https://r.jina.ai/http://` + url.replace(/^https?:\/\//i, ""),
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://cors.isomorphic-git.org/${url}`,
  ];
  const tries = useProxy ? proxies : [url, ...proxies];
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
  results.insertAdjacentElement("afterbegin", btn); // не залежимо від внутрішніх дітей
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

function saveSettings() {
  const payload = {
    url: urlEl?.value?.trim() || "",
    apiKey: apiKeyEl?.value?.trim() || "",
    strategyChecked: !!strategyEl?.checked,
    mode: modeToggleEl?.checked ? "multiple" : "single",
    interval: intervalEl?.value || "60",
    urlList: urlListEl?.value || "",
    useProxy: !!(useProxyEl && useProxyEl.checked),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSettings() {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);

    if (s.url) urlEl.value = s.url;
    if (s.apiKey) apiKeyEl.value = s.apiKey;

    strategyEl.checked = !!s.strategyChecked;
    if (strategyLbl)
      strategyLbl.innerText = strategyEl.checked
        ? "Desktop Test"
        : "Mobile Test";

    // режим
    if (typeof s.mode === "string") {
      const multiple = s.mode === "multiple";
      if (modeToggleEl) modeToggleEl.checked = multiple;
      document.getElementById("modeLabel").innerText = multiple
        ? "Multiple URLs"
        : "Single URL";
      document
        .getElementById("intervalWrap")
        .classList.toggle("d-none", multiple);
      document.getElementById("countdown").classList.toggle("d-none", multiple);
      const urlListWrap = document.getElementById("urlListWrap");
      const proxyWrap = document.getElementById("proxyWrap");
      if (urlListWrap) urlListWrap.classList.toggle("d-none", !multiple);
      if (proxyWrap) proxyWrap.classList.toggle("d-none", !multiple);
    }

    if (s.interval && intervalEl) intervalEl.value = s.interval;
    if (urlListEl && typeof s.urlList === "string") urlListEl.value = s.urlList;
    if (useProxyEl && typeof s.useProxy === "boolean")
      useProxyEl.checked = s.useProxy;
  } catch (e) {
    console.warn("Failed to parse session settings", e);
  }
}

function clearSettings() {
  sessionStorage.removeItem(STORAGE_KEY);
}

function statusByScore(score) {
  if (score >= 90) return { text: "Good", cls: "fast" };
  if (score >= 50) return { text: "Average", cls: "average" };
  return { text: "Poor", cls: "slow" };
}

function formatBytes(b) {
  if (!Number.isFinite(b)) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(1)} ${u[i]}`;
}

function escapeHtml(s) {
  return s.replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}
