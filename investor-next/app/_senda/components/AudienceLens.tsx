'use client';

import { Code2, HeartHandshake, TrendingUp } from 'lucide-react';
import type { Locale } from '../data/types';

export type AudienceMode = 'citizen' | 'investor' | 'engineer';

const LABELS: Record<Locale, { prefix: string; items: Record<AudienceMode, { title: string; hint: string }> }> = {
  en: {
    prefix: 'Explanation depth',
    items: {
      citizen: { title: 'For Everyone', hint: 'Plain human language' },
      investor: { title: 'Investor View', hint: 'Scale, efficiency & moat' },
      engineer: { title: 'Engineering & Code', hint: 'Protocols, physics & source' }
    }
  },
  es: {
    prefix: 'Nivel de explicación',
    items: {
      citizen: { title: 'Para cualquier persona', hint: 'Claro y sin tecnicismos' },
      investor: { title: 'Visión Inversor', hint: 'Escala, ventaja y métricas' },
      engineer: { title: 'Ingeniería y Código', hint: 'Protocolos, física y fuentes' }
    }
  },
  nl: {
    prefix: 'Uitlegniveau',
    items: {
      citizen: { title: 'Voor iedereen', hint: 'Heldere mensentaal' },
      investor: { title: 'Investeerderszicht', hint: 'Schaal, impact & cijfers' },
      engineer: { title: 'Techniek & Code', hint: 'Protocollen, fysica & broncode' }
    }
  }
};

export default function AudienceLens({
  locale,
  value,
  onChange
}: {
  locale: Locale;
  value: AudienceMode;
  onChange: (next: AudienceMode) => void;
}) {
  const copy = LABELS[locale];
  const icons: Record<AudienceMode, typeof HeartHandshake> = {
    citizen: HeartHandshake,
    investor: TrendingUp,
    engineer: Code2
  };

  return (
    <div className="s-lens-bar" role="group" aria-label={copy.prefix} data-testid="audience-lens">
      <span className="s-lens-prefix">{copy.prefix}:</span>
      <div className="s-lens-pills">
        {(['citizen', 'investor', 'engineer'] as AudienceMode[]).map((mode) => {
          const Icon = icons[mode];
          const item = copy.items[mode];
          return (
            <button
              key={mode}
              type="button"
              className="s-lens-pill"
              aria-pressed={value === mode}
              onClick={() => onChange(mode)}
              data-testid={`lens-${mode}`}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
