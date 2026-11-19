import type { Locale } from '../copy';
import '../senda-home.css';

/**
 * Bóveda de defensa · material audiovisual de doble uso (contramedidas UAV, soberanía y defensa).
 * Se movió aquí desde la portada civil (senda-home.tsx) SIN cambiar su contenido.
 */
const C = {
  es: {
    breakthroughT: 'Gran Telediario de Innovación: Radar Acústico Táctico, Detección de Fibra Óptica y Centinelas COTS',
    breakthroughMeta: '07:30 UTC · Telediario Especial · Locución Femenina (ef_dora) · Subtítulos ES / EN / NL',
    breakthroughNote: 'Investigación técnica sobre la detección pasiva de drones por fibra óptica sin radio (0 dBm RF), triangulación acústica TDoA con teléfonos móviles, microfonía cardioide/shotgun y nodo centinela de 11,70 € en hardware COTS.',
    roleInvT: 'Modo Inversionista & Defensa (60 s)',
    roleInvDesc: 'Soberanía nacional, contratos de protección civil y defensa, escalabilidad masiva con hardware comercial de 24 € y retorno estratégico sobre algoritmos propietarios.',
    reel2T: 'Caza de Drones por 25 €',
    reel2Desc: 'Construyendo un sensor táctico con AliExpress y decodificando la posición del piloto con ASTM F3411.',
    reel4T: 'Soberanía y Defensa Nacional',
    reel4Desc: 'Por qué los gobiernos invierten en redes tácticas ad-hoc para proteger sus infraestructuras críticas.',
    reel5T: 'Centinela 11 € y Supervivencia Civil',
    reel5Desc: 'Detección de drones de fibra óptica, vector de evasión silencioso y baliza ultrasónica de socorro.',
    reelsT: 'Reels de defensa y contramedidas UAV',
  },
  en: {
    breakthroughT: 'Special Innovation Broadcast: Tactical Acoustic Radar, Fiber-Optic Detection & COTS Sentinels',
    breakthroughMeta: '07:30 UTC · Broadcast News Format · Female Narration (ef_dora) · Subtitles ES / EN / NL',
    breakthroughNote: 'Technical investigation on passive detection of radio-silent fiber-optic drones (0 dBm RF), acoustic TDoA smartphone multilateration, cardioid/shotgun beamforming, and 11.70 € COTS sentinel nodes.',
    roleInvT: 'Investor & Sovereign Defence Mode (60 s)',
    roleInvDesc: 'Sovereign resilience, civil protection and defence procurement, mass scalability with accessible 24 € COTS modules and multi-million value on proprietary algorithms.',
    reel2T: 'Hunting Drones for 25 €',
    reel2Desc: 'Building a tactical sensor with AliExpress chips and decoding the remote pilot ground location via ASTM F3411.',
    reel4T: 'Sovereign National Defence',
    reel4Desc: 'Why governments and defence forces invest in sovereign ad-hoc meshes to protect critical territory.',
    reel5T: '11 € Sentinel & Civil Survival',
    reel5Desc: 'Detection of silent fiber-optic drones, silent evasion vector and inaudible ultrasonic rescue beacon.',
    reelsT: 'Defence and counter-UAV reels',
  },
  nl: {
    breakthroughT: 'Speciaal Innovatiebulletin: Tactische Akoestische Radar, Glasvezeldetectie & COTS Sentinels',
    breakthroughMeta: '07:30 UTC · Nieuwsbulletin-formaat · Vrouwelijke Stem (ef_dora) · Ondertitels ES / EN / NL',
    breakthroughNote: 'Technisch onderzoek naar passieve detectie van radiostille glasvezeldrones (0 dBm RF), TDoA-smartphone multilateratie, directionele microfoons en COTS sentinel-knooppunten van 11,70 €.',
    roleInvT: 'Investeerders- & Defensiemodus (60 s)',
    roleInvDesc: 'Nationale soevereiniteit, overheidscontracten voor civiele bescherming en defensie, massale schaalbaarheid met COTS-hardware van 24 € en strategisch rendement op gepatenteerde algoritmen.',
    reel2T: 'Dronejacht voor 25 €',
    reel2Desc: 'Een tactische sensor bouwen met AliExpress-chips en de positie van de piloot decoderen via ASTM F3411.',
    reel4T: 'Soevereine Nationale Defensie',
    reel4Desc: 'Waarom overheden en defensiediensten investeren in soevereine ad-hocnetwerken om kritieke infrastructuur te beschermen.',
    reel5T: '11 € Sentinel & Burgeroverleving',
    reel5Desc: 'Detectie van stille glasvezeldrones, stille uitwijkingsvector en onhoorbaar ultrasoon reddingsbaken.',
    reelsT: 'Reels over defensie en anti-UAV',
  },
} as const;

