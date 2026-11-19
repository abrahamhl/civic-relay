import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUTY_CYCLE_STATES,
  AdaptiveDutyCycleManager,
  ZeroAllocationCircularBuffer,
  decimalDegreesToNmea,
  computeNmeaChecksum,
  Nmea0183Multiplexer,
  estimateSmartphoneBatteryBudget,
  buildUniversalNavLinks,
  generateHazardGpxOverlay,
  generateWazeCifsFeed,
  NavigationMultisoftwareHub,
} from '../src/index.mjs';
import { HAZARD } from '../src/road-guard.mjs';

test('AdaptiveDutyCycleManager: conmutación inteligente de ahorro de energía y ráfagas de emergencia', () => {
  const manager = new AdaptiveDutyCycleManager();

  // 1. Vehículo parado prolongadamente (>30 s) -> PARKED (0.05 Hz, reposo 99.8%)
  for (let i = 0; i < 35; i++) {
    manager.updateKinematics(0.0, { dtSec: 1.0 });
  }
  const parked = manager.getCurrentProfile();
  assert.equal(parked.state, DUTY_CYCLE_STATES.PARKED);
  assert.equal(parked.samplingIntervalMs, 20000);
  assert.equal(parked.hz, 0.05);
  assert.equal(parked.sleepDutyPct, 99.8);

  // 2. Tráfico urbano a 30 km/h -> CITY_CONGESTED (1.0 Hz, reposo 92%)
  const city = manager.updateKinematics(30.0, { dtSec: 0.1 });
  assert.equal(city.state, DUTY_CYCLE_STATES.CITY_CONGESTED);
  assert.equal(city.samplingIntervalMs, 1000);
  assert.equal(city.hz, 1.0);

  // 3. Autovía a 120 km/h -> HIGHWAY_CRUISE (10 Hz, muestreo continuo)
  const highway = manager.updateKinematics(120.0, { dtSec: 0.1 });
  assert.equal(highway.state, DUTY_CYCLE_STATES.HIGHWAY_CRUISE);
  assert.equal(highway.samplingIntervalMs, 100);
  assert.equal(highway.hz, 10.0);

  // 4. Disparo de emergencia (frenazo brusco / choque) -> EMERGENCY_BURST (50 Hz por 5 s)
  const burst = manager.updateKinematics(50.0, { isEmergency: true });
  assert.equal(burst.state, DUTY_CYCLE_STATES.EMERGENCY_BURST);
  assert.equal(burst.samplingIntervalMs, 20);
  assert.equal(burst.hz, 50.0);

  // Tras pasar 5 segundos, debe retornar a crucero
  for (let i = 0; i < 55; i++) {
    manager.updateKinematics(100.0, { dtSec: 0.1 });
  }
  assert.equal(manager.getCurrentProfile().state, DUTY_CYCLE_STATES.HIGHWAY_CRUISE);
});

test('ZeroAllocationCircularBuffer: memoria plana Float64Array sin recolección de basura (0 GC pauses)', () => {
  const capacity = 50;
  const channels = 3; // [t, speed, ax]
  const ring = new ZeroAllocationCircularBuffer(capacity, channels);

  // Inserción de 80 muestras (supera capacidad para verificar enrollamiento circular)
  for (let i = 0; i < 80; i++) {
    ring.pushSample(i * 0.1, 50.0 + (i % 10), -1.5);
  }

  assert.equal(ring.count, capacity);

  // Extracción en memoria preasignada sin crear nuevos objetos en el heap
  const reusableTarget = new Float64Array(10 * channels);
  const copied = ring.extractRecentInPlace(reusableTarget, 10);
  assert.equal(copied, 10);

  // El último punto introducido fue i = 79: speed = 50 + (79 % 10) = 59.0
  const lastSpeed = reusableTarget[9 * channels + 1];
  assert.equal(lastSpeed, 59.0);

  // Estadísticas in-place del canal 2 (ax = -1.5 constante)
  const statsAx = ring.computeChannelStatsInPlace(2);
  assert.equal(statsAx.mean, -1.5);
  assert.equal(statsAx.variance, 0.0);
  assert.equal(statsAx.min, -1.5);
  assert.equal(statsAx.max, -1.5);
});

