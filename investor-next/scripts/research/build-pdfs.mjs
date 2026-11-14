import { spawn } from "node:child_process";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { mkdtemp, open, readFile, rm, stat } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const publicDir = path.join(root, "public");
const researchDir = path.join(publicDir, "research");
const contentDir = path.join(root, "content/research");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf"
};

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
  throw new Error("Chrome/Chromium not found. Set SENDA_CHROME to the browser executable.");
}

async function printPdf(url, target) {
  if (existsSync(target)) await rm(target, { force: true });
  const profile = await mkdtemp(path.join(os.tmpdir(), "senda-pdf-"));
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        resolveChrome(),
        [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-extensions",
          "--hide-scrollbars",
          "--run-all-compositor-stages-before-draw",
          "--virtual-time-budget=15000",
          "--print-to-pdf-no-header",
          "--no-pdf-header-footer",
          `--user-data-dir=${profile}`,
          `--print-to-pdf=${target}`,
          url
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Chrome PDF timed out after 120s\n${stderr}`));
      }, 120_000);
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
          reject(new Error(`Chrome PDF exited ${code}\n${stderr}`));
          return;
        }
        resolve();
      });
    });
  } finally {
    try {
      await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch (error) {
      console.warn(`could not remove temporary Chrome profile: ${error.message}`);
    }
  }
}

async function assertPdf(target) {
  const info = await stat(target);
  const handle = await open(target, "r");
  try {
    const header = Buffer.alloc(5);
    await handle.read(header, 0, header.length, 0);
    if (header.toString("ascii") !== "%PDF-") {
      throw new Error(`not a PDF: ${target}`);
    }
  } finally {
    await handle.close();
  }
  if (info.size < 10_000) throw new Error(`PDF is unexpectedly small (${info.size} bytes): ${target}`);
}

const papers = JSON.parse(await readFile(path.join(contentDir, "papers.json"), "utf8"));

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const absolute = path.resolve(publicDir, relative || "index.html");
    if (!absolute.startsWith(`${publicDir}${path.sep}`) || !existsSync(absolute) || !statSync(absolute).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const type = mime[path.extname(absolute).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    createReadStream(absolute).on("error", (error) => {
      response.destroy(error);
    }).pipe(response);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

try {
  for (const paper of papers) {
    const html = path.join(researchDir, `${paper.slug}.html`);
    if (!existsSync(html)) throw new Error(`missing HTML artifact: ${html}`);
    const target = path.join(researchDir, `${paper.slug}.pdf`);
    const url = `http://127.0.0.1:${port}/research/${paper.slug}.html`;
    await printPdf(url, target);
    await assertPdf(target);
    const info = await stat(target);
    console.log(`printed ${paper.report} -> ${path.relative(root, target)} (${(info.size / 1024).toFixed(1)} KB)`);
  }
  console.log("PDFs built. Run npm run research:build to update the manifest with PDF hashes.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
