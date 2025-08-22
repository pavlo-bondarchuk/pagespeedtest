let isRunning = false;
let stopRequested = false;

document.getElementById("urlForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isRunning) return;
  stopRequested = false;
  await runCrawl();
});

document.getElementById("strategy").addEventListener("change", function () {
  document.getElementById("strategyLabel").innerText = this.checked
    ? "Desktop Test"
    : "Mobile Test";
});

// ------------------ MAIN ------------------

async function runCrawl() {
  let baseUrl = document.getElementById("url").value.trim();
  let apiKey = document.getElementById("apiKey").value.trim();
  const strategy = document.getElementById("strategy").checked
    ? "desktop"
    : "mobile";

  // авто-виправлення найчастішої помилки: ключ у полі URL, а URL у полі key
  if (/^https?:\/\//i.test(apiKey) && !/^https?:\/\//i.test(baseUrl)) {
    [baseUrl, apiKey] = [apiKey, baseUrl];
    console.warn("Heuristic swap: URL <-> API key");
  }
  if (!/^https?:\/\//i.test(baseUrl)) baseUrl = "https://" + baseUrl;

  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");
  const submitButton = document.querySelector('button[type="submit"]');
  const tbody = document.getElementById("metricsTableBody");

  isRunning = true;
  loadingSpinner.classList.remove("d-none");
  statusMessage.classList.add("d-none");
  submitButton.disabled = true;

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
  }

  let done = 0;
  for (const url of urls) {
    await fetchPageSpeedInsights(url, apiKey, strategy, tbody);
    done++;
    showProgress(`${done}/${urls.length} processed`);
    await delay(1500);
  }

  loadingSpinner.classList.add("d-none");
  submitButton.disabled = false;
  isRunning = false;
  showExportButton();
  showProgress("");
  statusMessage.innerHTML = `<div class="alert alert-success" role="alert">Done. Processed ${done} page(s).</div>`;
  statusMessage.classList.remove("d-none");
  scrollToTable();
}

// ------------------ PSI ------------------

async function fetchPageSpeedInsights(pageUrl, apiKey, strategy, tbodyEl) {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    pageUrl
  )}&key=${apiKey}&strategy=${strategy}`;

  try {
    const res = await fetch(apiUrl);
    const data = await res.json();

    // значення для відображення
    const audits = data?.lighthouseResult?.audits || {};
    const score = Math.round(
      (data?.lighthouseResult?.categories?.performance?.score || 0) * 100
    );

    const fcpText = audits["first-contentful-paint"]?.displayValue || "error";
    const lcpText = audits["largest-contentful-paint"]?.displayValue || "error";
    const tbtText = audits["total-blocking-time"]?.displayValue || "error";
    const clsText = audits["cumulative-layout-shift"]?.displayValue || "error";

    // числові для класифікації (мс, окрім CLS)
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
        <td class="${getPerfClassByNumeric(
          fcpText,
          "fcp",
          fcpNum
        )}">${fcpText}</td>
        <td class="${getPerfClassByNumeric(
          lcpText,
          "lcp",
          lcpNum
        )}">${lcpText}</td>
        <td class="${getPerfClassByNumeric(
          tbtText,
          "tbt",
          tbtNum
        )}">${tbtText}</td>
        <td class="${getPerfClassByNumeric(
          clsText,
          "cls",
          clsNum
        )}">${clsText}</td>
      </tr>
    `;
    tbodyEl.insertAdjacentHTML("afterbegin", rowHtml);
  } catch (err) {
    console.error("PSI error:", err);
    const currentTime = new Date().toLocaleTimeString();
    tbodyEl.insertAdjacentHTML(
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

// ------------------ CLASSIFICATION ------------------

function getPerfClassByNumeric(displayText, metric, numericValue) {
  if (displayText === "error" || numericValue == null) return "error-cell";

  // Пороги (FCP/LCP/TBT у мілісекундах, CLS безрозмірний)
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

// ------------------ SITEMAP ------------------

async function getUrlsFromSitemap(baseUrl) {
  const sitemapUrl = /sitemap\.xml$/i.test(baseUrl)
    ? baseUrl
    : baseUrl.endsWith("/")
    ? `${baseUrl}sitemap.xml`
    : `${baseUrl}/sitemap.xml`;

  const txt = await fetchTextWithCors(sitemapUrl);
  if (!txt) return [];

  // спроба як XML
  let urls = parseSitemapXML(txt);
  if (urls.length) return uniqueLimit(urls, 500);

  // якщо віддали HTML (XSL стилізація) — парсимо посилання на під-sitemap’и з <a>
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
    // якщо є помилки парсингу — повертаємо пусто
    if (doc.getElementsByTagName("parsererror").length) return [];

    // sitemap index
    const indexNodes = [...doc.getElementsByTagName("sitemap")];
    if (indexNodes.length) {
      return indexNodes
        .map((n) => n.getElementsByTagName("loc")[0]?.textContent?.trim())
        .filter(Boolean);
    }
    // звичайний urlset
    const locs = [...doc.getElementsByTagName("loc")].map((n) =>
      n.textContent.trim()
    );
    return locs;
  } catch {
    return [];
  }
}

// коли видають HTML-сторінку з таблицею лінків на під-sitemap’и
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
    url, // прямий
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

// ------------------ EXPORT CSV ------------------

function showExportButton() {
  if (document.getElementById("exportBtn")) return; // вже є
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

// ------------------ UI helpers ------------------

function showProgress(text) {
  const statusMessage = document.getElementById("statusMessage");
  if (!text) {
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
