'use client';

import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Car,
  ExternalLink,
  Flame,
  Mountain,
  TrainFront,
  Waves
} from 'lucide-react';
import type { AudienceMode } from './AudienceLens';
import EvidenceBadge from './EvidenceBadge';
import { localeHref, type Locale } from '../data/types';

type CrisisId = 'spain-rail' | 'valencia-dana' | 'indonesia-nepal' | 'venezuela-seismic' | 'traffic-v16' | 'wildfire-3d' | 'nl-water';

interface CrisisEntry {
  id: CrisisId;
  region: Record<Locale, string>;
  inspiration: Record<Locale, string>;
  title: Record<Locale, string>;
  stats: Array<{ value: string; label: Record<Locale, string> }>;
  copy: Record<AudienceMode, Record<Locale, string>>;
  visualSvg?: string;
  actionHref: string;
  actionLabel: Record<Locale, string>;
  labHref: string;
  labLabel: Record<Locale, string>;
  evidenceId: string;
}

const CRISES: CrisisEntry[] = [
  {
    id: 'spain-rail',
    region: { en: 'Spain · Europe', es: 'España · Europa', nl: 'Spanje · Europa' },
    inspiration: {
      en: 'Inspired by Spanish railway incidents (Adamuz, Gelida) & Tempi / Balasore patterns',
      es: 'Inspirado en accidentes ferroviarios en España (Adamuz, Gelida) y patrones Tempi / Balasore',
      nl: 'Geïnspireerd door spoorincidenten in Spanje (Adamuz, Gelida) & Tempi / Balasore'
    },
    title: {
      en: 'Multi-Train Rail Accidents & Track Failure Prevention',
      es: 'Accidentes Ferroviarios y Prevención en Vía',
      nl: 'Spoorongevallen & Preventie op het Spoor'
    },
    stats: [
      { value: '5,100 m/s', label: { en: 'Guided ultrasonic rail wave', es: 'Onda ultrasónica en carril', nl: 'Geleide ultrasone golf' } },
      { value: '< 10 s', label: { en: 'Multi-train impact fusion', es: 'Fusión multi-tren de impactos', nl: 'Meer-trein impactfusie' } },
      { value: '3 bearers', label: { en: 'BLE + LoRa + Rail acoustic', es: 'BLE + LoRa + Acústica en túnel', nl: 'BLE + LoRa + Tunnelgeluid' } }
    ],
    copy: {
      citizen: {
        en: 'When two trains collide or derail in a rural cutting or tunnel with no mobile coverage, passengers’ phones combine their impact sensors automatically so rescuers instantly know how many trains and carriages are involved.',
        es: 'Si un tren descarrila o colisiona en una trinchera o túnel sin cobertura, los móviles de los pasajeros combinan sus sensores de impacto automáticamente para que el 112 sepa al instante cuántos trenes y vagones están afectados.',
        nl: 'Bij een ontsporing of botsing in een tunnel zonder bereik combineren passagierstelefoons hun impactmetingen zodat hulpdiensten direct zien hoeveel treinen en rijtuigen zijn betrokken.'
      },
      investor: {
        en: 'Full five-module railway physics suite addressing single-track conflicts, Kerr thermal buckling (sun kinks), guided-wave crack detection, T2V level crossings, and zero-coverage tunnel beacons.',
        es: 'Suite ferroviaria de 5 módulos físicos que cubre conflictos de vía única, pandeo térmico Kerr, detección ultrasónica de roturas, pasos a nivel T2V y balizas multimodales en túnel.',
        nl: 'Vijfdelige spoorveiligheidssuite voor enkelspoorconflicten, thermische spoorvervorming, scheurdetectie, T2V-overwegen en tunnelbakens.'
      },
      engineer: {
        en: 'Combines multi-passenger accelerometer clustering (/senda/incidente.html), Kerr thermal track buckling solver, 5,100 m/s guided wave attenuation, and C-ITS road-rail relay (RailSafetyLab).',
        es: 'Combina clustering multi-pasajero de acelerómetros (/senda/incidente.html), modelo de pandeo térmico Kerr, ondas guiadas a 5.100 m/s y puente C-ITS tren-carretera (RailSafetyLab).',
        nl: 'Combineert versnellingsmeter-clustering, Kerr-knikmodel, 5.100 m/s geleide golven en C-ITS trein-weg-relays.'
      }
    },
    visualSvg: '/media/renders/render-rail-safety-topology.svg',
    actionHref: '/senda/incidente.html',
    actionLabel: { en: 'Open Rail Incident Fusion', es: 'Abrir Fusión Ferroviaria', nl: 'Open Spoorincidentfusie' },
    labHref: '#labs',
    labLabel: { en: 'Test live in Rail Safety Lab', es: 'Probar en Laboratorio Ferroviario', nl: 'Test in Spoorveiligheidslab' },
    evidenceId: 'EV-RAIL-ADAMUZ'
  },
  {
    id: 'valencia-dana',
    region: { en: 'Valencia · Spain', es: 'Valencia · España', nl: 'Valencia · Spanje' },
    inspiration: {
      en: 'Born directly from the Valencia DANA floods (l’Horta Sud · Copernicus EMSR773)',
      es: 'Nacido directamente de las riadas de Valencia (DANA l’Horta Sud · Copernicus EMSR773)',
      nl: 'Direct geboren uit de overstromingen in Valencia (DANA · Copernicus EMSR773)'
    },
    title: {
      en: 'Flash Floods & Isolated Neighborhoods',
      es: 'Riadas Súbitas y Barrios Aislados (DANA)',
      nl: 'Plotselinge Overstromingen & Geïsoleerde Wijken'
    },
    stats: [
      { value: '489.5 km', label: { en: 'Flooded streets mapped (EMSR773)', es: 'Calles en agua (EMSR773)', nl: 'Overstroomde straten (EMSR773)' } },
      { value: '1,326', label: { en: 'Dry junctions isolated from services', es: 'Cruces secos incomunicados', nl: 'Afgesloten droge kruispunten' } },
      { value: '4 min', label: { en: 'Multipath family status vs 8 h outage', es: 'Aviso familiar vs 8 h sin red', nl: 'Familiebericht vs 8 u uitval' } }
    ],
    copy: {
      citizen: {
        en: 'During the Valencia floods, thousands of families were cut off without electricity or mobile signal while dry streets were surrounded by water. SENDA maps who is trapped and lets "I am safe" or "Need rescue" hop out over nearby phones and satellites.',
        es: 'En la riada de Valencia, miles de familias quedaron sin luz ni cobertura rodeadas por agua. SENDA calcula al momento qué calles secas quedan incomunicadas y saca los avisos de "Estoy bien" o "Auxilio" por móviles vecinos y satélite.',
        nl: 'Tijdens de overstromingen in Valencia zaten duizenden gezinnen zonder stroom en bereik. SENDA brengt afgesloten straten in kaart en leidt familieberichten via nabije toestellen en satellieten naar buiten.'
      },
      investor: {
        en: 'Fuses real Copernicus EMS satellite flood footprints with live OpenStreetMap road graphs (multi-source Dijkstra) so emergency centers prioritize cut-off zones rather than flooded roads.',
        es: 'Cruza huella real de agua de Copernicus EMS con el grafo vial OpenStreetMap (Dijkstra multi-origen) para que Protección Civil priorice zonas secas aisladas en minutos.',
        nl: 'Combineert Copernicus EMS-satellietdata met OpenStreetMap-wegennetwerken (Dijkstra) voor directe prioritering van afgesloten wijken.'
      },
      engineer: {
        en: 'Deterministic multi-origin Dijkstra reachability engine in flood-isolation.mjs crossing OSM road graphs with Copernicus EMSR773 polygons + ITU-R P.526 DEM repeater placement.',
        es: 'Motor determinista Dijkstra multi-origen en flood-isolation.mjs cruzando OpenStreetMap con polígonos Copernicus EMSR773 más colocación de repetidores ITU-R P.526 sobre DEM.',
        nl: 'Deterministische multi-origin Dijkstra-bereikbaarheid in flood-isolation.mjs met Copernicus EMSR773 en ITU-R P.526 repeaterplanning.'
      }
    },
    visualSvg: '/media/renders/render-itu-p838-rain-curve.svg',
    actionHref: '/senda/aislamiento.html',
    actionLabel: { en: 'Open Flood Isolation Map', es: 'Abrir Mapa de Aislamiento DANA', nl: 'Open Overstromingskaart' },
    labHref: '/es/platform/',
    labLabel: { en: 'Open in Control Center', es: 'Ver en Centro de Control', nl: 'Open in Controlecentrum' },
    evidenceId: 'EV-FLOOD-DANA'
  },
  {
    id: 'indonesia-nepal',
    region: { en: 'Indonesia · Nepal · Asia', es: 'Indonesia · Nepal · Asia', nl: 'Indonesië · Nepal · Azië' },
    inspiration: {
      en: 'Inspired by monsoon floods in Indonesia & the Langtang Valley landslide/earthquake in Nepal',
      es: 'Inspirado en las riadas de Indonesia y los deslizamientos y terremotos de Nepal (Langtang)',
      nl: 'Geïnspireerd door moessonoverstromingen in Indonesië & de aardverschuiving in Langtang, Nepal'
    },
    title: {
      en: 'Monsoon Floods, Mountain Valleys & Landslides',
      es: 'Riadas Monzónicas, Deslizamientos y Valles Aislados',
      nl: 'Moessonoverstromingen & Bergvalleien'
    },
    stats: [
      { value: '30 m DEM', label: { en: 'Copernicus GLO-30 3D relief', es: 'Relieve 3D Copernicus GLO-30', nl: 'Copernicus GLO-30 3D-reliëf' } },
      { value: 'NDVI', label: { en: 'Pre/post Sentinel-2 scar change', es: 'Cambio Sentinel-2 pre/post', nl: 'Sentinel-2 voor/na-verandering' } },
      { value: 'M 5.2', label: { en: 'USGS real seismic catalog fused', es: 'Catálogo sísmico USGS real', nl: 'Echte USGS-seismische data' } }
    ],
    copy: {
      citizen: {
        en: 'In steep mountain valleys or island archipelagos hit by monsoon floods and mudslides, roads vanish and valleys stay dark for days. SENDA builds a 3D satellite map of the terrain and guides rescue links over mountains.',
        es: 'En valles de montaña o islas golpeadas por riadas monzónicas y corrimientos de tierra, las carreteras desaparecen durante días. SENDA reconstruye el relieve 3D por satélite y encuentra por dónde saltar la señal por encima de las cumbres.',
        nl: 'In bergvalleien en eilandgebieden die getroffen worden door overstromingen of aardverschuivingen verdwijnen wegen dagenlang. SENDA bouwt een 3D-satellietkaart en plant alternatieve signaalroutes.'
      },
      investor: {
        en: 'Demonstrates global scalability outside Europe using 100% open global Earth Observation datasets (Copernicus DEM GLO-30, Sentinel-2, USGS) paired with satellite NTN bursts.',
        es: 'Demuestra escalabilidad global fuera de Europa sobre datos espaciales abiertos (Copernicus DEM GLO-30, Sentinel-2, USGS) combinados con ráfagas satelitales NTN.',
        nl: 'Toont wereldwijde schaalbaarheid met open aardobservatiedata (Copernicus DEM, Sentinel-2, USGS) en NTN-satellietverbindingen.'
      },
      engineer: {
        en: 'Fuses USGS seismic records, Sentinel-2 NDVI surface-change masks, and Copernicus DEM GLO-30 elevation meshes into an interactive 3D satellite flyover (/senda/vuelo.html) + Deygout ridge diffraction solver.',
        es: 'Fusiona registros USGS, máscaras de cambio NDVI Sentinel-2 y malla Copernicus DEM GLO-30 en un sobrevuelo 3D interactivo (/senda/vuelo.html) con difracción Deygout multi-obstáculo.',
        nl: 'Fuseert USGS-data, Sentinel-2 NDVI en Copernicus DEM GLO-30 in een 3D-satellietvlucht met Deygout-diffractiesolver.'
      }
    },
    visualSvg: '/media/renders/render-senda-4d-globe.svg',
    actionHref: '/senda/vuelo.html',
    actionLabel: { en: 'Launch Langtang 3D Flyover', es: 'Abrir Sobrevuelo 3D Nepal', nl: 'Start Langtang 3D-vlucht' },
    labHref: '#labs',
    labLabel: { en: 'Open Deygout & Satellite Lab', es: 'Abrir Lab Difracción y Satélite', nl: 'Open Diffractie- & Satellietlab' },
    evidenceId: 'EV-NEPAL-3D'
  },
  {
    id: 'venezuela-seismic',
    region: { en: 'Venezuela · Seismic Belts', es: 'Venezuela · Zonas Sísmicas', nl: 'Venezuela · Seismische Zones' },
    inspiration: {
      en: 'Inspired by earthquakes in Venezuela & urban collapse rescue in Latin America & Europe',
      es: 'Inspirado en los terremotos de Venezuela y la prevención sísmica ciudadana',
      nl: 'Geïnspireerd door aardbevingen in Venezuela & stedelijke aardbevingspreventie'
    },
    title: {
      en: 'Earthquake Early Warning & Rubble Rescue',
      es: 'Prevención Sísmica Temprana y Rescate bajo Escombros',
      nl: 'Vroege Aardbevingswaarschuwing & Puinredding'
    },
    stats: [
      { value: 'P-Wave', label: { en: 'Early multi-phone tremor trigger', es: 'Detección temprana de onda P', nl: 'Vroege P-golfdetectie' } },
      { value: 'EMS-98', label: { en: 'Floor-by-floor 3D building twin', es: 'Gemelo 3D planta por planta', nl: '3D gebouw-twin per verdieping' } },
      { value: '64-OFDM', label: { en: 'Through-wall Wi-Fi CSI radar', es: 'Radar Wi-Fi CSI tras muros', nl: 'Wi-Fi CSI radar door muren' } }
    ],
    copy: {
      citizen: {
        en: 'Before the heavy shaking reaches your neighborhood, nearby phones detect the faster P-wave and warn you to take cover. If a building suffers damage, your phone activates rescue relay mode so rescuers know which floor needs help.',
        es: 'Antes de que llegue la sacudida fuerte a tu barrio, los móviles más cercanos al epicentro sienten la onda P y avisan para ponerse a salvo. Si un edificio sufre daños, el móvil activa el puente de rescate indicando tu planta.',
        nl: 'Voordat de zware schok arriveert, detecteren telefoons de snellere P-golf om u te waarschuwen. Bij schade activeert uw toestel de reddingsrelay inclusief verdiepingsindicatie.'
      },
      investor: {
        en: 'Combines citizen P-wave seismic corroboration, automatic pre-authorized relay activation, EMS-98 3D structural triage, and ITU-R P.2040 through-wall RF localization in one unified stack.',
        es: 'Integra detección sísmica ciudadana corroborada, activación automática de modo relé, triaje estructural 3D EMS-98 y localización RF a través de muros ITU-R P.2040.',
        nl: 'Combineert P-golfdetectie, automatische relay-activering, 3D EMS-98 structuurtriage en ITU-R P.2040 lokalisatie door puin.'
      },
      engineer: {
        en: 'Multi-node seismic quorum activates pre-authorized relay state machine; 3D building twin (/senda/edificios.html) links barometric floor estimate, BLE rubble bridge, and 64-subcarrier OFDM CSI.',
        es: 'Quórum sísmico multi-nodo dispara la máquina de estado de relé preautorizado; el gemelo 3D (/senda/edificios.html) enlaza altura barométrica, puente BLE y CSI OFDM de 64 subportadoras.',
        nl: 'Seismisch quorum activeert vooraf geautoriseerde relay; 3D gebouw-twin koppelt barometer, BLE-puinbrug en 64-subcarrier OFDM CSI.'
      }
    },
    visualSvg: '/media/renders/render-paer-mesh-topology.svg',
    actionHref: '/senda/edificios.html',
    actionLabel: { en: 'Open 3D Building Triage', es: 'Abrir Gemelo 3D de Edificios', nl: 'Open 3D Gebouwtriage' },
    labHref: '#labs',
    labLabel: { en: 'Test Through-Wall CSI Radar', es: 'Probar Radar Wi-Fi tras Muros', nl: 'Test Wi-Fi CSI Muurradar' },
    evidenceId: 'EV-02-SWEEP'
  },
  {
    id: 'traffic-v16',
    region: { en: 'Spain DGT · NL A12', es: 'Carreteras DGT · A12 NL', nl: 'Rijksweg A12 · Spanje DGT' },
    inspiration: {
      en: 'Highway multi-vehicle pileups, V16 beacons & zero-coverage rural road crashes',
      es: 'Accidentes de tráfico, balizas V16 y carreteras rurales sin cobertura móvil',
      nl: 'Snelwegongevallen, V16-bakens & verkeerscorridors zonder dekking'
    },
    title: {
      en: 'Traffic Accidents, Doppler V2I & Privacy Vision',
      es: 'Accidentes de Tráfico, Radar Doppler y Visión Vial',
      nl: 'Verkeersongevallen, Doppler V2I & Privacy-Visie'
    },
    stats: [
      { value: '0-RTT', label: { en: 'Passing car V2I radar burst', es: 'Ráfaga V2I en pórtico sin IP', nl: '0-RTT V2I-puls bij portaal' } },
      { value: '24/77 GHz', label: { en: 'Vehicular Doppler wave model', es: 'Modelo Doppler 24/77 GHz', nl: '24/77 GHz Dopplermodel' } },
      { value: 'YOLOX-s', label: { en: 'On-device flow (zero plates)', es: 'Conteo local sin matrículas', nl: 'Lokale telling zonder kentekens' } }
    ],
    copy: {
      citizen: {
        en: 'If a car crashes on a mountain road with no coverage, every vehicle driving past acts as a silent digital courier that carries the alert to the next road gantry or cell tower in under 90 seconds.',
        es: 'Si un coche sufre un accidente en una carretera de montaña sin cobertura, cualquier vehículo que pase cerca recoge la alerta en silencio y la entrega en el siguiente pórtico o antena en menos de 90 segundos.',
        nl: 'Bij een ongeluk op een weg zonder bereik neemt elke passerende auto de melding automatisch en versleuteld mee naar het volgende wegportaal binnen 90 seconden.'
      },
      investor: {
        en: 'Bridges V16 connected beacons, DGT/NDW public road telemetry, 0-RTT roadside gateways, and privacy-first YOLOX-s + ByteTrack edge cameras across European corridors (A12 Arnhem–Ede).',
        es: 'Conecta balizas V16, telemetría vial DGT/NDW, pasarelas 0-RTT en pórticos y cámaras edge YOLOX-s + ByteTrack sin matrículas en corredores europeos (A12 Arnhem–Ede y red DGT).',
        nl: 'Verbindt V16-bakens, NDW/DGT-wegdata, 0-RTT wegkant-gateways en privacyvriendelijke YOLOX-s verkeersvisie op de A12.'
      },
      engineer: {
        en: 'Models K/W-band (24.125 / 77 GHz) S-curve vehicular Doppler compression, 0-RTT 320-byte RSU frames, V16 reflex latency, and YOLOX-s + ByteTrack multi-object counters (VehicularDopplerLab).',
        es: 'Modela curva en S Doppler a 24,125 / 77 GHz, tramas RSU 0-RTT de 320 bytes, latencia refleja V16 y conteo YOLOX-s + ByteTrack en VehicularDopplerLab.',
        nl: 'Modelleert 24/77 GHz Doppler-S-curves, 0-RTT 320-byte RSU-frames, V16-latentie en YOLOX-s + ByteTrack.'
      }
    },
    visualSvg: '/media/renders/render-v16-reflex-latency.svg',
    actionHref: '/senda/consola.html',
    actionLabel: { en: 'Open 16,699-Source Console', es: 'Abrir Consola de 16.699 Fuentes', nl: 'Open 16.699-Bronnenconsole' },
    labHref: '#labs',
    labLabel: { en: 'Test in Vehicular Doppler Lab', es: 'Probar en Lab Doppler y Tráfico', nl: 'Test in Verkeers- & Dopplerlab' },
    evidenceId: 'EV-CONSOLE-16K'
  },
  {
    id: 'wildfire-3d',
    region: { en: 'Mediterranean · Global', es: 'Mediterráneo · Sierra', nl: 'Middellandse Zee · Wereldwijd' },
    inspiration: {
      en: 'Fast-moving mountain wildfires where smoke & terrain blind conventional towers',
      es: 'Grandes incendios forestales donde el humo y la orografía cortan las comunicaciones',
      nl: 'Snelle natuurbranden waar rook en reliëf reguliere masten uitschakelen'
    },
    title: {
      en: '3D Wildfire Wind, Smoke Plume & Fleet Sensing',
      es: 'Incendios Forestales 3D y Meteorología con Flota',
      nl: '3D Natuurbrandfysica & Rookpluimsimulatie'
    },
    stats: [
      { value: '3D Wind', label: { en: 'Mass-consistent DEM airflow', es: 'Viento 3D sobre relieve DEM', nl: 'Massaconsistente 3D-wind' } },
      { value: 'Briggs', label: { en: 'Smoke plume rise physics', es: 'Pluma de humo Briggs', nl: 'Briggs-rookpluimmodel' } },
      { value: 'Sentinel-2', label: { en: 'Real burn scar validation', es: 'Cicatrices reales Sentinel-2', nl: 'Echte Sentinel-2 brandlittekens' } }
    ],
    copy: {
      citizen: {
        en: 'Shows which direction wind and smoke will push a wildfire over real mountains so rural towns and evacuation cars get clear escape routes before roads close.',
        es: 'Muestra hacia dónde empujan el viento y el humo un incendio sobre el relieve real de las montañas para que los pueblos y coches evacuen por rutas seguras antes de quedar cortados.',
        nl: 'Toont hoe wind en rook een natuurbrand over echt terrein sturen zodat dorpen en voertuigen veilige evacuatieroutes krijgen.'
      },
      investor: {
        en: 'SENDA-3D combines open terrain physics, satellite burn-scar verification, and connected vehicle weather telemetry into a real-time browser wildfire engine.',
        es: 'SENDA-3D une física abierta de terreno, verificación satelital Sentinel-2 y sensores meteorológicos de vehículos en un motor web de incendios en tiempo real.',
        nl: 'SENDA-3D combineert open terreinfysica, Sentinel-2-verificatie en voertuigsensoren in één browser-engine.'
      },
      engineer: {
        en: 'Mass-consistent 3D wind solver over Copernicus DEM GLO-30, Briggs buoyant plume rise, Rothermel spread modeling, and formal validation paper (/senda/paper.html + /senda/fuego3d.html).',
        es: 'Solver de viento 3D con conservación de masa sobre Copernicus DEM GLO-30, pluma de Briggs, propagación Rothermel y paper formal (/senda/paper.html + /senda/fuego3d.html).',
        nl: 'Massaconsistente 3D-windsolver op Copernicus DEM, Briggs-pluim, Rothermel-verspreiding en formeel paper.'
      }
    },
    visualSvg: '/media/renders/render-cots-gateway-hardware.svg',
    actionHref: '/senda/fuego3d.html',
    actionLabel: { en: 'Launch SENDA-3D Wildfire', es: 'Abrir Motor Incendios 3D', nl: 'Start SENDA-3D Natuurbrand' },
    labHref: '/senda/paper.html',
    labLabel: { en: 'Read SENDA-3D Paper', es: 'Leer Paper SENDA-3D', nl: 'Lees SENDA-3D Paper' },
    evidenceId: 'EV-FIRE-SMV'
  },
  {
    id: 'nl-water',
    region: { en: 'Netherlands · Rhine / Meuse', es: 'Países Bajos · Rin / Mosa', nl: 'Nederland · Rijn / Maas' },
    inspiration: {
      en: 'Dutch river basins monitored across 25 real Rijkswaterstaat stations',
      es: 'Cuencas fluviales de Países Bajos monitorizadas con 25 estaciones reales Rijkswaterstaat',
      nl: 'Nederlandse rivierbekkens gemonitord via 25 echte Rijkswaterstaat-stations'
    },
    title: {
      en: 'River Flood-Wave Travel Time (Rijkswaterstaat)',
      es: 'Onda de Crecida Fluvial en Países Bajos (RWS)',
      nl: 'Watergolf-reistijd & Getijde-analyse (RWS)'
    },
    stats: [
      { value: '25', label: { en: 'Real Rijkswaterstaat stations', es: 'Estaciones reales RWS', nl: 'Echte RWS-meetstations' } },
      { value: '5 h', label: { en: 'Lobith -> Nijmegen wave travel', es: 'Onda Lobith -> Nimega', nl: 'Lobith -> Nijmegen golf' } },
      { value: 'r = 0.94', label: { en: 'Cross-station wave correlation', es: 'Correlación entre estaciones', nl: 'Kruiscorrelatie watergolf' } }
    ],
    copy: {
      citizen: {
        en: 'Watches live Dutch river water levels along the Rhine and Meuse to see how fast a high-water wave travels downstream, giving municipalities hours of advance clarity.',
        es: 'Vigila el nivel real de los ríos en Países Bajos para calcular cuántas horas tarda una crecida en bajar de una ciudad a otra, dando margen de preparación.',
        nl: 'Volgt live Nederlandse waterstanden langs Rijn en Maas om precies te berekenen hoe snel een hoogwatergolf stroomafwaarts beweegt.'
      },
      investor: {
        en: 'Built specifically for Dutch Water Boards (Waterschappen) and Rijkswaterstaat ecosystems — proving cross-border ES + NL institutional readiness from day one.',
        es: 'Diseñado específicamente para el ecosistema neerlandés (Rijkswaterstaat / Waterschappen), demostrando preparación institucional transfronteriza España + Países Bajos.',
        nl: 'Speciaal gebouwd voor Waterschappen en Rijkswaterstaat — bewijst directe ES + NL inzetbaarheid.'
      },
      engineer: {
        en: 'Ingests 28-day Rijkswaterstaat time series + official forecasts, extracts M2 tidal harmonics, and computes lag cross-correlation (Lobith -> Nijmegen 5 h, r = 0.94) in water-nl.mjs.',
        es: 'Procesa series de 28 días de Rijkswaterstaat y previsión oficial, detecta marea armónica M2 y calcula correlación cruzada con retardo (Lobith -> Nimega 5 h, r = 0,94) en water-nl.mjs.',
        nl: 'Verwerkt 28-daagse RWS-tijdreeksen, detecteert M2-getij en berekent reistijd via kruiscorrelatie in water-nl.mjs.'
      }
    },
    visualSvg: '/media/renders/render-merkle-rfc6962-proof.svg',
    actionHref: '/senda/agua-nl.html',
    actionLabel: { en: 'Open NL Water Monitor', es: 'Abrir Monitor Agua NL', nl: 'Open RWS Watermonitor' },
    labHref: '/nl/platform/',
    labLabel: { en: 'View in NL Control Center', es: 'Ver en Centro de Control NL', nl: 'Bekijk in NL Controlecentrum' },
    evidenceId: 'EV-FLOOD-DANA'
  }
];

