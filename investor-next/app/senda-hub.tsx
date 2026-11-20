import type { Locale } from './copy';
import './senda-hub.css';

/**
 * Centro de contenidos de la portada: lleva a todo lo que existe (recorridos guiados, vídeos,
 * simulaciones, ciencia, artículos y pruebas) con imagen real y una línea que dice qué se verá.
 * Todas las imágenes y vídeos son archivos del propio sitio; ninguna cifra se inventa aquí.
 */
type Card = { href: string; img: string; t: string; d: string; tag: string };
type Vid = { src: string; poster: string; t: string; d: string };

const L = {
  es: {
    kicker: 'Empieza aquí', h: 'Todo SENDA, en un sitio.', lead: 'Elige por dónde entrar: un recorrido guiado de minutos, un vídeo, una simulación que puedes tocar, la ciencia que hay detrás o las pruebas automáticas que lo respaldan.',
    start: 'Recorridos guiados', videos: 'Vídeos', labs: 'Simulaciones y laboratorios', sci: 'Ciencia y artículos', proof: 'Pruebas', all: 'Ver todos los laboratorios',
    trs: 'Informe técnico · sin revisión por pares', pdf: 'PDF', read: 'Leer', sciPage: 'Laboratorio científico', sciD: 'Física, probabilidad y calibración que usa el núcleo.',
    proofT: 'Verificación técnica', proofD: 'Pruebas automáticas del núcleo y de la web, y afirmaciones públicas comprobadas por máquina.', note: 'Vídeos: grabaciones de la aplicación y de simulaciones; no son ensayos de campo.',
  },
  en: {
    kicker: 'Start here', h: 'All of SENDA, in one place.', lead: 'Pick a way in: a guided tour of a few minutes, a video, a simulation you can touch, the science behind it, or the automated tests that back it.',
    start: 'Guided tours (Spanish)', videos: 'Videos', labs: 'Simulations and labs', sci: 'Science and papers', proof: 'Evidence', all: 'See every lab',
    trs: 'Technical report · not peer reviewed', pdf: 'PDF', read: 'Read', sciPage: 'Science lab', sciD: 'Physics, probability and calibration used by the core.',
    proofT: 'Technical verification', proofD: 'Automated tests of the core and the web, and machine-checked public claims.', note: 'Videos: recordings of the app and of simulations; not field trials.',
  },
  nl: {
    kicker: 'Begin hier', h: 'Heel SENDA op één plek.', lead: 'Kies je ingang: een rondleiding van een paar minuten, een video, een simulatie om aan te raken, de wetenschap erachter of de geautomatiseerde tests.',
    start: 'Rondleidingen (Spaans)', videos: "Video's", labs: 'Simulaties en labs', sci: 'Wetenschap en papers', proof: 'Bewijs', all: 'Alle labs bekijken',
    trs: 'Technisch rapport · niet peer-reviewed', pdf: 'PDF', read: 'Lezen', sciPage: 'Wetenschapslab', sciD: 'Fysica, kansrekening en kalibratie in de kern.',
    proofT: 'Technische verificatie', proofD: 'Geautomatiseerde tests van kern en web, en machinaal gecontroleerde publieke claims.', note: "Video's: opnames van de app en van simulaties; geen veldproeven.",
  },
} as const;

