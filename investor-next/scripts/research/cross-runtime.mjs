import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PRECISION_PROVENANCE, seirRK45 } from "../../lib/precision-lab.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const outDir = path.join(root, "public/research/data");
const outFile = path.join(outDir, "tr-2026-03-cross-runtime.json");

const settings = [
  { label: "default", contactsPerDay: 8, beta: 0.15, infectiousDays: 5 },
  { label: "dense-high", contactsPerDay: 16, beta: 0.5, infectiousDays: 10 },
  { label: "sparse-low", contactsPerDay: 2, beta: 0.05, infectiousDays: 2 },
  { label: "mid", contactsPerDay: 12, beta: 0.3, infectiousDays: 7 }
];

const common = {
  population: 1000,
  latencyDays: 3,
  days: 90,
  rtol: 1e-7,
  atol: 1e-9,
  dtMax: 0.5
};

function solve(input) {
  const result = seirRK45({ ...common, ...input });
  return {
    maxConservationError: result.maxConservationError,
    steps: result.steps,
    peakInfectious: result.peakInfectious,
    peakDay: result.peakDay,
    attackRate: result.attackRate,
    r0: result.r0,
    tolerances: result.tolerances
  };
}

function displayRows(nodeResults, browserResults) {
  return settings.map((setting, index) => {
    const node = nodeResults[index];
    const browser = browserResults[index];
    const upperBound = (value) => (value < 1e-9 ? "< 1e-9" : ">= 1e-9");
    return {
      setting: setting.label,
      node: {
        raw: node.maxConservationError,
        upperBound: upperBound(node.maxConservationError),
        fixed12: node.maxConservationError.toFixed(12),
        attackPercent: `${(node.attackRate * 100).toFixed(2)}%`
      },
      chromium: {
        raw: browser.maxConservationError,
        upperBound: upperBound(browser.maxConservationError),
        fixed12: browser.maxConservationError.toFixed(12),
        attackPercent: `${(browser.attackRate * 100).toFixed(2)}%`
      },
      same: {
        raw: node.maxConservationError === browser.maxConservationError,
        upperBound: upperBound(node.maxConservationError) === upperBound(browser.maxConservationError),
        fixed12: node.maxConservationError.toFixed(12) === browser.maxConservationError.toFixed(12),
        attackPercent:
          `${(node.attackRate * 100).toFixed(2)}%` === `${(browser.attackRate * 100).toFixed(2)}%`,
        steps: node.steps === browser.steps,
        peakInfectious: node.peakInfectious === browser.peakInfectious,
        peakDay: node.peakDay === browser.peakDay,
        attackRate: node.attackRate === browser.attackRate,
        r0: node.r0 === browser.r0
      }
    };
  });
}

