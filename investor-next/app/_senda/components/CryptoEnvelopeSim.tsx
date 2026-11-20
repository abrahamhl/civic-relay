'use client';

import { useState } from 'react';
import { CheckCircle2, EyeOff, KeyRound, Lock, Radio, ShieldCheck, Trash2 } from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import type { Locale, LocalizedText } from '../data/types';

interface CryptoStage {
  num: string;
  label: LocalizedText;
  title: LocalizedText;
  detail: LocalizedText;
  visibleToRelay: LocalizedText;
  payloadPreview: string;
  accent: string;
}

const STAGES: CryptoStage[] = [
  {
    num: '01',
    label: { es: 'Mensaje Original', en: 'Origin Message', nl: 'Oorspronkelijk Bericht' },
    title: {
      es: 'El ciudadano redacta su aviso en local (nunca sale en texto claro)',
      en: 'Citizen drafts alert locally (never leaves the handset in plaintext)',
      nl: 'Burger maakt melding lokaal (verlaat toestel nooit onversleuteld)'
    },
    detail: {
      es: 'El aviso ("Estoy bien en planta 3, 2 personas") se procesa íntegramente en la memoria del navegador o Android sin pasar por servidores externos.',
      en: 'The message ("Safe on floor 3, 2 people") stays strictly inside local device memory with zero cloud roundtrips.',
      nl: 'Het bericht blijft strikt in lokaal apparaatgeheugen zonder cloudverbinding.'
    },
    visibleToRelay: {
      es: 'Solo el emisor ve el texto claro antes de sellarlo.',
      en: 'Only the sender sees plaintext before sealing.',
      nl: 'Alleen de verzender ziet platte tekst vóór verzegeling.'
    },
    payloadPreview: '{"type":"SAFE","lat":39.469,"lon":-0.376,"people":2,"ttl":3600}',
    accent: '#38bdf8'
  },
  {
    num: '02',
    label: { es: 'Cifrado E2EE + Firma', en: 'E2EE Seal + Signature', nl: 'E2EE + Handtekening' },
    title: {
      es: 'Sellado criptográfico ECDH P-256 + AES-256-GCM + firma ECDSA',
      en: 'Cryptographic seal with ECDH P-256 + AES-256-GCM + ECDSA signature',
      nl: 'Cryptografische verzegeling met ECDH P-256 + AES-256-GCM + ECDSA'
    },
    detail: {
      es: 'WebCrypto genera una clave efímera compartida para el destinatario, cifra el cuerpo con autenticación GCM y firma el hash SHA-256 para impedir manipulaciones.',
      en: 'WebCrypto derives an ephemeral shared key for the recipient, encrypts the body with authenticated GCM, and signs the SHA-256 digest.',
      nl: 'WebCrypto genereert een tijdelijke gedeelde sleutel en ondertekent de SHA-256-hash.'
    },
    visibleToRelay: {
      es: 'Texto ilegible (ciphertext opaco) + cabecera mínima de enrutamiento.',
      en: 'Opaque ciphertext + minimal routing header only.',
      nl: 'Onleesbare ciphertext + minimale routeringsheader.'
    },
    payloadPreview: 'OEPv1|dst:9f2a..c4|pri:P0|ttl:3600|ct:8b41e90f7a..3d|sig:ecdsa-p256',
    accent: '#a78bfa'
  },
  {
    num: '03',
    label: { es: 'Fragmentos k-de-n', en: 'k-of-n Shards', nl: 'k-van-n Fragmenten' },
    title: {
      es: 'División Reed-Solomon k-de-n para sobrevivir pérdidas parciales',
      en: 'Reed-Solomon k-of-n sharding to survive partial packet drops',
      nl: 'Reed-Solomon k-van-n fragmentatie tegen pakketverlies'
    },
    detail: {
      es: 'El sobre cifrado se fragmenta en 5 piezas independientes: si 2 se pierden por interferencia o agotamiento de batería, cualquiera de las 3 restantes reconstruye el 100 %.',
      en: 'The sealed envelope splits into 5 shards: even if 2 vanish due to interference or battery loss, any 3 reconstruct 100% of the message.',
      nl: 'De verzegelde envelop splitst in 5 stukken: elke 3 van de 5 herstellen 100% van het bericht.'
    },
    visibleToRelay: {
      es: 'Cada teléfono vecino solo guarda 1 o 2 fragmentos cifrados e indescifrables.',
      en: 'Neighboring phones carry only undecipherable encrypted shards.',
      nl: 'Naburige toestellen dragen alleen onleesbare versleutelde fragmenten.'
    },
    payloadPreview: '[SHARD 1/5 OK] [SHARD 2/5 OK] [SHARD 3/5 OK] [SHARD 4/5] [SHARD 5/5]',
    accent: '#22d3ee'
  },
  {
    num: '04',
    label: { es: 'Relé Ciego RGPD', en: 'Blind GDPR Relay', nl: 'Blinde AVG-Relay' },
    title: {
      es: 'Transporte en relé ciego sin identidad personal ni rastreo',
      en: 'Blind relay transport with zero PII and k-anonymity (k >= 5)',
      nl: 'Blind relaytransport zonder persoonsgegevens en k-anonimiteit'
    },
    detail: {
      es: 'Los móviles intermedios reenvían el paquete únicamente por prioridad P0, hash de destino y TTL. Ni los relés ni las pasarelas pueden leer quién escribe ni qué dice.',
      en: 'Intermediate phones forward strictly by P0 priority, destination hash, and TTL. Neither relays nor gateways can read sender or content.',
      nl: 'Tussenstations sturen uitsluitend door op prioriteit, bestemmingshash en TTL.'
    },
    visibleToRelay: {
      es: '0 nombres, 0 teléfonos, 0 matrículas, 0 vídeo almacenado.',
      en: '0 names, 0 phone numbers, 0 plates, 0 stored video.',
      nl: '0 namen, 0 telefoonnummers, 0 kentekens, 0 opgeslagen video.'
    },
    payloadPreview: 'RELAY_HOP#2 -> blind_forward(hash=9f2a..c4, ttl=3412s, readable=FALSE)',
    accent: '#fbbf24'
  },
  {
    num: '05',
    label: { es: 'ACK Firmado + Purga', en: 'Signed ACK + Purge', nl: 'ACK + Automatisch Wissen' },
    title: {
      es: 'Recibo criptográfico y borrado automático fail-closed en toda la cadena',
      en: 'Signed cryptographic receipt & automatic fail-closed erasure',
      nl: 'Cryptografische bevestiging & automatische fail-closed wissing'
    },
    detail: {
      es: 'El destinatario descifra, emite un ACK firmado y propaga una lápida anti-replay. Los relés purgan los fragmentos de IndexedDB al instante (y pulsar STOP borra toda la sesión).',
      en: 'The recipient decrypts, emits a signed ACK, and propagates an anti-replay tombstone. Relays wipe shards from IndexedDB immediately (and STOP erases the session).',
      nl: 'De ontvanger ontsleutelt, stuurt een ondertekende ACK en wist kopieën direct bij alle relays.'
    },
    visibleToRelay: {
      es: 'Cola purgada: 0 bytes retenidos tras confirmación o caducidad TTL.',
      en: 'Queue purged: 0 bytes retained after ACK or TTL expiration.',
      nl: 'Wachtrij gewist: 0 bytes bewaard na ACK of TTL.'
    },
    payloadPreview: 'ACK_VERIFIED(ecdsa=VALID) -> TOMBSTONE_PURGE(relays_wiped=100%, bytes_left=0)',
    accent: '#34d399'
  }
];