const START: Record<Locale, Card[]> = {
  es: [
    { href: '/senda/viaje', img: '/senda/data/smv2026/tci_d0724.jpg', tag: 'Recorrido · 5 min', t: 'De Arnhem a San Martín sin cobertura', d: 'Cómo llega un mensaje cifrado a alguien sin red: relé, satélite, vecinos, LoRa, sonido y luz, con el código real.' },
    { href: '/senda/sala', img: '/media/senda-sala-poster-es.jpg', tag: 'Pantalla de operador', t: 'Sala de decisión · DANA real', d: 'Agua observada por Copernicus, calles cortadas y servicios afectados; cinco pasos hasta una alerta CAP firmada.' },
    { href: '/senda/explica', img: '/media/senda-explica-poster-es.jpg', tag: 'Explicado · Guía y Ciencia', t: 'SENDA en capítulos', d: 'El ojo, el camino, el mando y la sinestesia: piezas vivas con fotos reales y las ecuaciones de cada módulo.' },
  ],
  en: [], nl: [],
};
START.en = START.es.map((c, i) => ({ ...c, t: ['From Arnhem to San Martín with no signal', 'Decision room · real 2024 flood', 'SENDA in chapters'][i], d: ['How an encrypted message reaches someone with no network: relay, satellite, neighbours, LoRa, sound and light, with the real code.', 'Water observed by Copernicus, cut roads and affected services; five steps to a signed CAP alert.', 'The eye, the path, the command and synesthesia: live pieces with real photos and each module’s equations.'][i], tag: ['Tour · 5 min', 'Operator screen', 'Explained · Guide and Science'][i] }));
START.nl = START.es.map((c, i) => ({ ...c, t: ['Van Arnhem naar San Martín zonder bereik', 'Beslissingsruimte · echte overstroming', 'SENDA in hoofdstukken'][i], d: ['Hoe een versleuteld bericht iemand zonder netwerk bereikt: relay, satelliet, buren, LoRa, geluid en licht.', 'Door Copernicus waargenomen water, afgesloten wegen en getroffen diensten; vijf stappen tot een ondertekende CAP-melding.', 'Het oog, het pad, het commando en synesthesie: levende onderdelen met echte foto’s en vergelijkingen.'][i], tag: ['Rondleiding · 5 min', 'Operatorscherm', 'Uitgelegd · Gids en Wetenschap'][i] }));

const VIDEOS: Vid[] = [
  { src: '/media/senda-film-es.mp4', poster: '/media/senda-film-poster-es.jpg', t: 'La película de SENDA', d: 'Por qué existe, cómo funciona y qué está probado.' },
  { src: '/media/senda-ruta-es.mp4', poster: '/media/senda-ruta-poster-es.jpg', t: 'En la carretera', d: 'Ruta protectora, cámaras públicas y avisos a quien se acerca.' },
  { src: '/media/senda-capacidades-es.mp4', poster: '/media/senda-capacidades-poster-es.jpg', t: 'Capacidades', d: 'Lo que hace la app, pantalla a pantalla.' },
  { src: '/media/senda-sala-es.mp4', poster: '/media/senda-sala-poster-es.jpg', t: 'Sala de decisión', d: 'La DANA de l\'Horta Sud vista por cada cuerpo.' },
  { src: '/media/senda-demo/SENDA-demo-real-mensaje-sin-red.mp4', poster: '/media/senda-demo/SENDA-demo-real-mensaje-sin-red-poster.jpg', t: 'Mensaje sin red', d: 'Grabación de la app enviando sin conexión.' },
  { src: '/media/vision/dashcam.mp4', poster: '/media/vision/dashcam-poster.jpg', t: 'El coche también mira', d: 'Vehículos detectados y seguidos en vídeo real.' },
];

const LABS: Card[] = [
  { href: '/senda/consola', img: '/senda/fotos/app-consola-calor.jpg', tag: 'Geoespacial', t: 'Consola de situación', d: 'Globo 3D, situaciones fusionadas y muro de vídeo.' },
  { href: '/senda/fuego3d', img: '/senda/data/smv2026/tci_d0808.jpg', tag: 'Datos reales', t: 'Incendio en 3D', d: 'San Martín de Valdeiglesias con terreno, satélite y viento.' },
  { href: '/senda/camaras', img: '/senda/fotos/app-camara-dgt.jpg', tag: 'Cámaras públicas', t: 'Biblioteca de cámaras', d: 'Visibilidad medida con física; nunca mira a las personas.' },
  { href: '/senda/radio', img: '/senda/fotos/app-radio-poyo.jpg', tag: 'Relieve real', t: 'Radio sin red móvil', d: 'Dónde poner repetidores para cruzar un barranco.' },
  { href: '/senda/mulas', img: '/senda/fotos/app-mulas.jpg', tag: 'Horarios reales', t: 'Autobuses como mulas', d: 'Mensajes que viajan con la EMT de València.' },
  { href: '/senda/aislamiento', img: '/senda/fotos/app-aislamiento.jpg', tag: 'DANA 2024', t: 'Zonas aisladas', d: 'Qué calles quedaron cortadas y qué servicios sin acceso.' },
  { href: '/senda/atlas', img: '/senda/fotos/app-cordon.jpg', tag: 'OSINT con fuente', t: 'Atlas y perímetros', d: 'Satélite, cámaras y reportes en una línea de tiempo.' },
  { href: '/senda/consola', img: '/senda/fotos/app-nepal.jpg', tag: 'Sentinel-2', t: 'Nepal antes y después', d: 'Sobrevuelo 3D de la zona afectada.' },
];

