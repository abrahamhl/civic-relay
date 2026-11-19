import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import katex from "katex";
import { marked } from "marked";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const contentDir = path.join(root, "content/research");
const publicDir = path.join(root, "public/research");
const dataDir = path.join(publicDir, "data");
const sourceDir = path.join(publicDir, "source");
const katexDir = path.join(publicDir, "katex");
const site = "https://civic-relay-investor.vercel.app";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fileEntry(absolutePath, publicPath) {
  const bytes = await readFile(absolutePath);
  return {
    path: publicPath,
    bytes: bytes.length,
    sha256: sha256(bytes)
  };
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractReferences(markdown) {
  const marker = "\n## References\n";
  const index = markdown.indexOf(marker);
  if (index < 0) {
    return { body: markdown, tail: "", references: new Map() };
  }
  const body = markdown.slice(0, index);
  const after = markdown.slice(index + marker.length);
  const nextHeading = after.search(/\n##\s+/);
  const referenceBlock = nextHeading < 0 ? after : after.slice(0, nextHeading);
  const tail = nextHeading < 0 ? "" : after.slice(nextHeading + 1);
  const references = new Map();
  let key = null;
  for (const line of referenceBlock.split(/\r?\n/)) {
    const match = /^\[@([a-z0-9-]+)\]:\s*(.*)$/.exec(line);
    if (match) {
      key = match[1];
      references.set(key, match[2].trim());
      continue;
    }
    if (!key) continue;
    if (line.trim() === "") continue;
    references.set(key, `${references.get(key)} ${line.trim()}`);
  }
  return { body, tail, references };
}

const citationPattern = /\[(@[a-z0-9-]+(?:\s*;\s*@[a-z0-9-]+)*)\]/g;

function replaceCitations(markdown, references, order) {
  return markdown.replace(citationPattern, (_, group) => {
    const keys = group.split(";").map((value) => value.trim().replace(/^@/, ""));
    const links = keys.map((key) => {
      if (!references.has(key)) {
        console.warn(`unknown citation key: ${key}`);
        return "?";
      }
      if (!order.includes(key)) order.push(key);
      const number = order.indexOf(key) + 1;
      return `<a class="cite" href="#ref-${key}">${number}</a>`;
    });
    return `[${links.join(", ")}]`;
  });
}

function referencesHtml(references, order) {
  const keys = [...order];
  for (const key of references.keys()) {
    if (!keys.includes(key)) {
      console.warn(`uncited reference: ${key}`);
      keys.push(key);
    }
  }
  if (keys.length === 0) return "";
  const items = keys
    .map((key, index) => {
      const number = index + 1;
      return `<li id="ref-${key}"><span class="ref-num">[${number}]</span> ${escapeHtml(
        references.get(key)
      )}</li>`;
    })
    .join("\n");
  return `<h2 id="references">References</h2>\n<ol class="references">\n${items}\n</ol>`;
}

const mathInline = {
  name: "mathInline",
  level: "inline",
  start(src) {
    const index = src.indexOf("$");
    return index < 0 ? undefined : index;
  },
  tokenizer(src) {
    const match = /^\$([^\n$]+?)\$(?!\d)/.exec(src);
    if (!match) return undefined;
    return { type: "mathInline", raw: match[0], text: match[1].trim() };
  },
  renderer(token) {
    return katex.renderToString(token.text, {
      displayMode: false,
      throwOnError: false,
      strict: "ignore",
      output: "html"
    });
  }
};

const mathBlock = {
  name: "mathBlock",
  level: "block",
  start(src) {
    const index = src.indexOf("$$");
    return index < 0 ? undefined : index;
  },
  tokenizer(src) {
    const match = /^\$\$\n?([\s\S]+?)\n?\$\$(?:\n+|$)/.exec(src);
    if (!match) return undefined;
    return { type: "mathBlock", raw: match[0], text: match[1].trim() };
  },
  renderer(token) {
    return `<div class="math-block">${katex.renderToString(token.text, {
      displayMode: true,
      throwOnError: false,
      strict: "ignore",
      output: "html"
    })}</div>\n`;
  }
};

marked.use({
  gfm: true,
  breaks: false,
  extensions: [mathBlock, mathInline]
});

function enhance(html, referencesMarkup) {
  const toc = [];
  let body = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>\s*/, "");
  body = body.replace(/<h2[^>]*>([\s\S]*?)<\/h2>|<!--SENDA_REFERENCES-->/g, (match, inner) => {
    if (match === "<!--SENDA_REFERENCES-->") {
      if (!referencesMarkup) return "";
      toc.push({ id: "references", text: "References" });
      return referencesMarkup;
    }
    const text = stripTags(inner);
    const id = slugify(text);
    toc.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  body = body.replace(/<table>/g, '<div class="table-wrap"><table>');
  body = body.replace(/<\/table>/g, "</table></div>");
  return { body, toc };
}

function tocHtml(toc) {
  return toc
    .map((entry) => `<a href="#${entry.id}">${entry.text}</a>`)
    .join("\n        ");
}

function template(paper, body, toc) {
  const authors = paper.authors.join(", ");
  const abstract = paper.abstract.en;
  const canonical = `${site}/research/${paper.slug}.html`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: paper.title,
    alternativeHeadline: paper.subtitle,
    author: paper.authors.map((name) => ({ "@type": "Person", name })),
    datePublished: paper.date,
    version: paper.version,
    license: `https://opensource.org/licenses/${paper.license}`,
    abstract,
    url: canonical,
    isPartOf: {
      "@type": "Periodical",
      name: "SENDA Technical Reports"
    },
    identifier: paper.report
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${paper.report} · ${paper.title}</title>
<meta name="description" content="${abstract.replace(/"/g, "&quot;")}">
<meta name="author" content="${authors}">
<meta name="citation_title" content="${paper.title}">
${paper.authors.map((name) => `<meta name="citation_author" content="${name}">`).join("\n")}
<meta name="citation_publication_date" content="${paper.date.replace(/-/g, "/")}">
<meta name="citation_technical_report_number" content="${paper.report}">
<meta name="citation_pdf_url" content="${site}/research/${paper.slug}.pdf">
<meta name="citation_abstract_html_url" content="${canonical}">
<link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="/research/katex/katex.min.css">
<link rel="stylesheet" href="/research/research.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header class="paper-top">
  <a class="paper-brand" href="/research/">SENDA <span>RESEARCH</span></a>
  <nav class="paper-top-nav">
    <a href="/research/">Library</a>
    <a href="/research/${paper.slug}.pdf">PDF</a>
    <a href="/research/source/${paper.slug}.md">Source</a>
    <a href="/research/manifest.json">Manifest</a>
  </nav>
</header>
<div class="paper-shell">
  <aside class="paper-aside">
    <p class="paper-kicker">${paper.report}</p>
    <p class="paper-aside-meta">${paper.date} · v${paper.version}</p>
    <p class="paper-aside-meta">${paper.status}</p>
    <p class="paper-aside-meta">${paper.license}</p>
    <nav class="paper-toc" aria-label="Contents">
      ${tocHtml(toc)}
    </nav>
    <p class="paper-aside-digest">Artifact hashes are listed in <a href="/research/manifest.json">manifest.json</a>.</p>
  </aside>
  <main class="paper-main">
    <p class="paper-kicker">${paper.report} · TECHNICAL REPORT</p>
    <h1>${paper.title}</h1>
    <p class="paper-subtitle">${paper.subtitle}</p>
    <p class="paper-meta">${authors} · ${paper.date} · version ${paper.version}</p>
    <p class="paper-status">${paper.status} · ${paper.license}</p>
    ${body}
    <footer class="paper-footer">
      <p>${paper.report} · ${paper.title}</p>
      <p>Published by SENDA. Technical report, not peer reviewed. This document is licensed under ${paper.license}.</p>
      <p><a href="/research/">All reports</a> · <a href="/research/manifest.json">Download manifest</a> · <a href="/">SENDA</a></p>
    </footer>
  </main>
</div>
</body>
</html>
`;
}

function bibEntry(paper) {
  const key = `senda${paper.date.slice(0, 4)}${paper.slug.split("-").slice(-2).join("")}`;
  const url = `${site}/research/${paper.slug}.html`;
  return `@techreport{${key},
  author = {${paper.authors.join(" and ")}},
  title = {${paper.title}},
  institution = {SENDA},
  type = {Technical Report},
  number = {${paper.report}},
  year = {${paper.date.slice(0, 4)}},
  month = {nov},
  note = {${paper.status}. Available at ${url}},
  url = {${url}},
  keywords = {${paper.tags.join(", ")}}
}`;
}

async function main() {
  const papers = JSON.parse(await readFile(path.join(contentDir, "papers.json"), "utf8"));
  await mkdir(publicDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
  await mkdir(sourceDir, { recursive: true });
  await mkdir(katexDir, { recursive: true });

  const katexSource = path.join(root, "node_modules/katex/dist");
  await cp(path.join(katexSource, "katex.min.css"), path.join(katexDir, "katex.min.css"));
  await cp(path.join(katexSource, "fonts"), path.join(katexDir, "fonts"), { recursive: true });

  const rendered = [];
  const bibEntries = [];

  for (const paper of papers) {
    const markdownPath = path.join(contentDir, `${paper.slug}.md`);
    const markdown = await readFile(markdownPath, "utf8");
    const extracted = extractReferences(markdown);
    const order = [];
    const processed = `${replaceCitations(extracted.body, extracted.references, order)}\n\n<!--SENDA_REFERENCES-->\n\n${replaceCitations(
      extracted.tail,
      extracted.references,
      order
    )}`;
    const html = await marked.parse(processed);
    const { body, toc } = enhance(html, referencesHtml(extracted.references, order));
    const document = template(paper, body, toc);

    const htmlPath = path.join(publicDir, `${paper.slug}.html`);
    await writeFile(htmlPath, document, "utf8");
    await writeFile(path.join(sourceDir, `${paper.slug}.md`), markdown, "utf8");

    const bib = bibEntry(paper);
    await writeFile(path.join(publicDir, `${paper.slug}.bib`), `${bib}\n`, "utf8");
    bibEntries.push(bib);

    const files = [
      await fileEntry(htmlPath, `/research/${paper.slug}.html`),
      await fileEntry(path.join(sourceDir, `${paper.slug}.md`), `/research/source/${paper.slug}.md`),
      await fileEntry(path.join(publicDir, `${paper.slug}.bib`), `/research/${paper.slug}.bib`)
    ];
    const pdfPath = path.join(publicDir, `${paper.slug}.pdf`);
    if (existsSync(pdfPath)) {
      files.push(await fileEntry(pdfPath, `/research/${paper.slug}.pdf`));
    }
    for (const dataName of paper.data || []) {
      const dataPath = path.join(dataDir, dataName);
      if (!existsSync(dataPath)) {
        throw new Error(`missing data artifact for ${paper.slug}: ${dataName}`);
      }
      files.push(await fileEntry(dataPath, `/research/data/${dataName}`));
    }

    rendered.push({
      slug: paper.slug,
      report: paper.report,
      title: paper.title,
      subtitle: paper.subtitle,
      authors: paper.authors,
      date: paper.date,
      version: paper.version,
      status: paper.status,
      license: paper.license,
      tags: paper.tags,
      abstract: paper.abstract,
      html: `/research/${paper.slug}.html`,
      pdf: existsSync(pdfPath) ? `/research/${paper.slug}.pdf` : null,
      markdown: `/research/source/${paper.slug}.md`,
      bibtex: `/research/${paper.slug}.bib`,
      files
    });
    console.log(`built ${paper.report} -> ${path.relative(root, htmlPath)}`);
  }

  await writeFile(
    path.join(publicDir, "senda-research.bib"),
    `${bibEntries.join("\n\n")}\n`,
    "utf8"
  );

  const dataFiles = [];
  if (existsSync(dataDir)) {
    for (const entry of await readdir(dataDir)) {
      if (!entry.endsWith(".json")) continue;
      const absolute = path.join(dataDir, entry);
      const info = await stat(absolute);
      if (!info.isFile()) continue;
      dataFiles.push(await fileEntry(absolute, `/research/data/${entry}`));
    }
  }

  const bundleInput = rendered
    .map((paper) => ({
      slug: paper.slug,
      files: paper.files.map((file) => ({ path: file.path, sha256: file.sha256 }))
    }))
    .sort((left, right) => (left.slug < right.slug ? -1 : 1));
  const bundleDigest = sha256(JSON.stringify(bundleInput));

  const manifest = {
    schema: "senda-research-manifest/1",
    site,
    license: "MIT",
    note: "Technical reports, not peer reviewed. Hashes cover the listed files.",
    bundleDigest,
    papers: rendered,
    data: dataFiles,
    bibtex: "/research/senda-research.bib"
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(publicDir, "manifest.json"), manifestText, "utf8");
  await writeFile(path.join(contentDir, "manifest.json"), manifestText, "utf8");
  console.log(`manifest ${bundleDigest}`);
}

await main();
