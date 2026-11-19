'use client';

import { useEffect, useId, useRef } from 'react';
import {
  CheckCircle2,
  Eye,
  TrendingUp,
  Cpu,
  HelpCircle,
  ExternalLink,
  X
} from 'lucide-react';
import {
  getEvidenceById,
  STATUS_META
} from '../data/evidence';
import { SITE_STRINGS } from '../data/i18n';
import { localeHref, type EvidenceRecord, type EvidenceStatus, type Locale } from '../data/types';

const STATUS_ICON: Record<EvidenceStatus, typeof CheckCircle2> = {
  confirmed: CheckCircle2,
  observed: Eye,
  predicted: TrendingUp,
  simulated: Cpu,
  untested: HelpCircle
};

export interface EvidenceBadgeProps {
  locale: Locale;
  evidenceId?: string;
  record?: EvidenceRecord;
  statusOverride?: EvidenceStatus;
  labelOverride?: string;
  compact?: boolean;
}

export default function EvidenceBadge({
  locale,
  evidenceId,
  record,
  statusOverride,
  labelOverride,
  compact = false
}: EvidenceBadgeProps) {
  const item = record ?? getEvidenceById(evidenceId ?? 'EV-CORE-506');
  const status = statusOverride ?? item.status;
  const Icon = STATUS_ICON[status];
  const meta = STATUS_META[status];
  const ui = SITE_STRINGS[locale].evidenceDialog;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Mandatory Safari light-dismiss fallback per modern-web-guidance (light-dismiss-a-dialog)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleClick = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inside) {
        dialog.close();
      }
    };
    dialog.addEventListener('click', handleClick);
    return () => dialog.removeEventListener('click', handleClick);
  }, []);

  const openModal = () => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const closeModal = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) {
      dialog.close();
    }
  };

  return (
    <>
      <button
        type="button"
        className="s-badge"
        data-status={status}
        data-evidence-id={item.id}
        onClick={openModal}
        aria-haspopup="dialog"
        title={`${meta.label[locale]} — ${ui.clickHint}`}
      >
        <Icon aria-hidden="true" />
        <span>{labelOverride ?? (compact ? meta.short[locale] : meta.label[locale])}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="s-dialog"
        aria-labelledby={titleId}
        {...({ closedby: 'any' } as Record<string, string>)}
      >
        <div className="s-sheet">
          <div className="s-sheet-head">
            <div>
              <span className="s-badge" data-status={status}>
                <Icon aria-hidden="true" />
                <span>{meta.label[locale]}</span>
              </span>
              <h2 id={titleId}>{item.scenario[locale]}</h2>
            </div>
            <button
              type="button"
              className="s-icon-btn"
              onClick={closeModal}
              aria-label={ui.close}
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <p className="s-small s-muted" style={{ margin: '0 0 18px' }}>
            {item.result[locale]}
          </p>

          <dl className="s-dl">
            <dt>{ui.source}</dt>
            <dd>
              <code className="s-mono">{item.sourcePath}</code>
            </dd>
            <dt>{ui.date}</dt>
            <dd className="s-num">{item.date}</dd>
            <dt>{ui.method}</dt>
            <dd>{item.method[locale]}</dd>
            <dt>{ui.commit}</dt>
            <dd>
              <code className="s-mono">{item.sha}</code> · <code className="s-mono">{item.id}</code>
            </dd>
            <dt>{ui.limits}</dt>
            <dd>{item.limits[locale]}</dd>
          </dl>

          <hr className="s-divider" style={{ margin: '18px 0' }} />

          <div className="s-between">
            <div className="s-row">
              <a
                href={localeHref(locale, 'evidence')}
                className="s-btn s-btn-secondary s-btn-sm"
                onClick={closeModal}
              >
                {ui.openRegister}
              </a>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="s-btn s-btn-ghost s-btn-sm"
              >
                <span>{ui.openSource}</span>
                <ExternalLink aria-hidden="true" />
              </a>
            </div>
            <button
              type="button"
              className="s-btn s-btn-primary s-btn-sm"
              onClick={closeModal}
            >
              {ui.close}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