const PAPERS = [
  { slug: 'tr-2026-01-proof-carrying-inference', t: 'Proof-Carrying Inference for Offline Emergency Software', d: 'Cada cifra del software de emergencias (probabilidades, intervalos, plazos) viaja con lo necesario para comprobar cómo se calculó.' },
  { slug: 'tr-2026-02-erasure-tails-dtn-bounds', t: 'Exact Erasure Tails and Delay Bounds for Store-Carry-Forward Emergency Messaging', d: 'La probabilidad exacta de que un mensaje troceado llegue, y cuánto tarda.' },
  { slug: 'tr-2026-03-display-determinism-ode', t: 'Display Determinism Across JavaScript Runtimes for Adaptive ODE Solvers', d: 'Por qué una simulación puede variar entre navegadores por detalles de coma flotante, y cómo mostrar resultados idénticos.' },
];

export default function SendaHub({ locale }: { locale: Locale }) {
  const c = L[locale] ?? L.es;
  const pre = locale === 'en' ? '' : `/${locale}`;
  return (
    <section className="hub" aria-labelledby="hub-h">
      <p className="hub-k">{c.kicker}</p>
      <h2 id="hub-h">{c.h}</h2>
      <p className="hub-lead">{c.lead}</p>

      <h3 className="hub-h3">{c.start}</h3>
      <div className="hub-start">
        {(START[locale] ?? START.es).map((x) => (
          <a key={x.href} href={x.href} className="hub-card hub-card--big">
            <span className="hub-img"><img src={x.img} alt="" loading="lazy" /></span>
            <span className="hub-tag">{x.tag}</span><strong>{x.t}</strong><span className="hub-d">{x.d}</span>
          </a>
        ))}
      </div>

      <h3 className="hub-h3">{c.videos}</h3>
      <div className="hub-videos">
        {VIDEOS.map((v) => (
          <figure key={v.src} className="hub-video">
            <video src={v.src} poster={v.poster} controls preload="none" playsInline />
            <figcaption><strong>{v.t}</strong><span>{v.d}</span></figcaption>
          </figure>
        ))}
      </div>
      <p className="hub-note">{c.note}</p>

      <h3 className="hub-h3">{c.labs}</h3>
      <div className="hub-labs">
        {LABS.map((x) => (
          <a key={x.t} href={x.href} className="hub-card">
            <span className="hub-img"><img src={x.img} alt="" loading="lazy" /></span>
            <span className="hub-tag">{x.tag}</span><strong>{x.t}</strong><span className="hub-d">{x.d}</span>
          </a>
        ))}
      </div>
      <p><a className="hub-more" href="/senda/explica#plataforma">{c.all} →</a></p>

      <div className="hub-split">
        <div>
          <h3 className="hub-h3">{c.sci}</h3>
          <ul className="hub-papers">
            {PAPERS.map((p) => (
              <li key={p.slug}><span className="hub-tag">{c.trs}</span><strong>{p.t}</strong><span className="hub-d">{p.d}</span>
                <span className="hub-links"><a href={`/research/${p.slug}.html`}>{c.read}</a><a href={`/research/${p.slug}.pdf`}>{c.pdf}</a></span></li>
            ))}
            <li><span className="hub-tag">{c.sciPage}</span><strong><a href={`${pre}/science/`}>{c.sciPage}</a></strong><span className="hub-d">{c.sciD}</span></li>
          </ul>
        </div>
        <div>
          <h3 className="hub-h3">{c.proof}</h3>
          <a className="hub-card hub-proof" href="/senda/estado"><strong>{c.proofT}</strong><span className="hub-d">{c.proofD}</span></a>
        </div>
      </div>
    </section>
  );
}
