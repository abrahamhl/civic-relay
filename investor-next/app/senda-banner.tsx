/** Acceso público a SENDA Campo, la app offline-first verificada (ES / EN / NL). */
type Locale = 'en' | 'es' | 'nl';
const COPY: Record<Locale, { tag: string; title: string; body: string; cta: string; proof: string }> = {
  es: { tag: 'NUEVO · SENDA', title: 'SENDA: mensajes de emergencia que viajan sin Internet', body: 'Por sonido entre teléfonos, en archivos que se comparten sin red o de mano en mano a través de otros teléfonos. Cifrado de extremo a extremo; abre en modo avión.', cta: 'Abrir SENDA Campo', proof: 'Ver verificación' },
  en: { tag: 'NEW · SENDA', title: 'SENDA: emergency messages that travel without Internet', body: 'Over sound between phones, in files shared with no network, or hand to hand through other phones. End-to-end encrypted; opens in airplane mode.', cta: 'Open SENDA Field', proof: 'See verification' },
  nl: { tag: 'NIEUW · SENDA', title: 'SENDA: noodberichten die zonder internet reizen', body: 'Via geluid tussen telefoons, in bestanden die zonder netwerk worden gedeeld, of van hand tot hand via andere telefoons. End-to-end versleuteld; opent in vliegtuigmodus.', cta: 'SENDA Field openen', proof: 'Verificatie bekijken' },
};
export default function SendaBanner({ locale }: { locale: Locale }) {
  const c = COPY[locale] ?? COPY.en;
  return (
    <section className="senda-banner container" aria-label="SENDA">
      <div><span className="senda-tag">{c.tag}</span><h2>{c.title}</h2><p>{c.body}</p></div>
      <div className="senda-cta"><a className="senda-btn" href="/senda/index.html">{c.cta}</a><a className="senda-link" href="/senda/estado.html">{c.proof}</a></div>
    </section>
  );
}
