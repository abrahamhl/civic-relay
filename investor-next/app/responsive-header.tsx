"use client";

import { useEffect, useRef, useState } from "react";
import { getCopy, labels, locales, type Locale } from "./copy";
import "./responsive-header.css";

const SOURCE_URL = "https://github.com/abrahamhl/civic-relay";

const linksByLocale: Record<Locale, Array<{ href: string; label: string }>> = {
  en: [
    { href: "#story", label: "The experience" },
    { href: "#sector-intelligence", label: "Sectors & cameras" },
    { href: "#telecom-rf-radar-suite", label: "Network research" },
    { href: "#live-hardware-and-funding", label: "Test my device" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#master-vision", label: "Full programme" },
    { href: "#investment", label: "Funding" },
    { href: "#evidence", label: "Evidence & limits" }
  ],
  es: [
    { href: "#story", label: "Experiencia" },
    { href: "#sector-intelligence", label: "Sectores y cámaras" },
    { href: "#telecom-rf-radar-suite", label: "Investigación de redes" },
    { href: "#live-hardware-and-funding", label: "Probar mi dispositivo" },
    { href: "#how-it-works", label: "Cómo funciona" },
    { href: "#master-vision", label: "Programa completo" },
    { href: "#investment", label: "Financiación" },
    { href: "#evidence", label: "Evidencias y límites" }
  ],
  nl: [
    { href: "#story", label: "De ervaring" },
    { href: "#sector-intelligence", label: "Sectoren en camera's" },
    { href: "#telecom-rf-radar-suite", label: "Netwerkonderzoek" },
    { href: "#live-hardware-and-funding", label: "Mijn toestel testen" },
    { href: "#how-it-works", label: "Hoe het werkt" },
    { href: "#master-vision", label: "Volledig programma" },
    { href: "#investment", label: "Financiering" },
    { href: "#evidence", label: "Bewijs en grenzen" }
  ]
};
const labelsByLocale: Record<Locale, { menu: string; menuNav: string; source: string; home: string }> = {
  es: { menu: "Menú", menuNav: "Explorar Civic Relay", source: "Código y pruebas", home: "Volver al inicio" },
  en: { menu: "Menu", menuNav: "Explore Civic Relay", source: "Code and tests", home: "Back to top" },
  nl: { menu: "Menu", menuNav: "Civic Relay verkennen", source: "Code en tests", home: "Naar boven" }
};

export default function ResponsiveHeader({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { nav } = getCopy(locale);
  const copy = labelsByLocale[locale];
  const links = linksByLocale[locale];
  const primary = [0, 1, 3, 7];

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuToggle.current?.focus();
      }
    };
    const onOutsideClick = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutsideClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutsideClick);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="topbar container oep-responsive-header" data-testid="responsive-header">
      <a className="wordmark oep-brand" href="#top" aria-label="Civic Relay — Offline Emergency Protocol">
        <span className="mark-symbol" aria-hidden="true"><span/><span/><span/></span>
        <span className="oep-brand-copy">
          <strong>Civic Relay</strong>
          <span className="oep-brand-subtitle">Offline Emergency Protocol</span>
        </span>
      </a>

      <nav className="oep-header-desktop" aria-label={copy.menuNav}>
        {primary.map((index) => (
          <a key={links[index].href} href={links[index].href}>{links[index].label}</a>
        ))}
      </nav>

      <div className="oep-header-actions">
        <div className="locale-links oep-header-locales" role="group" aria-label={nav.language}>
          {locales.map((lang) => (
            <a
              key={lang}
              href={lang === "en" ? "/" : "/" + lang + "/"}
              hrefLang={lang}
              lang={lang}
              aria-label={labels[lang]}
              aria-current={locale === lang ? "page" : undefined}
              className={locale === lang ? "active" : ""}
            >{lang.toUpperCase()}</a>
          ))}
        </div>
        <button
          ref={menuToggle}
          type="button"
          className={open ? "oep-menu-toggle is-open" : "oep-menu-toggle"}
          data-testid="header-menu-toggle"
          aria-expanded={open}
          aria-controls="oep-navigation-panel"
          aria-label={copy.menu}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="oep-menu-icon" aria-hidden="true"><span/><span/><span/></span>
          <span className="oep-menu-text">{copy.menu}</span>
        </button>
      </div>

      <div
        ref={panelRef}
        id="oep-navigation-panel"
        className="oep-menu-panel"
        data-testid="header-menu-panel"
        hidden={!open}
      >
        <p className="oep-menu-kicker">CIVIC RELAY / OEP</p>
        <nav className="oep-menu-grid" aria-label={copy.menuNav}>
          {links.map((link, index) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              <span className="oep-menu-index">{String(index + 1).padStart(2, "0")}</span>
              {link.label}
              <span className="oep-menu-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
        <div className="oep-menu-footer">
          <a href="#top" onClick={() => setOpen(false)}>{copy.home} ↑</a>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">{copy.source} ↗</a>
        </div>
      </div>
    </header>
  );
}
