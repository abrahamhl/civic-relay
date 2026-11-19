import manifest from '../content/research/manifest.json';
import { labels, locales, type Locale } from './copy';
import LanguageDocument from './language-document';
import './research-page.css';

const manifestHref = '/research/manifest.json';
const sourceHref = 'https://github.com/abrahamhl/civic-relay/tree/master/packages/senda-pci';

const copy: Record<Locale, {
  eyebrow: string;
  title: string;
  lead: string;
  reports: string;
  datasets: string;
  status: string;
  statusAria: string;
  digest: string;
  reportsTitle: string;
  reportsLead: string;
  publicationsEyebrow: string;
  provenanceEyebrow: string;
  artifactEyebrow: string;
  reportStatus: string;
  abstract: string;
  artifacts: string;
  read: string;
  pdf: string;
  pdfPending: string;
  source: string;
  bibtex: string;
  data: string;
  verifyTitle: string;
  verifyLead: string;
  notPeerTitle: string;
  notPeerBody: string;
  modelTitle: string;
  modelBody: string;
  reproTitle: string;
  reproBody: string;
  verifyLink: string;
  sourceLink: string;
  dataTitle: string;
  manifestNote: string;
  home: string;
  science: string;
  library: string;
  language: string;
  footer: string;
}> = {
  en: {
    eyebrow: 'SENDA / RESEARCH LIBRARY',
    title: 'Technical reports, with receipts.',
    lead: 'Three checkable reports on proof-carrying inference, erasure tails for delay-tolerant messaging, and display determinism across JavaScript runtimes. Each artifact ships with source, BibTeX, hashes and data where applicable.',
    reports: 'reports',
    datasets: 'datasets',
    status: 'Not peer reviewed',
    statusAria: 'Library status',
    digest: 'Bundle digest',
    reportsTitle: 'Reports',
    reportsLead: 'Read the HTML edition or download the source, citation and data.',
    publicationsEyebrow: '01 / PUBLICATIONS',
    provenanceEyebrow: '02 / PROVENANCE',
    artifactEyebrow: '03 / ARTIFACT INDEX',
    reportStatus: 'Technical report · not peer reviewed',
    abstract: 'Abstract',
    artifacts: 'Artifacts',
    read: 'Read HTML',
    pdf: 'PDF',
    pdfPending: 'PDF pending',
    source: 'Markdown',
    bibtex: 'BibTeX',
    data: 'Data',
    verifyTitle: 'What these artifacts prove',
    verifyLead: 'The library is designed to make the limits as visible as the results. Hashes bind the files; they do not turn a technical report into a peer-reviewed publication.',
    notPeerTitle: 'Not peer reviewed',
    notPeerBody: 'These are technical reports. They have not been independently peer reviewed and are not a substitute for a security audit or a field trial.',
    modelTitle: 'Model outputs, not measurements',
    modelBody: 'The erasure tails, delay bounds and cross-runtime errors are computed model outputs. No physical radio, handset or field measurement is claimed.',
    reproTitle: 'Reproducible inputs',
    reproBody: 'The manifest lists SHA-256 hashes for every published file. The PCI package has an automated test suite; the data scripts and browser version are documented in each report.',
    verifyLink: 'Download manifest',
    sourceLink: 'Inspect the source',
    dataTitle: 'Data files',
    manifestNote: 'Hashes cover the listed files.',
    home: 'Overview',
    science: 'Science & Lab',
    library: 'Research',
    language: 'Language',
    footer: 'SENDA · Technical reports · MIT License · No official endorsement'
  },
  es: {
    eyebrow: 'SENDA / BIBLIOTECA DE INVESTIGACIÓN',
    title: 'Informes técnicos, con recibos.',
    lead: 'Tres informes verificables sobre inferencia con prueba, colas de borrado para mensajería tolerante a retardos y determinismo de visualización entre runtimes JavaScript. Cada artefacto incluye fuente, BibTeX, hashes y datos cuando corresponde.',
    reports: 'informes',
    datasets: 'conjuntos de datos',
    status: 'Sin revisión por pares',
    statusAria: 'Estado de la biblioteca',
    digest: 'Digest del paquete',
    reportsTitle: 'Informes',
    reportsLead: 'Lee la edición HTML o descarga la fuente, la cita y los datos.',
    publicationsEyebrow: '01 / PUBLICACIONES',
    provenanceEyebrow: '02 / PROCEDENCIA',
    artifactEyebrow: '03 / ÍNDICE DE ARTEFACTOS',
    reportStatus: 'Informe técnico · sin revisión por pares',
    abstract: 'Resumen',
    artifacts: 'Artefactos',
    read: 'Leer HTML',
    pdf: 'PDF',
    pdfPending: 'PDF pendiente',
    source: 'Markdown',
    bibtex: 'BibTeX',
    data: 'Datos',
    verifyTitle: 'Qué prueban estos artefactos',
    verifyLead: 'La biblioteca hace visibles los límites tanto como los resultados. Los hashes vinculan los archivos; no convierten un informe técnico en una publicación revisada por pares.',
    notPeerTitle: 'Sin revisión por pares',
    notPeerBody: 'Son informes técnicos. No han sido revisados independientemente por pares y no sustituyen una auditoría de seguridad ni una prueba de campo.',
    modelTitle: 'Salidas de modelo, no mediciones',
    modelBody: 'Las colas de borrado, las cotas de retardo y los errores entre runtimes son salidas calculadas. No se afirma ninguna medición física de radio, teléfono o campo.',
    reproTitle: 'Entradas reproducibles',
    reproBody: 'El manifiesto incluye hashes SHA-256 de cada archivo publicado. El paquete PCI tiene una suite de pruebas automática; los scripts de datos y la versión del navegador se documentan en cada informe.',
    verifyLink: 'Descargar manifiesto',
    sourceLink: 'Inspeccionar el código',
    dataTitle: 'Archivos de datos',
    manifestNote: 'Los hashes cubren los archivos listados.',
    home: 'Resumen',
    science: 'Ciencia y laboratorio',
    library: 'Investigación',
    language: 'Idioma',
    footer: 'SENDA · Informes técnicos · Licencia MIT · Sin respaldo oficial'
  },
  nl: {
    eyebrow: 'SENDA / ONDERZOEKSBIBLIOTHEEK',
    title: 'Technische rapporten, met bewijs.',
    lead: 'Drie controleerbare rapporten over proof-carrying inference, erasure-staarten voor delay-tolerant berichtgeving en weergavedeterminisme tussen JavaScript-runtimes. Elk artefact bevat bron, BibTeX, hashes en waar van toepassing data.',
    reports: 'rapporten',
    datasets: 'datasets',
    status: 'Niet peer-reviewed',
    statusAria: 'Bibliotheekstatus',
    digest: 'Bundle-digest',
    reportsTitle: 'Rapporten',
    reportsLead: 'Lees de HTML-editie of download de bron, citatie en data.',
    publicationsEyebrow: '01 / PUBLICATIES',
    provenanceEyebrow: '02 / HERKOMST',
    artifactEyebrow: '03 / ARTEFACTINDEX',
    reportStatus: 'Technisch rapport · niet peer-reviewed',
    abstract: 'Samenvatting',
    artifacts: 'Artefacten',
    read: 'Lees HTML',
    pdf: 'PDF',
    pdfPending: 'PDF volgt',
    source: 'Markdown',
    bibtex: 'BibTeX',
    data: 'Data',
    verifyTitle: 'Wat deze artefacten bewijzen',
    verifyLead: 'De bibliotheek maakt de grenzen even zichtbaar als de resultaten. Hashes binden de bestanden; ze maken een technisch rapport niet tot een peer-reviewed publicatie.',
    notPeerTitle: 'Niet peer-reviewed',
    notPeerBody: 'Dit zijn technische rapporten. Ze zijn niet onafhankelijk peer-reviewed en vervangen geen security-audit of veldtest.',
    modelTitle: 'Modeluitvoer, geen metingen',
    modelBody: 'De erasure-staarten, vertragingsgrenzen en cross-runtime-fouten zijn berekende modeluitvoer. Er wordt geen fysieke radio-, toestel- of veldmeting geclaimd.',
    reproTitle: 'Reproduceerbare invoer',
    reproBody: 'Het manifest bevat SHA-256-hashes van elk gepubliceerd bestand. Het PCI-pakket heeft een automatische testsuite; de datascripts en browserversie staan in elk rapport.',
    verifyLink: 'Manifest downloaden',
    sourceLink: 'Broncode bekijken',
    dataTitle: 'Databestanden',
    manifestNote: 'Hashes dekken de genoemde bestanden.',
    home: 'Overzicht',
    science: 'Science & Lab',
    library: 'Onderzoek',
    language: 'Taal',
    footer: 'SENDA · Technische rapporten · MIT-licentie · Geen officiële goedkeuring'
  }
};