export default function DefenseVaultMedia({ locale }: { locale: Locale }) {
  const c = C[locale];
  return (
    <section className="senda-home" aria-labelledby="vault-media-title">
      <h2 id="vault-media-title" className="sh-h2" style={{ position: 'absolute', left: '-9999px' }}>{c.reelsT}</h2>
      <div className="sh-broadcast" id="vault-telediario">
        {/* NUEVO GRAN TELEDIARIO DE INNOVACIÓN */}
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px dashed rgba(255,255,255,0.2)' }}>
          <div className="sh-broadcast-head">
            <span className="sh-broadcast-badge" style={{ background: '#0284c7', borderColor: '#38bdf8' }}><i aria-hidden="true"/> BREAKTHROUGH 2026 · RADAR CIVIL ANTIDRÓN</span>
            <span className="sh-broadcast-meta">{c.breakthroughMeta}</span>
          </div>
          <h2 className="sh-h2" style={{ marginTop: '6px' }}>{c.breakthroughT}</h2>
          <video
            id="senda-m95-session-breakthrough-video"
            controls
            preload="metadata"
            playsInline
            poster="/media/m95/senda-m95-session-breakthrough-poster.jpg"
            aria-label={c.breakthroughT}
          >
            <source src="/media/m95/senda-m95-session-breakthrough-es.mp4" type="video/mp4"/>
            <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-session-breakthrough-es.vtt" default={locale === 'es'}/>
          </video>
          <p className="sh-note">{c.breakthroughNote}</p>
          <p className="sh-note">
            <a href="/media/m95/senda-m95-session-breakthrough-es.mp4" download>Descargar Vídeo Completo Telediario Especial de Innovación (MP4)</a>
          </p>
        </div>
      </div>

      <div className="sh-film" id="vault-roles">
        <div className="sh-roles-grid">
          <article className="sh-role-card">
            <h3>{c.roleInvT}</h3>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-role-investor-poster.jpg"
              aria-label={c.roleInvT}
            >
              <source src={`/media/m95/senda-m95-role-investor-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-role-investor-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-role-investor-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-role-investor-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.roleInvDesc}</p>
          </article>
        </div>
      </div>

      <div className="sh-film" id="vault-reels">
        <h2 className="sh-h2">{c.reelsT}</h2>
        <div className="sh-reels-grid">
          <article className="sh-reel-card">
            <h4>{c.reel2T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-drones-poster.jpg"
              aria-label={c.reel2T}
            >
              <source src={`/media/m95/senda-m95-reel-drones-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-drones-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-drones-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-drones-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel2Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel4T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-defense-poster.jpg"
              aria-label={c.reel4T}
            >
              <source src={`/media/m95/senda-m95-reel-defense-${locale === 'es' ? 'es' : 'en'}.mp4`} type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-defense-es.vtt" default={locale === 'es'}/>
              <track kind="subtitles" srcLang="en" label="English" src="/media/m95/senda-m95-reel-defense-en.vtt" default={locale === 'en'}/>
              <track kind="subtitles" srcLang="nl" label="Nederlands" src="/media/m95/senda-m95-reel-defense-nl.vtt" default={locale === 'nl'}/>
            </video>
            <p>{c.reel4Desc}</p>
          </article>
          <article className="sh-reel-card">
            <h4>{c.reel5T}</h4>
            <video
              controls
              preload="metadata"
              playsInline
              poster="/media/m95/senda-m95-reel-sentinel-survival-poster.jpg"
              aria-label={c.reel5T}
            >
              <source src="/media/m95/senda-m95-reel-sentinel-survival-es.mp4" type="video/mp4"/>
              <track kind="subtitles" srcLang="es" label="Español" src="/media/m95/senda-m95-reel-sentinel-survival-es.vtt" default={locale === 'es'}/>
            </video>
            <p>{c.reel5Desc}</p>
            <p style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
              <a href="/media/m95/senda-m95-reel-sentinel-survival-es.mp4" download>Descargar Reel 9:16 (MP4)</a>
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