function resolveChrome() {
  const playwrightCandidates = [];
  const playwrightRoot = path.join(os.homedir(), "AppData/Local/ms-playwright");
  if (existsSync(playwrightRoot)) {
    for (const entry of readdirSync(playwrightRoot).sort().reverse()) {
      if (!entry.startsWith("chromium-")) continue;
      playwrightCandidates.push(path.join(playwrightRoot, entry, "chrome-win64/chrome.exe"));
      playwrightCandidates.push(path.join(playwrightRoot, entry, "chrome-win/chrome.exe"));
    }
  }

  const candidates = [
    process.env.SENDA_CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    ...playwrightCandidates
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error(
    "Chrome/Chromium not found. Set SENDA_CHROME to the browser executable."
  );
}

function pageHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>cross-runtime</title></head>
<body>
<pre id="result">PENDING</pre>
<script>
window.addEventListener("error", (event) => {
  document.getElementById("result").textContent = JSON.stringify({ error: String(event.message || event.error) });
});
window.addEventListener("unhandledrejection", (event) => {
  document.getElementById("result").textContent = JSON.stringify({ error: String(event.reason) });
});
</script>
<script type="module">
import { seirRK45 } from "/lib/precision-lab.mjs";
const settings = ${JSON.stringify(settings)};
const common = ${JSON.stringify(common)};
const results = settings.map((setting) => {
  const result = seirRK45({ ...common, ...setting });
  return {
    maxConservationError: result.maxConservationError,
    steps: result.steps,
    peakInfectious: result.peakInfectious,
    peakDay: result.peakDay,
    attackRate: result.attackRate,
    r0: result.r0,
    tolerances: result.tolerances
  };
});
document.getElementById("result").textContent = JSON.stringify({
  userAgent: navigator.userAgent,
  results
});
</script>
</body>
</html>`;
}

async function browserSolve(chromePath) {
  const page = pageHtml();
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname === "/__cross-runtime.html") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(page);
        return;
      }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const absolute = path.resolve(root, relative);
      if (!absolute.startsWith(`${root}${path.sep}`) || !existsSync(absolute) || !statSync(absolute).isFile()) {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      const extension = path.extname(absolute);
      const type =
        extension === ".mjs" || extension === ".js"
          ? "text/javascript; charset=utf-8"
          : extension === ".json"
            ? "application/json; charset=utf-8"
            : extension === ".html"
              ? "text/html; charset=utf-8"
              : "application/octet-stream";
      response.writeHead(200, { "Content-Type": type });
      response.end(await readFile(absolute));
    } catch (error) {
      response.writeHead(500);
      response.end(String(error));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/__cross-runtime.html`;
  const profile = await mkdtemp(path.join(os.tmpdir(), "senda-chrome-"));

  try {
    const output = await new Promise((resolve, reject) => {
      const child = spawn(
        chromePath,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-extensions",
          `--user-data-dir=${profile}`,
          "--virtual-time-budget=20000",
          "--dump-dom",
          url
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Chrome timed out after 60s\n${stderr}`));
      }, 60_000);
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Chrome exited ${code}\n${stderr}`));
          return;
        }
        const match = /<pre id="result">([\s\S]*?)<\/pre>/.exec(stdout);
        if (!match) {
          reject(new Error(`No result element in DOM\n${stderr}`));
          return;
        }
        const text = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'");
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) {
            reject(new Error(`Browser error: ${parsed.error}`));
            return;
          }
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Cannot parse browser result: ${error.message}\n${text.slice(0, 500)}`));
        }
      });
    });
    return output;
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`could not remove temporary Chrome profile: ${error.message}`);
    }
  }
}

const chromePath = resolveChrome();
const nodeResults = settings.map(solve);
const browser = await browserSolve(chromePath);
const browserResults = browser.results;
const rows = displayRows(nodeResults, browserResults);
const browserVersion =
  /(?:HeadlessChrome|Chrome)\/([0-9.]+)/.exec(browser.userAgent)?.[1] || "unknown";

const artifact = {
  schema: "senda-research-data/1",
  report: "SENDA-TR-2026-03",
  generatedBy: "scripts/research/cross-runtime.mjs",
  provenance: PRECISION_PROVENANCE,
  engines: {
    node: process.version,
    chromium: browserVersion,
    chromiumUserAgent: browser.userAgent,
    chromePath
  },
  protocol: {
    population: common.population,
    latencyDays: common.latencyDays,
    days: common.days,
    tolerances: { rtol: common.rtol, atol: common.atol },
    dtMax: common.dtMax,
    settings
  },
  node: nodeResults,
  chromium: browserResults,
  displays: rows,
  observations: {
    rawErrorsDifferInAllRows: rows.every((row) => !row.same.raw),
    acceptedStepsAgreeInAllRows: rows.every((row) => row.same.steps),
    upperBoundDisplayAgreesInAllRows: rows.every((row) => row.same.upperBound),
    fixed12DisplayAgreesInAllRows: rows.every((row) => row.same.fixed12),
    attackPercentAgreesInAllRows: rows.every((row) => row.same.attackPercent),
    maxRawError: Math.max(...rows.flatMap((row) => [row.node.raw, row.chromium.raw])),
    upperBound: "1e-9"
  },
  doesNotContain: [
    "bit-for-bit reproducibility",
    "field measurements",
    "a claim that the SEIR parameters are scientifically validated",
    "a claim that raw floating-point equality holds across engines"
  ]
};

await mkdir(outDir, { recursive: true });
await writeFile(outFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

console.log(`node ${process.version} · chromium ${browserVersion}`);
for (const row of rows) {
  console.log(
    `${row.setting} raw N/C ${row.node.raw} / ${row.chromium.raw} · upper ${row.node.upperBound} / ${row.chromium.upperBound} · fixed12 ${row.node.fixed12} / ${row.chromium.fixed12} · steps ${row.same.steps ? "same" : "DIFF"}`
  );
}
console.log(`wrote ${outFile}`);