export default function CryptoEnvelopeSim({ locale }: { locale: Locale }) {
  const [step, setStep] = useState(0);
  const current = STAGES[step] ?? STAGES[0];
  const icons = [KeyRound, Lock, Radio, EyeOff, Trash2];

  const ui = {
    es: {
      eyebrow: 'SIMULADOR INTERACTIVO DE PRIVACIDAD Y CIFRADO',
      title: 'Recorre paso a paso qué ve (y qué jamás puede ver) un teléfono relé.',
      lead: 'Pulsa cada fase 01–05 para inspeccionar cómo SENDA protege criptográficamente cada aviso sin servidores centrales y borra sus rastros al confirmar entrega.',
      relaySees: 'QUÉ VE UN TELÉFONO INTERMEDIO EN ESTA FASE',
      wirePreview: 'TRAZA BINARIA / PROTOCOLO OEP EN TRÁNSITO'
    },
    en: {
      eyebrow: 'INTERACTIVE PRIVACY & E2EE LIFECYCLE SIMULATOR',
      title: 'Step through what an intermediate relay sees—and can never read.',
      lead: 'Tap steps 01–05 to inspect how SENDA seals every emergency alert without central servers and auto-purges relay queues upon signed receipt.',
      relaySees: 'WHAT AN INTERMEDIATE RELAY SEES AT THIS STAGE',
      wirePreview: 'WIRE / OEP PROTOCOL TRACE'
    },
    nl: {
      eyebrow: 'INTERACTIEVE PRIVACY- & E2EE-SIMULATOR',
      title: 'Zie stap voor stap wat een tussenliggende telefoon wél en niet kan lezen.',
      lead: 'Klik op stappen 01–05 om te zien hoe SENDA noodberichten end-to-end verzegelt zonder centrale servers en na ACK direct wist.',
      relaySees: 'WAT EEN TUSSENSTATION ZIET IN DEZE FASE',
      wirePreview: 'PROTOCOLTRACE IN TRANSIT'
    }
  }[locale];

  return (
    <section className="s-section-tight" data-testid="crypto-envelope-sim">
      <div className="s-container s-stack-lg">
        <div className="s-between">
          <div className="s-read">
            <p className="s-eyebrow">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>{ui.eyebrow}</span>
            </p>
            <h2 className="s-h2">{ui.title}</h2>
            <p className="s-lead">{ui.lead}</p>
          </div>
          <EvidenceBadge locale={locale} evidenceId="EV-CORE-506" />
        </div>

        <div className="s-crypto-steps" role="tablist" aria-label={ui.title}>
          {STAGES.map((st, idx) => {
            const Icon = icons[idx] ?? Lock;
            return (
              <button
                key={st.num}
                type="button"
                role="tab"
                aria-selected={step === idx}
                className="s-innov-tab"
                onClick={() => setStep(idx)}
                data-testid={`crypto-step-${st.num}`}
              >
                <span className="s-innov-tab-top" style={{ color: st.accent }}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="s-mono">{st.num}</span>
                </span>
                <span className="s-innov-tab-title">{st.label[locale]}</span>
              </button>
            );
          })}
        </div>

        <div className="s-innov-panel" style={{ borderColor: `color-mix(in srgb, ${current.accent} 45%, var(--s-line-strong))` }}>
          <h3 className="s-h3" style={{ marginTop: 0 }}>{current.title[locale]}</h3>
          <p className="s-small s-muted" style={{ marginTop: 6, marginBottom: 14 }}>{current.detail[locale]}</p>

          <div className="s-grid s-grid-2" style={{ gap: 14 }}>
            <div className="s-innov-block is-innov" style={{ borderLeftColor: current.accent }}>
              <div className="s-innov-label">
                <CheckCircle2 size={13} aria-hidden="true" />
                <span>{ui.relaySees}</span>
              </div>
              <p>{current.visibleToRelay[locale]}</p>
            </div>

            <div className="s-innov-block is-how">
              <div className="s-innov-label">
                <Lock size={13} aria-hidden="true" />
                <span>{ui.wirePreview}</span>
              </div>
              <code className="s-mono" style={{ fontSize: 12, color: current.accent, wordBreak: 'break-all' }}>
                {current.payloadPreview}
              </code>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