test('Nmea0183Multiplexer: sentencias $GPGGA, $GPRMC y $GPVTG con checksum XOR oficial', () => {
  // Conversión de grados a formato NMEA: Madrid Puerta del Sol (40.4168° N, -3.7038° W)
  // 40° + (0.4168 * 60) = 40° 25.008' -> "4025.00800", N
  // 3° + (0.7038 * 60) = 3° 42.228' -> "00342.22800", W
  const latNmea = decimalDegreesToNmea(40.4168, true);
  assert.equal(latNmea.coordStr, '4025.00800');
  assert.equal(latNmea.hemisphere, 'N');

  const lonNmea = decimalDegreesToNmea(-3.7038, false);
  assert.equal(lonNmea.coordStr, '00342.22800');
  assert.equal(lonNmea.hemisphere, 'W');

  // Checksum XOR
  const sampleSentence = 'GPGGA,123519,4025.00800,N,00342.22800,W,1,08,0.9,580.0,M,48.0,M,,';
  const cs = computeNmeaChecksum(sampleSentence);
  assert.equal(cs.length, 2);
  assert.match(cs, /^[0-9A-F]{2}$/);

  // Sentencias completas
  const fix = {
    lat: 40.4168,
    lon: -3.7038,
    altitudeM: 610.5,
    speedKmh: 92.6, // 92.6 km/h / 1.852 = 50.0 nudos
    headingDeg: 180.0,
    timestampUtc: new Date('2026-11-09T14:00:00.000Z'),
  };

  const gga = Nmea0183Multiplexer.formatGpGga(fix);
  assert.ok(gga.startsWith('$GPGGA,140000.00,4025.00800,N,00342.22800,W,1,12,0.8,610.5,M,48.0,M,,*'));
  assert.ok(gga.endsWith('\r\n'));

  const rmc = Nmea0183Multiplexer.formatGpRmc(fix);
  assert.ok(rmc.startsWith('$GPRMC,140000.00,A,4025.00800,N,00342.22800,W,50.0,180.0,091126,,,A*'));
  assert.ok(rmc.endsWith('\r\n'));

  const vtg = Nmea0183Multiplexer.formatGpVtg(fix);
  assert.ok(vtg.startsWith('$GPVTG,180.0,T,,M,50.0,N,92.6,K,A*'));
  assert.ok(vtg.endsWith('\r\n'));

  const burst = Nmea0183Multiplexer.generateFullGnssBurst(fix);
  assert.ok(burst.combinedString.includes('$GPGGA'));
  assert.ok(burst.combinedString.includes('$GPRMC'));
  assert.ok(burst.combinedString.includes('$GPVTG'));
});

test('estimateSmartphoneBatteryBudget: consumo inferior a 0.35 % por hora en segundo plano', () => {
  // Teléfono en autovía a 120 km/h en segundo plano (pantalla apagada, BLE al 10%, GNSS activo)
  const budgetHighway = estimateSmartphoneBatteryBudget({
    state: DUTY_CYCLE_STATES.HIGHWAY_CRUISE,
    isScreenOn: false,
    bleScanningDutyPct: 10,
    gnssActive: true,
    batteryCapacityMah: 4000,
  });

  // El consumo computacional añadido por SENDA debe ser inferior a 3 mA
  assert.ok(budgetHighway.breakdownMa.cpuExecution < 3.0);
  assert.ok(budgetHighway.breakdownMa.bluetoothLe < 1.0);
  assert.equal(budgetHighway.isSubZeroImpact, true, 'SENDA debe tener impacto sub-cero < 0.35 %/h');
  assert.ok(budgetHighway.hourlyDrainPct < 1.0, 'Drenaje total del teléfono con GNSS activo debe ser < 1.0 %/h');
  assert.ok(budgetHighway.batteryLifeHours > 100);

  // Teléfono estacionado (PARKED): consumo prácticamente nulo
  const budgetParked = estimateSmartphoneBatteryBudget({
    state: DUTY_CYCLE_STATES.PARKED,
    isScreenOn: false,
    bleScanningDutyPct: 5,
    gnssActive: false,
  });
  assert.ok(budgetParked.breakdownMa.cpuExecution < 0.2);
  assert.equal(budgetParked.isSubZeroImpact, true);
});

test('buildUniversalNavLinks: soporte nativo para Google Maps, Waze, Apple Maps, OsmAnd, Sygic y HERE', () => {
  const links = buildUniversalNavLinks({
    lat: 40.2315,
    lon: -3.3512,
    label: 'Accidente A-3 PK 42',
    hazardType: HAZARD.CRASH,
    speedKmh: 120,
  });

  // Google Maps
  assert.equal(links.googleMaps.androidNavigationIntent, 'google.navigation:q=40.231500,-3.351200&mode=d');
  assert.ok(links.googleMaps.webUniversal.includes('destination=40.231500,-3.351200'));
  assert.ok(links.googleMaps.geoUri.startsWith('geo:40.231500,-3.351200?q='));

  // Waze
  assert.equal(links.waze.nativeDeepLink, 'waze://?ll=40.231500,-3.351200&navigate=yes');
  assert.ok(links.waze.webUniversal.includes('https://waze.com/ul?ll=40.231500,-3.351200'));
  assert.ok(links.waze.reportHazardUri.includes('category=accident'));

  // Apple Maps
  assert.equal(links.appleMaps.nativeScheme, 'maps://?daddr=40.231500,-3.351200&dirflg=d&t=m');
  assert.equal(links.appleMaps.carPlayCompatibleUri, 'maps://?daddr=40.231500,-3.351200&dirflg=d');

  // OsmAnd / Organic Maps (RFC 5870)
  assert.ok(links.osmAndOrganic.rfc5870GeoUri.startsWith('geo:40.231500,-3.351200;u=10'));
  assert.equal(links.osmAndOrganic.osmandApiUri, 'osmand.api://navigate?lat=40.231500&lon=-3.351200&profile=car');
  assert.ok(links.osmAndOrganic.organicMapsUri.startsWith('om://map?v=1&ll=40.231500,-3.351200'));

  // Sygic, HERE, TomTom
  assert.equal(links.sygic.nativeDriveUri, 'com.sygic.aura://coordinate|-3.351200|40.231500|drive');
  assert.equal(links.hereWeGo.nativeRouteUri, 'here-route://40.231500,-3.351200');
  assert.equal(links.tomTomAmiGo.nativeAmiGoUri, 'amigo://navigate?lat=40.231500&lon=-3.351200');

  // Recomendación según plataforma
  assert.equal(links.recommendedForPlatform('ANDROID'), links.googleMaps.androidNavigationIntent);
  assert.equal(links.recommendedForPlatform('IOS'), links.appleMaps.nativeScheme);
  assert.equal(links.recommendedForPlatform('CARPLAY'), links.appleMaps.nativeScheme);
  assert.equal(links.recommendedForPlatform('WEB'), links.googleMaps.webUniversal);
});

