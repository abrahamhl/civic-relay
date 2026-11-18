/** SENDA RoadSafe / Road lab visualizer. Synthetic scenario, no public broadcast or real radio. */
import { fuseRoadReports, buildElectronicHorizon, planRoadAlertDistribution } from './core/roadsafe-road-alert-network.mjs';
import { createDriverAlertArbiter } from './core/roadsafe-alert-arbiter.mjs';
import { evaluateOppositeRelay } from './core/roadsafe-opposite-relay.mjs';
import { projectQueueTailEnvelope } from './core/roadsafe-queue-reachability.mjs';
import { evaluateCoverageBounds } from './core/roadsafe-coverage-bounds.mjs';

const el = (id) => document.getElementById(id);
const tr = (es, en, nl) => document.documentElement.lang === 'en' ? en : document.documentElement.lang === 'nl' ? nl : es;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderRoadLab() {
  if (!el('r-run')) return;
  el('r-title').textContent = tr('Horizonte electrónico: lo que tienes delante','Electronic horizon: what lies ahead','Elektronische horizon: wat ligt er voor je');
  el('r-disclaimer').textContent = tr('EJERCICIO SINTÉTICO: no hay datos reales, alertas enviadas, navegador activo ni asistencia conectada.', 'SYNTHETIC EXERCISE: no live data, alerts sent, active navigation or connected assistance.', 'SYNTHETISCHE OEFENING: geen live data, verzonden meldingen, actieve navigatie of gekoppelde hulpdiensten.');
  el('r-speed-label').textContent = tr('Velocidad del vehículo (km/h)','Vehicle speed (km/h)','Snelheid (km/u)');
  el('r-adopt-label').textContent = tr('Adopción BLE hipotética (%)','Hypothetical BLE adoption (%)','Hypothetische BLE-deelname (%)');
  el('r-run').textContent = tr('Recalcular ejercicio','Recalculate exercise','Oefening herberekenen');
  const speed = Number(el('r-speed').value), adoption = Number(el('r-adopt').value);
  if (!Number.isFinite(speed) || speed < 0 || speed > 130 || !Number.isFinite(adoption) || adoption < 0 || adoption > 100) {
    el('r-horizon').textContent=tr('Datos fuera de rango.','Input out of range.','Gegevens buiten bereik.');
    el('r-channels').textContent=''; el('r-relay').textContent=''; return;
  }
  const nowMs = Date.now(), observedAtMs = nowMs-2000, expiresAtMs = nowMs+300000;
  const road = {roadId:'LAB-A12',carriagewayId:'LAB-A12-E',direction:'INCREASING',chainageM:123000,uncertaintyM:25,mapMatched:true};
  const make = (incidentKey,hazardType,chainageM,severity) => ({reportId:incidentKey,incidentKey,hazardType,severity,observedAtMs,expiresAtMs,road:{...road,chainageM},provenance:{rootId:'lab-'+incidentKey,publisherId:'SYNTHETIC_LAB',independenceFamily:'LAB',verification:'UNVERIFIED'}});
  const input=[make('cola-demo','TAIL_OF_QUEUE',122400,'HIGH'),make('accidente-demo','COLLISION',123000,'CRITICAL'),make('detras-demo','BROKEN_DOWN_VEHICLE',121300,'MODERATE')];
  const fused=fuseRoadReports(input,{nowMs});
  const ahead=buildElectronicHorizon({driver:{roadId:'LAB-A12',carriagewayId:'LAB-A12-E',direction:'INCREASING',chainageM:121500,uncertaintyM:10,speedMps:speed/3.6,mapMatched:true},scenes:fused.scenes,nowMs});
  const candidates=ahead.horizon.map(h=>h.arbiterCandidate).filter(Boolean);
  const attention=createDriverAlertArbiter().consider(candidates,{now:nowMs/1000,voiceOptIn:false,deploymentApproved:false});
  const names={TAIL_OF_QUEUE:tr('Final de cola','Tail of queue','File-einde'),COLLISION:tr('Accidente','Collision','Ongeval'),BROKEN_DOWN_VEHICLE:tr('Avería','Breakdown','Pech')};
  const rows=ahead.horizon.map(h=>'<tr><td>'+esc(names[h.hazardType]??h.hazardType)+'</td><td>'+Math.round(h.nominalDistanceM)+' m</td><td>'+(h.etaRangeS?Math.round(h.etaRangeS[0])+'–'+Math.round(h.etaRangeS[1])+' s':'—')+'</td><td>'+esc(h.evidence)+'</td></tr>').join('');
  el('r-horizon').innerHTML='<div class="tw"><table><thead><tr><th>'+esc(tr('Peligro','Hazard','Gevaar'))+'</th><th>'+esc(tr('Distancia estimada','Estimated distance','Geschatte afstand'))+'</th><th>ETA</th><th>'+esc(tr('Evidencia','Evidence','Bewijs'))+'</th></tr></thead><tbody>'+rows+'</tbody></table></div><p class="m">'+esc(tr('Detrás o descartados','Behind or rejected','Achter of afgewezen'))+': '+ahead.rejected.length+' · '+esc(tr('Avisos por voz emitidos','Voice alerts emitted','Uitgezonden spraakmeldingen'))+': '+(attention.voice?1:0)+'</p>';
  const scene=fused.scenes.find(x=>x.incidentKey==='accidente-demo');
  const plan=planRoadAlertDistribution(scene,{nowMs,requestedChannels:['SCREEN','VOICE','SMS','BLE_PEER','DTN_RELAY','DGT30','WAZE_CIFS','TAXI_PARTNER','INSURER_PARTNER'],linkStates:{SCREEN:'MEASURED_UP'}});
  el('r-channels').innerHTML='<h3>'+esc(tr('Cobertura real y permisos','Real coverage and permissions','Echte dekking en toestemming'))+'</h3><p>'+esc(tr('Visualización local posible; sin credenciales, consentimiento ni mediciones de enlace para publicar o retransmitir.', 'Local display available; no credentials, consent or link measurements to publish or relay.', 'Lokale weergave mogelijk; geen gegevens, toestemming of linkmetingen voor publicatie of relais.'))+'</p><p>'+esc(tr('Canales bloqueados','Blocked channels','Geblokkeerde kanalen'))+': <strong>'+plan.blocked.length+'</strong></p><ul class="tl">'+plan.blocked.map(x=>'<li>'+esc(x.channel)+' · '+esc(x.reason)+'</li>').join('')+'</ul>';
  // Assumptions are intentionally hard-coded as an educational sensitivity model, NOT sourced field metrics.
  const hypothesis=evaluateOppositeRelay({distanceToHazardM:2500,approachingSpeedMps:25,oppositeSpeedMps:25,oppositeFlowVehPerHour:1200,relayParticipation:adoption/100,sourceReceiveP:0.7,targetReceiveP:0.7,roadSeparationM:18,effectiveRadioRangeM:30,minLeadTimeS:5,eventTtlS:300,analysisHorizonS:300,sourceHasRelay:true,targetHasRelay:true,crossCarriagewayReachable:true});
  el('r-relay').innerHTML='<h3>'+esc(tr('Reenvío BLE contrario','Opposite-direction BLE relay','BLE-relais via tegenliggers'))+'</h3><p>'+esc(tr('Probabilidad condicional del modelo','Conditional model probability','Voorwaardelijke modelkans'))+': <strong>'+(hypothesis.probability===null?'—':(hypothesis.probability*100).toFixed(1)+' %')+'</strong></p><p class="m">'+esc(tr('HIPÓTESIS, NO COBERTURA MEDIDA: llegadas Poisson, 1200 veh/h, velocidades de 90 km/h, alcance eficaz supuesto 30 m y recepción supuesta del 70%. No hay ensayo BLE físico ni acuse de entrega.', 'HYPOTHESIS, NOT MEASURED COVERAGE: Poisson arrivals, 1200 vehicles/h, 90 km/h, assumed 30 m range and 70% reception. No physical BLE trial or destination acknowledgment.', 'HYPOTHESE, GEEN GEMETEN DEKKING: Poisson-aankomsten, 1200 voertuigen/u, 90 km/u, verondersteld 30 m bereik en 70% ontvangst. Geen fysieke BLE-proef of ontvangstbevestiging.'))+'</p>';
  // Mathematical feasibility demo: two synthetic tail positions ten seconds apart.
  // No field data, consent, actor integration, or route authorization is inferred.
  const tailRef = {roadId:'LAB-A12',carriagewayId:'LAB-A12-E',direction:'INCREASING',
    incidentKey:'cola-demo',mapMatched:true};
  const envelope=projectQueueTailEnvelope({
    observations:[{...tailRef,atMs:nowMs-12000,chainageM:122480,uncertaintyM:5},
      {...tailRef,atMs:nowMs-2000,chainageM:122440,uncertaintyM:5}],
    driver:{...tailRef,chainageM:121500,uncertaintyM:10},nowMs,
    constraints:{driverSpeedRangeMps:[Math.max(0,speed/3.6-2),speed/3.6+2],
      latencyRangeS:[1,4],reactionRangeS:[1,3],decelerationRangeMs2:[2,5],
      clearanceMarginM:20,maxExtrapolationS:30,maxObservationGapS:30}
  });
  const coverage=evaluateCoverageBounds({
    channelEvidence:[{channelId:'LAB-BLE',failureDomain:'PHONE_RADIO',
      measurementStratum:'SIMULATED_ANDROID_FOREGROUND',receiverAckType:'DESTINATION_ACK',
      authorizationGranted:true,consentGranted:true,measurementOrigin:'SYNTHETIC',
      trials:100,deadlineSuccesses:80,testedDeadlineS:10,measuredLatencyP95S:5,
      observedAtMs:nowMs-1000,validUntilMs:nowMs+100000}],
    deadlineS:15,nowMs
  });
  const label=tr('Modelo experimental de final de cola móvil','Moving queue-tail research model',
    'Onderzoeksmodel bewegend file-einde');
  const margin=typeof envelope.robustTimingMarginM==='number'?envelope.robustTimingMarginM.toFixed(0)+' m':'—';
  const wave=Array.isArray(envelope.waveVelocityRangeMps)?envelope.waveVelocityRangeMps.join(' … ')+' m/s':'—';
  const distance=Array.isArray(envelope.distanceRangeM)?envelope.distanceRangeM.join(' … ')+' m':'—';
  el('r-horizon').innerHTML += '<div class="card" style="margin-top:12px"><h3>'+esc(label)+'</h3>'+
    '<p>'+esc(tr('Velocidad de la onda de cola','Queue shock speed','Fileschokgolfsnelheid'))+': <strong>'+esc(wave)+'</strong> · '+
    esc(tr('Distancia acotada','Bounded distance','Afstand met bandbreedte'))+': <strong>'+esc(distance)+'</strong></p>'+
    '<p>'+esc(tr('Margen temporal convertido a distancia','Conservative timing clearance margin','Conservatieve vrije marge'))+': <strong>'+esc(margin)+'</strong></p>'+
    '<p class="m">'+esc('H-ROAD-RRE-1 · '+(envelope.verdict??envelope.reason??'ABSTAIN'))+'</p>'+
    '<p class="m">'+esc(tr('Parámetros inventados únicamente para el ensayo. No son valores de normativa ni consejos de frenado.',
    'Parameters invented for the simulation only. Not legal stopping distances or braking instructions.',
    'Parameters alleen voor de simulatie, geen wettelijke remweg of rijadvies.'))+'</p>'+
    '<p class="m">'+esc(tr('Cobertura BLE no validada físicamente:', 'BLE coverage not field validated:',
    'BLE-dekking niet fysiek gevalideerd:'))+' <strong>'+esc(coverage.status)+'</strong></p></div>';

}

if (el('r-run')) {
  el('r-run').addEventListener('click',renderRoadLab);
  document.querySelectorAll('.lg').forEach(b=>b.addEventListener('click',()=>queueMicrotask(renderRoadLab)));
  renderRoadLab();
}