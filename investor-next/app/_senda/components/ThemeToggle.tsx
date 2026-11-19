'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import type { Locale } from '../data/types';

type Scheme = 'light' | 'dark';

function getSystemScheme(): Scheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStored(): Scheme | null {
  try {
    const v = localStorage.getItem('color-scheme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function applyScheme(stored: Scheme | null) {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const value = stored ?? 'light dark';
  if (meta) {
    meta.setAttribute('content', value);
  } else {
    const created = document.createElement('meta');
    created.name = 'color-scheme';
    created.content = value;
    document.head.appendChild(created);
  }
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Two-state color-scheme toggle per modern-web-guidance (dark-mode-toggle):
 * - Follows OS preference by default (no stored value, meta="light dark").
 * - Toggling selects the opposite of the currently rendered scheme.
 * - If target matches current OS preference, removes stored value instead of pinning.
 * - Never auto-clears stored value when OS preference changes later.
 */
export default function ThemeToggle({ locale }: { locale: Locale }) {
  const ui = SITE_STRINGS[locale];
  const [rendered, setRendered] = useState<Scheme>('light');

  useEffect(() => {
    const sync = () => {
      const stored = readStored();
      applyScheme(stored);
      setRendered(stored ?? getSystemScheme());
    };
    sync();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqChange = () => {
      const stored = readStored();
      if (!stored) setRendered(getSystemScheme());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'color-scheme') sync();
    };
    mq.addEventListener('change', onMqChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onMqChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = () => {
    const target: Scheme = rendered === 'dark' ? 'light' : 'dark';
    const sys = getSystemScheme();
    let nextStored: Scheme | null = target === sys ? null : target;
    try {
      if (nextStored) localStorage.setItem('color-scheme', nextStored);
      else localStorage.removeItem('color-scheme');
    } catch {
      // Storage blocked; still apply for current session
      nextStored = target;
    }
    applyScheme(nextStored);
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