function localeHref(locale: Locale) {
  return locale === 'en' ? '/research/' : `/${locale}/research/`;
}

function homeHref(locale: Locale) {
  return locale === 'en' ? '/' : `/${locale}/`;
}

function scienceHref(locale: Locale) {
  return locale === 'en' ? '/science/' : `/${locale}/science/`;
}

function fileName(filePath: string) {
  return filePath.split('/').pop() || filePath;
}

export default function ResearchPage({ locale }: { locale: Locale }) {
  const t = copy[locale];

  return (
    <main className="site-root research-root" data-testid="research-library">
      <LanguageDocument locale={locale} />
      <header className="container research-topbar">
        <a className="wordmark research-brand" href={homeHref(locale)} aria-label="SENDA — research library">
          <span className="mark-symbol" aria-hidden="true"><span /><span /><span /></span>
          <span className="research-brand-copy">
            <strong>SENDA</strong>
            <span>Civic Relay · OEP</span>
          </span>
        </a>
        <nav className="research-topnav" aria-label={t.library}>
          <a href={homeHref(locale)}>{t.home}</a>
          <a href={scienceHref(locale)}>{t.science}</a>
          <a href={localeHref(locale)} aria-current="page">{t.library}</a>
        </nav>
        <div className="locale-links research-locales" role="group" aria-label={t.language}>
          {locales.map((lang) => (
            <a
              key={lang}
              href={localeHref(lang)}
              hrefLang={lang}
              lang={lang}
              aria-label={labels[lang]}
              aria-current={locale === lang ? 'page' : undefined}
              className={locale === lang ? 'active' : ''}
            >
              {lang.toUpperCase()}
            </a>
          ))}
        </div>
      </header>

      <section className="container research-hero">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="research-lead">{t.lead}</p>
        <div className="research-badges" aria-label={t.statusAria}>
          <span>{manifest.papers.length} {t.reports}</span>
          <span>{manifest.data.length} {t.datasets}</span>
          <span>{t.status}</span>
          <span>{manifest.license}</span>
        </div>
        <p className="research-digest">
          <span>{t.digest}</span>
          <code>{manifest.bundleDigest}</code>
        </p>
      </section>

      <section className="container research-section" aria-labelledby="research-reports">
        <div className="research-section-head">
          <div>
            <p className="eyebrow">{t.publicationsEyebrow}</p>
            <h2 id="research-reports">{t.reportsTitle}</h2>
          </div>
          <p>{t.reportsLead}</p>
        </div>

        <div className="research-grid">
          {manifest.papers.map((paper) => {
            const dataFiles = paper.files.filter((file) => file.path.startsWith('/research/data/'));
            return (
              <article className="research-card" id={paper.slug} key={paper.slug}>
                <p className="research-report">{paper.report}</p>
                <h3 lang="en"><a href={paper.html}>{paper.title}</a></h3>
                <p className="research-subtitle" lang="en">{paper.subtitle}</p>
                <p className="research-meta">{paper.authors.join(', ')} · {paper.date} · v{paper.version}</p>
                <p className="research-status">{t.reportStatus} · {paper.license}</p>
                <div className="research-abstract">
                  <span>{t.abstract}</span>
                  <p>{paper.abstract[locale]}</p>
                </div>
                <div className="research-tags">
                  {paper.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="research-links" aria-label={t.artifacts}>
                  <a className="research-link primary" href={paper.html}>{t.read} ↗</a>
                  {paper.pdf
                    ? <a className="research-link" href={paper.pdf} download>{t.pdf} ↓</a>
                    : <span className="research-link disabled">{t.pdfPending}</span>}
                  <a className="research-link" href={paper.markdown} download>{t.source} ↓</a>
                  <a className="research-link" href={paper.bibtex} download>{t.bibtex} ↓</a>
                  {dataFiles.map((file) => (
                    <a className="research-link" href={file.path} download key={file.path}>
                      {t.data} · {fileName(file.path)} ↓
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container research-section" aria-labelledby="research-verify">
        <div className="research-section-head">
          <div>
            <p className="eyebrow">{t.provenanceEyebrow}</p>
            <h2 id="research-verify">{t.verifyTitle}</h2>
          </div>
          <p>{t.verifyLead}</p>
        </div>

        <div className="research-verify-grid">
          <article>
            <span>01</span>
            <h3>{t.notPeerTitle}</h3>
            <p>{t.notPeerBody}</p>
          </article>
          <article>
            <span>02</span>
            <h3>{t.modelTitle}</h3>
            <p>{t.modelBody}</p>
          </article>
          <article>
            <span>03</span>
            <h3>{t.reproTitle}</h3>
            <p>{t.reproBody}</p>
          </article>
        </div>

        <div className="research-manifest">
          <div>
            <p className="eyebrow">{t.artifactEyebrow}</p>
            <h3>{t.dataTitle}</h3>
            <p>{t.manifestNote}</p>
          </div>
          <ul>
            {manifest.data.map((file) => (
              <li key={file.path}>
                <a href={file.path} download>{fileName(file.path)}</a>
                <code>{file.sha256.slice(0, 12)}…</code>
                <span>{(file.bytes / 1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
          <div className="research-manifest-links">
            <a className="research-link primary" href={manifestHref} download>{t.verifyLink} ↓</a>
            <a className="research-link" href={manifest.bibtex} download>{t.bibtex} ↓</a>
            <a className="research-link" href={sourceHref} target="_blank" rel="noopener noreferrer">{t.sourceLink} ↗</a>
          </div>
        </div>
      </section>

      <footer className="container research-footer">
        <p>{t.footer}</p>
        <nav aria-label={t.library}>
          <a href={manifestHref}>{t.verifyLink}</a>
          <a href={homeHref(locale)}>{t.home} ↑</a>
        </nav>
      </footer>
    </main>
  );
}
