import { useEffect, useRef, useState } from 'react';
import { readSnapshotText, snapshotManifest } from '../data/bundle';
import { verifySnapshotManifest } from '../security/manifest.mjs';
import {
  generateAgreementIdentity,
  generateSigningIdentity,
} from '../security/crypto.mjs';
import { createEnvelope, verifyEnvelope } from '../security/envelope.mjs';
import {
  createOutbox,
  getTransportInventory,
  TRANSPORT_STATUS,
} from '../security/transport.mjs';

type SigningIdentity = Awaited<ReturnType<typeof generateSigningIdentity>>;
type AgreementIdentity = Awaited<ReturnType<typeof generateAgreementIdentity>>;
type Envelope = Awaited<ReturnType<typeof createEnvelope>>;
type Verification = Awaited<ReturnType<typeof verifyEnvelope>>;
type ManifestResult = Awaited<ReturnType<typeof verifySnapshotManifest>>;

function group(hex: string, size = 4): string {
  return hex.match(new RegExp(`.{1,${size}}`, 'g'))?.join(' ') ?? hex;
}

export function SecureLinkPanel() {
  const [signing, setSigning] = useState<SigningIdentity | null>(null);
  const [agreement, setAgreement] = useState<AgreementIdentity | null>(null);
  const [manifest, setManifest] = useState<ManifestResult | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [message, setMessage] = useState('SITREP: sector B despejado, 0 heridos.');
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [outboxState, setOutboxState] = useState({ queued: 0, acked: 0, status: '' });

  const outboxRef = useRef<ReturnType<typeof createOutbox> | null>(null);
  const inventory = getTransportInventory();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [signingIdentity, agreementIdentity] = await Promise.all([
          generateSigningIdentity(),
          generateAgreementIdentity(),
        ]);
        if (!alive) return;
        setSigning(signingIdentity);
        setAgreement(agreementIdentity);
      } catch (error) {
        if (alive) setManifestError(`Identidad no disponible: ${String(error)}`);
      }

      try {
        const result = await verifySnapshotManifest(snapshotManifest, readSnapshotText);
        if (alive) setManifest(result);
      } catch (error) {
        if (alive) setManifestError(`Verificación no disponible: ${String(error)}`);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!outboxRef.current) outboxRef.current = createOutbox();

  const signMessage = async (override?: string) => {
    if (!signing) return;
    const text = override ?? message;
    const created = await createEnvelope({
      kind: 'SITREP',
      payload: { message: text, channel: 'offline-demo' },
      senderPublicKeyRaw: signing.publicKeyRaw,
      privateKey: signing.privateKey,
      createdAt: new Date().toISOString(),
      ttlSeconds: 3600,
    });
    const result = await verifyEnvelope(created, {
      publicKey: signing.publicKey,
      publicKeyRaw: signing.publicKeyRaw,
    });
    setEnvelope(created);
    setVerification(result);
    setOutboxState((prev) => ({ ...prev, status: 'Firmado y verificado localmente' }));
  };

  const tamper = async () => {
    if (!envelope || !signing) return;
    const tampered = {
      ...envelope,
      payload: { message: 'SITREP: sector B NO despejado', channel: 'offline-demo' },
    };
    const result = await verifyEnvelope(tampered, {
      publicKey: signing.publicKey,
      publicKeyRaw: signing.publicKeyRaw,
    });
    setVerification(result);
    setOutboxState((prev) => ({ ...prev, status: 'Manipulación detectada: firma inválida' }));
  };

  const enqueue = async () => {
    if (!envelope || !outboxRef.current) return;
    const result = await outboxRef.current.enqueue(envelope, { verified: verification?.ok });
    const stats = outboxRef.current.stats();
    setOutboxState({
      queued: stats.QUEUED,
      acked: stats.ACKNOWLEDGED,
      status: result.accepted ? `Encolado · ${result.status}` : `Rechazado · ${result.status}`,
    });
  };

  const acknowledge = () => {
    if (!outboxRef.current) return;
    const next = outboxRef.current.pending()[0];
    if (!next) {
      setOutboxState((prev) => ({ ...prev, status: 'Nada pendiente de acuse' }));
      return;
    }
    outboxRef.current.ack(next.id, { by: 'peer-demo' });
    const stats = outboxRef.current.stats();
    setOutboxState({
      queued: stats.QUEUED,
      acked: stats.ACKNOWLEDGED,
      status: 'Acuse explícito del par registrado',
    });
  };

  return (
    <div className="view split">
      <div>
        <h2>Secure Link</h2>
        <p className="lede">
          Identidad Ed25519, acuerdo X25519 y sobre firmado con canonización estricta. Todo se
          ejecuta con WebCrypto local. Las claves viven en memoria: este build no las persiste ni
          las envía a ningún sitio.
        </p>

        <div className="card-grid">
          <article className="cap-card">
            <h3>Identidad de firma</h3>
            <span className="status" style={{ color: 'var(--ok)' }}>
              {signing ? 'ED25519_READY' : 'GENERATING'}
            </span>
            <p className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {signing ? group(signing.fingerprint) : '—'}
            </p>
            <div className="req">Huella = SHA-256 de la clave pública. Comparar fuera de banda.</div>
          </article>

          <article className="cap-card">
            <h3>Acuerdo de clave</h3>
            <span className="status" style={{ color: 'var(--info)' }}>
              {agreement ? 'X25519_READY' : 'GENERATING'}
            </span>
            <p className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
              {agreement ? group(agreement.publicKeyHex, 8) : '—'}
            </p>
            <div className="req">X25519 → HKDF-SHA-256 → AES-256-GCM</div>
          </article>

          <article className="cap-card">
            <h3>Transporte</h3>
            <span className="status" style={{ color: 'var(--warn)' }}>
              {inventory.status}
            </span>
            <p>Cola offline lista; ningún enlace de radio configurado en este build.</p>
            <div className="req">{inventory.offlineQueue}</div>
          </article>
        </div>

        <h3 className="section-label">Integridad del snapshot</h3>
        {manifestError && <div className="notice bad">{manifestError}</div>}
        {manifest && (
          <>
            <div className={`notice ${manifest.ok ? '' : 'bad'}`}>
              <strong>{manifest.ok ? 'PASS' : 'FAIL'}.</strong> {manifest.fileCount} archivos
              recomputados con SHA-256 sobre los bytes que renderiza la interfaz.
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Archivo</th>
                    <th>Bytes</th>
                    <th>SHA-256</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {manifest.results.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono" style={{ fontSize: 10.5 }}>
                        {entry.snapshotPath}
                      </td>
                      <td className="mono">
                        {entry.actualBytes}
                        {entry.sizeOk ? '' : ` ≠ ${entry.expectedBytes}`}
                      </td>
                      <td className="mono" style={{ fontSize: 10 }}>
                        {entry.actualSha256.slice(0, 24)}…
                      </td>
                      <td style={{ color: entry.ok ? 'var(--ok)' : 'var(--bad)' }}>
                        {entry.ok ? 'PASS' : 'FAIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 className="section-label">Sobre firmado</h3>
        <div className="vstack">
          <label className="field">
            <span>Mensaje</span>
            <textarea
              className="textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
            />
          </label>
          <div className="hstack">
            <button type="button" onClick={() => signMessage()} disabled={!signing}>
              Firmar y verificar
            </button>
            <button type="button" onClick={tamper} disabled={!envelope}>
              Manipular payload
            </button>
            <button type="button" onClick={enqueue} disabled={!envelope}>
              Encolar offline
            </button>
            <button type="button" onClick={acknowledge}>
              Acusar recibo del par
            </button>
          </div>
        </div>

        {verification && (
          <div
            className={`notice ${verification.ok ? '' : 'bad'}`}
            aria-live="polite"
            data-testid="verification-notice"
          >
            <strong>{verification.ok ? 'VERIFIED' : 'REJECTED'}.</strong>{' '}
            {verification.ok ? 'Firma, hash y vigencia correctos.' : verification.reasons.join(' · ')}
          </div>
        )}

        <div className="secure-meta">
          <div>
            <span className="k">Cola</span>
            <span className="v">{outboxState.queued} pendientes</span>
          </div>
          <div>
            <span className="k">Acuses</span>
            <span className="v">{outboxState.acked}</span>
          </div>
          <div>
            <span className="k">Estado</span>
            <span className="v">{outboxState.status || '—'}</span>
          </div>
        </div>

        {envelope && (
          <details className="details">
            <summary>Ver sobre canónico (JSON)</summary>
            <pre className="code-block">{JSON.stringify(envelope, null, 2)}</pre>
          </details>
        )}
      </div>

      <aside>
        <h3 className="section-label">Garantías y límites</h3>
        <div className="notice">
          <strong>Lo que este módulo sí garantiza</strong>
          <ul>
            {inventory.guarantees.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="notice warn">
          <strong>Lo que no garantiza</strong>
          <ul>
            {inventory.nonGuarantees.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="notice bad">
          <strong>Modo legal estricto</strong>
          <ul>
            <li>Sin rastreo de terceros ni identidades IMSI/IMSI-catcher.</li>
            <li>Sin SS7, sin operadores, sin localización sin consentimiento.</li>
            <li>Sin claves en disco en este build; producción exige keystore del SO.</li>
          </ul>
        </div>
        <div className="notice">
          <strong>Rutas no verificadas</strong>
          <ul>
            {inventory.unverifiedPaths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="notice sim">
          <strong>Clave en memoria:</strong> al recargar, la identidad cambia. Es intencional para
          no normalizar el almacenamiento inseguro de claves.
        </div>
        <div className="prov-chip" style={{ marginTop: 10 }}>
          {TRANSPORT_STATUS.OFFLINE_STORE_AND_FORWARD_READY}
        </div>
      </aside>
    </div>
  );
}
