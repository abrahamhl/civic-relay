'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SITE_STRINGS } from '../data/i18n';
import type { Locale } from '../data/types';

const STORAGE_KEY = 'senda_cookie_notice_v1';

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
    <aside className="s-cookie" aria-label={ui.title} data-testid="cookie-banner">
      <div className="s-row" style={{ gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--s-ok)' }} />
        <strong style={{ color: 'var(--s-text)', fontSize: 14 }}>{ui.title}</strong>
      </div>
      <p style={{ margin: '0 0 12px', lineHeight: 1.45 }}>{ui.body}</p>
      <div className="s-between">
        <span className="s-pill">{ui.analyticsOff}</span>
        <button type="button" className="s-btn s-btn-primary s-btn-sm" onClick={dismiss}>
          {ui.acceptEssential}
        </button>
      </div>
    </aside>
  );
}