test('generateHazardGpxOverlay: generación de XML GPX 1.1 para terminales GPS y navegadores offline', () => {
  const hazards = [
    {
      id: 'HAZ-01',
      lat: 40.2315,
      lon: -3.3512,
      title: 'Colisión por alcance A-3',
      description: 'Retención de 2 km en sentido Valencia',
      hazardType: HAZARD.CRASH,
      severity: 'CRITICAL',
    },
    {
      id: 'HAZ-02',
      lat: 39.3621,
      lon: -0.4115,
      title: 'Balsa de agua V-31',
      description: 'Peligro de aquaplaning en carril derecho',
      hazardType: HAZARD.OBSTACLE,
      severity: 'HIGH',
    },
  ];

  const gpx = generateHazardGpxOverlay(hazards, 'Avisos Viales SENDA DGT 3.0');
  assert.ok(gpx.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(gpx.includes('<gpx version="1.1"'));
  assert.ok(gpx.includes('<name>Avisos Viales SENDA DGT 3.0</name>'));
  assert.ok(gpx.includes('<wpt lat="40.231500" lon="-3.351200">'));
  assert.ok(gpx.includes('<name>Colisión por alcance A-3</name>'));
  assert.ok(gpx.includes('<sym>Accident</sym>'));
  assert.ok(gpx.includes('<wpt lat="39.362100" lon="-0.411500">'));
  assert.ok(gpx.includes('<sym>Danger</sym>'));
  assert.ok(gpx.endsWith('</gpx>'));
});

test('generateWazeCifsFeed: feed institucional GeoJSON para Waze for Cities', () => {
  const hazards = [
    {
      id: 'INC-4210',
      lat: 40.2315,
      lon: -3.3512,
      hazardType: HAZARD.CRASH,
      roadId: 'A-3',
      description: 'Accidente múltiple en PK 42.5',
    },
    {
      id: 'INC-8812',
      lat: 39.4312,
      lon: -0.4680,
      hazardType: HAZARD.QUEUE,
      roadId: 'A-7',
      description: 'Atasco por retención repentina',
    },
  ];

  const cifs = generateWazeCifsFeed(hazards);
  assert.equal(cifs.metadata.version, 'CIFS-v2.3');
  assert.equal(cifs.incidents.length, 2);

  const acc = cifs.incidents[0];
  assert.equal(acc.type, 'ACCIDENT');
  assert.equal(acc.street, 'A-3');
  assert.equal(acc.location.y, 40.2315);
  assert.equal(acc.location.x, -3.3512);

  const jam = cifs.incidents[1];
  assert.equal(jam.type, 'JAM');
  assert.equal(jam.street, 'A-7');
});

test('NavigationMultisoftwareHub: orquestación de destinos y exportación multiformato', () => {
  const hub = new NavigationMultisoftwareHub({ platform: 'ANDROID', preferredApp: 'WAZE' });
  hub.registerHazard({
    id: 'HAZ-TEST-1',
    lat: 40.4168,
    lon: -3.7038,
    title: 'Prueba Centro Madrid',
    hazardType: HAZARD.WORKS,
  });

  // Lanzamiento según preferencia Waze
  const launchWaze = hub.getLaunchUriForDestination({ lat: 40.4168, lon: -3.7038 });
  assert.equal(launchWaze, 'waze://?ll=40.416800,-3.703800&navigate=yes');

  // Exportación GPX y CIFS
  const gpx = hub.exportGpxOverlay();
  assert.ok(gpx.includes('Prueba Centro Madrid'));

  const cifs = hub.exportWazeCifsFeed();
  assert.equal(cifs.incidents.length, 1);
  assert.equal(cifs.incidents[0].type, 'CONSTRUCTION');

  // Limpieza
  hub.clearHazard('HAZ-TEST-1');
  assert.equal(hub.exportWazeCifsFeed().incidents.length, 0);
});
