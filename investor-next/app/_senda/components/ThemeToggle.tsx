'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import type { Locale } from '../data/types';

type Scheme = 'light' | 'dark';

function readStored(): Scheme | null {
  try {
    const v = localStorage.getItem('color-scheme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function applyScheme(scheme: Scheme) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', scheme);
  } else {
    const created = document.createElement('meta');
    created.name = 'color-scheme';
    created.content = scheme;
    document.head.appendChild(created);
  }
  document.documentElement.setAttribute('data-theme', scheme);
}

/**
 * Aerospace dark-default theme switcher with full light-mode support.
 */
export default function ThemeToggle({ locale }: { locale: Locale }) {
  const ui = SITE_STRINGS[locale];
  const [rendered, setRendered] = useState<Scheme>('dark');

  useEffect(() => {
    const sync = () => {
      const stored = readStored();
      const target: Scheme = stored ?? 'dark';
      applyScheme(target);
      setRendered(target);
    };
    sync();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') sync();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = () => {
    const target: Scheme = rendered === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('color-scheme', target);
    } catch {
      // Ignore storage restriction
    }
    applyScheme(target);
    setRendered(target);
  };

  return (
    <button
      type="button"
      className="s-icon-btn"
      onClick={toggle}
      aria-label={rendered === 'dark' ? ui.themeToLight : ui.themeToDark}
      title={rendered === 'dark' ? ui.themeToLight : ui.themeToDark}
      data-testid="theme-toggle"
    >
      {rendered === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}
