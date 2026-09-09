/** Informational placeholder only; not wired into the demo dispatch path. */
export function KeySetup() {
  return (
    <section style={{ padding: '1rem', margin: '1rem' }}>
      <h2>Gestión de claves experimental: desactivada</h2>
      <p>
        Esta demo utiliza datos ficticios y no ofrece cifrado de extremo a extremo
        en el envío de mensajes. No introduzcas datos personales ni emergencias reales.
      </p>
      <p>
        Este componente no genera ni guarda claves. No hay frase de recuperación
        ni garantía de recuperación de cuentas. No implica certificación ENS ni CCN-CERT.
      </p>
    </section>
  );
}
