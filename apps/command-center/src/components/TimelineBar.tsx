import type { TimelineEvent } from '../types';
import { ProvenanceChip } from './ProvenanceChip';

export function TimelineBar({
  events,
  onPick,
}: {
  events: TimelineEvent[];
  onPick: (event: TimelineEvent) => void;
}) {
  return (
    <footer className="timeline" aria-label="Banda temporal de eventos">
      <div className="timeline-head">
        <h3>Eventos y recibos</h3>
        <span className="muted" style={{ fontSize: 11 }}>
          {events.length} eventos · orden descendente · UTC cuando el proveedor lo publica
        </span>
      </div>
      <div className="timeline-track">
        {events.map((event) => (
          <button type="button" className="event" key={event.id} onClick={() => onPick(event)}>
            <span className="when">{event.atUTC ?? 'sin fecha'}</span>
            <span className="what">{event.title}</span>
            <span className="prov">
              <ProvenanceChip provenance={event.provenance} />
            </span>
          </button>
        ))}
      </div>
    </footer>
  );
}
