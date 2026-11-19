import { PROVENANCE_LABEL, PROVENANCE_TONE } from '../data/adapter.mjs';

export function ProvenanceChip({ provenance }: { provenance: string }) {
  const tone = PROVENANCE_TONE[provenance as keyof typeof PROVENANCE_TONE] ?? 'muted';
  const label = PROVENANCE_LABEL[provenance as keyof typeof PROVENANCE_LABEL] ?? provenance;
  return (
    <span className="prov-chip" title={`${provenance} — ${label}`}>
      <span className={`dot ${tone}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function StatusDot({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="hstack" style={{ gap: 6 }}>
      <span className={`dot ${tone}`} aria-hidden="true" />
      <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{label}</span>
    </span>
  );
}
