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
  const baseUrl = document.getElementById("url").value.trim();
  const apiKey = document.getElementById("apiKey").value.trim();
  const strategy = document.getElementById("strategy").checked
    ? "desktop"
    : "mobile";
  const loadingSpinner = document.getElementById("loadingSpinner");
  const statusMessage = document.getElementById("statusMessage");
  const submitButton = document.querySelector('button[type="submit"]');
  const tbody = document.getElementById("metricsTableBody");

  if (!baseUrl) return;

  // UI: start
  isRunning = true;
  loadingSpinner.classList.remove("d-none");
  statusMessage.classList.add("d-none");
  submitButton.disabled = true;

  // необов'язково: очищати старі результати
  // tbody.innerHTML = "";

  let urls = [];
  try {
    urls = await getUrlsFromSitemap(baseUrl);
  } catch (e) {
    console.warn("Sitemap fetch failed:", e);
  }

  if (!urls.length) {
    // якщо sitemap не знайдено — тестуємо лише стартову сторінку
    urls = [baseUrl];
    statusMessage.innerHTML =
      '<div class="alert alert-warning" role="alert">Sitemap not found or blocked by CORS. Running PSI for the start URL only.</div>';
    statusMessage.classList.remove("d-none");
  } else {
    statusMessage.classList.add("d-none");
  }

  let done = 0;
  const total = urls.length;

  for (const url of urls) {
    if (stopRequested) break;
    await fetchPageSpeedInsights(url, apiKey, strategy, tbody);
    done++;
    // показати прогрес
    showProgress(`${done}/${total} processed`);
    // невелика пауза щоб уникати лімітів PSI
    await delay(1500);
  }

  // UI: finish
  loadingSpinner.classList.add("d-none");
  submitButton.disabled = false;
  isRunning = false;

  showExportButton();
  showProgress(""); // очистити прогрес

  statusMessage.innerHTML = `<div class="alert alert-success" role="alert">Done. Processed ${done} page(s).</div>`;
  statusMessage.classList.remove("d-none");

  // прокрутити до таблиці
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
  // якщо користувач одразу дав лінк на sitemap.xml — використовуємо його
  const sitemapUrl = /sitemap\.xml$/i.test(baseUrl)
    ? baseUrl
    : baseUrl.endsWith("/")
    ? `${baseUrl}sitemap.xml`
    : `${baseUrl}/sitemap.xml`;

  const xml = await fetchTextWithCors(sitemapUrl);
  if (!xml) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  // sitemap index
  const sitemapNodes = Array.from(doc.getElementsByTagName("sitemap"));
  if (sitemapNodes.length) {
    const all = new Set();
    for (const sm of sitemapNodes) {
      const loc = sm.getElementsByTagName("loc")[0]?.textContent?.trim();
      if (!loc) continue;
      try {
        const subXml = await fetchTextWithCors(loc);
        const subDoc = parser.parseFromString(subXml, "application/xml");
        for (const locNode of subDoc.getElementsByTagName("loc")) {
          const u = (locNode.textContent || "").trim();
          if (u) all.add(u);
        }
      } catch (e) {
        console.warn("Sub-sitemap fetch failed:", loc, e);
      }
    }
    return Array.from(all);
  }

  // urlset
  const locs = Array.from(doc.getElementsByTagName("loc")).map((n) =>
    n.textContent.trim()
  );
  // безпечна «стеля», щоб не вбити ліміти PSI (змінюй за потреби)
  return locs.slice(0, 500);
}

async function fetchTextWithCors(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } catch (e) {
    // fallback проксі для CORS
    try {
      const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(
        url
      )}`;
      const r2 = await fetch(proxied);
      if (!r2.ok) throw new Error(`Proxy HTTP ${r2.status}`);
      return await r2.text();
    } catch (e2) {
      console.warn("CORS fetch failed for:", url, e2);
      return "";
    }
  }
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