export default function CrisisAtlas({
  locale,
  audience
}: {
  locale: Locale;
  audience: AudienceMode;
}) {
  const [selected, setSelected] = useState<CrisisId>('spain-rail');
  const active = CRISES.find((c) => c.id === selected) ?? CRISES[0];

  const icons: Record<CrisisId, typeof TrainFront> = {
    'spain-rail': TrainFront,
    'valencia-dana': Waves,
    'indonesia-nepal': Mountain,
    'venezuela-seismic': Activity,
    'traffic-v16': Car,
    'wildfire-3d': Flame,
    'nl-water': Waves
  };

  const copy = {
    en: {
      eyebrow: 'REAL-WORLD INSPIRATION & MULTI-CRISIS COVERAGE',
      title: 'Born from real tragedies. Engineered so nobody stays unheard.',
      lead: 'Explore every emergency SENDA covers — from Spanish railway accidents and Valencia floods to Indonesia/Nepal landslides, Venezuela earthquakes, highway pileups, wildfires, and Dutch river waves.'
    },
    es: {
      eyebrow: 'INSPIRACIÓN REAL Y COBERTURA MULTICRISIS',
      title: 'Nacido de catástrofes reales. Diseñado para que nadie vuelva a quedar incomunicado.',
      lead: 'Explora cada emergencia que cubre SENDA y de dónde nació cada motor: accidentes ferroviarios en España, riadas de Valencia, Indonesia y Nepal, terremotos de Venezuela, tráfico vial, incendios 3D y agua en Países Bajos.'
    },
    nl: {
      eyebrow: 'ECHTE INSPIRATIE & MULTICRISIS-DEKKING',
      title: 'Geboren uit echte rampen. Gebouwd zodat niemand onbereikbaar blijft.',
      lead: 'Ontdek elke noodsituatie die SENDA afdekt: spoorongevallen in Spanje, overstromingen in Valencia, Indonesië en Nepal, aardbevingen in Venezuela, verkeersongevallen, natuurbranden en Nederlandse watergolven.'
    }
  }[locale];

  const resolveHref = (href: string) => {
    if (href === '#labs') return `${localeHref(locale, 'product')}#labs`;
    return href;
  };

  return (
    <section className="s-section" data-testid="crisis-atlas">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">{copy.eyebrow}</p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        {/* Accessible single-row scrollable tablist per modern-web-guidance (tabs) */}
        <div className="s-tabs-scroller" role="tablist" aria-label={copy.title}>
          {CRISES.map((item) => {
            const Icon = icons[item.id];
            const isSel = item.id === selected;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`crisis-tab-${item.id}`}
                aria-selected={isSel}
                className="s-tab-btn"
                onClick={() => setSelected(item.id)}
                data-testid={`crisis-tab-${item.id}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{item.title[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Crisis Showcase Panel */}
        <div
          role="tabpanel"
          aria-labelledby={`crisis-tab-${active.id}`}
          className="s-crisis-stage"
        >
          <div className="s-crisis-info s-stack">
            <div className="s-between">
              <span className="s-pill s-mono">{active.region[locale]}</span>
              <EvidenceBadge locale={locale} evidenceId={active.evidenceId} compact />
            </div>
            <p className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600, margin: 0 }}>
              {active.inspiration[locale]}
            </p>
            <h3 className="s-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.2rem)' }}>
              {active.title[locale]}
            </h3>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: 'var(--s-text-2)' }}>
              {active.copy[audience][locale]}
            </p>

            <div className="s-crisis-kpis">
              {active.stats.map((st) => (
                <div key={st.value} className="s-crisis-kpi">
                  <strong className="s-num">{st.value}</strong>
                  <span className="s-micro s-faint">{st.label[locale]}</span>
                </div>
              ))}
            </div>

            <div className="s-row" style={{ marginTop: 8 }}>
              <a href={active.actionHref} className="s-btn s-btn-primary">
                <span>{active.actionLabel[locale]}</span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a href={resolveHref(active.labHref)} className="s-btn s-btn-secondary">
                <span>{active.labLabel[locale]}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="s-crisis-visual">
            {active.visualSvg && (
              <div className="s-crisis-render-frame">
                <img
                  src={active.visualSvg}
                  alt={active.title[locale]}
                  loading="lazy"
                  width={680}
                  height={420}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
