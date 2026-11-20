'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import type { Locale } from '../data/types';

const STORAGE_KEY = 'senda_cookie_notice_v1';

/**
 * Unobtrusive single-line privacy micro-pill (never blocks hero text or CTAs on mobile).
 */
export default function CookieBanner({ locale }: { locale: Locale }) {
  const ui = SITE_STRINGS[locale].cookie;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ essential: true, analytics: false, at: Date.now() }));
    } catch {
      // Ignore storage restriction
    }
    setVisible(false);
  };

  return (
    <aside className="s-cookie-slim" aria-label={ui.title} data-testid="cookie-banner">
      <ShieldCheck size={14} aria-hidden="true" style={{ color: 'var(--s-ok)', flex: 'none' }} />
      <span className="s-cookie-slim-text">
        {ui.title} · {ui.analyticsOff}
      </span>
      <button type="button" className="s-cookie-slim-btn" onClick={dismiss} aria-label={ui.acceptEssential}>
        <span>{ui.acceptEssential}</span>
        <X size={13} aria-hidden="true" />
      </button>
    </aside>
  );
}
