'use client';

import { useState } from 'react';

type Scenario = 'outage' | 'intermittent' | 'restored';

const scenarios: {id:Scenario;name:string;subtitle:string}[] = [
  {id:'outage',name:'BLACKOUT',subtitle:'No route available'},
  {id:'intermittent',name:'DEGRADED',subtitle:'Intermittent route'},
  {id:'restored',name:'RECOVERY',subtitle:'Synthetic path restored'}
];

export default function MissionControl() {
  const [scenario,setScenario]=useState<Scenario>('outage');
  const [packets,setPackets]=useState(0);
  const hasRoute=scenario!=='outage';
  const result=packets===0?'NO PACKETS IN MODEL':!hasRoute?'LOCALLY QUEUED (MODEL)':'SIMULATED ACK · LOCAL ONLY';
  return (
    <div className="mission-console" aria-label="Interactive conceptual crisis communication simulator">
      <div className="console-top">
        <span className="console-heading"><i className="indicator"/> MISSION CONTROL <b>/</b> ROUTING MODEL</span>
        <span className="console-tag">ILLUSTRATIVE · NOT LIVE</span>
      </div>
      <div className="globe-stage">
        <div className="vertical-ruler" aria-hidden="true">90° N <span>45° N</span><span>00°</span><span>45° S</span> 90° S</div>
        <svg className="planet-art" viewBox="0 0 730 600" role="img" aria-label="Stylized Earth with illustrative mesh links, satellites, and a hypothetical emergency location">
          <defs>
            <radialGradient id="globeGradient" cx="27%" cy="29%" r="76%">
              <stop offset="0" stopColor="#1b3f59"/>
              <stop offset=".38" stopColor="#0c2537"/>
              <stop offset=".75" stopColor="#06131e"/>
              <stop offset="1" stopColor="#02060c"/>
            </radialGradient>
            <radialGradient id="glowGradient">
              <stop offset=".52" stopColor="#277b9c" stopOpacity=".16"/>
              <stop offset="1" stopColor="#277b9c" stopOpacity="0"/>
            </radialGradient>
            <clipPath id="earthClip"><circle cx="362" cy="294" r="203"/></clipPath>
            <filter id="pinGlow"><feGaussianBlur stdDeviation="7"/></filter>
          </defs>
          <circle cx="362" cy="294" r="275" fill="url(#glowGradient)"/>
          <g className="orbit orbital-one"><ellipse cx="362" cy="294" rx="314" ry="105" transform="rotate(-31 362 294)"/></g>
          <g className="orbit orbital-two"><ellipse cx="362" cy="294" rx="292" ry="146" transform="rotate(28 362 294)"/></g>
          <g className="orbit orbital-three"><ellipse cx="362" cy="294" rx="244" ry="248" transform="rotate(-67 362 294)"/></g>
          <circle cx="362" cy="294" r="204" fill="url(#globeGradient)" stroke="#5aafc4" strokeOpacity=".4" strokeWidth="1.5"/>
          <g clipPath="url(#earthClip)" className="earth-grid">
            <ellipse cx="362" cy="294" rx="198" ry="66"/>
            <ellipse cx="362" cy="294" rx="198" ry="137"/>
            <ellipse cx="362" cy="294" rx="198" ry="190"/>
            <ellipse cx="362" cy="294" rx="80" ry="204"/>
            <ellipse cx="362" cy="294" rx="153" ry="204"/>
            <line x1="156" y1="294" x2="568" y2="294"/>
            <line x1="362" y1="85" x2="362" y2="500"/>
            <path className="land" d="M205 163l43-19 23 14 35-4 21 24-13 27-30 6-13 23-24-2-18 25-35-21-21-36zm127 93l31 15 16 37-14 43 6 32-15 35-18 17-12-31 10-35-19-34 2-31zm98-133l30-11 32 17 29 37-6 33-27 17-19 33-29 0-11-37-31-16 7-28zM446 331l41 13 12 34-29 19-25-20z"/>
            <path className="connection-path" d="M220 217 Q337 90 464 207 M220 217 Q347 320 450 339 M450 339 Q536 247 464 207"/>
            <g className="grid-nodes"><circle cx="220" cy="217" r="4"/><circle cx="464" cy="207" r="4"/><circle cx="450" cy="339" r="4"/></g>
          </g>
          <circle cx="362" cy="294" r="204" fill="none" stroke="#8dd5df" strokeOpacity=".16" strokeWidth="10"/>
          <path className={'data-path ' + (hasRoute?'path-on':'path-off')} d="M252 394 Q338 233 458 230 Q520 185 577 104" fill="none" strokeWidth="2" strokeDasharray="7 8"/>
          <circle className="incident-halo" cx="252" cy="394" r="22" filter="url(#pinGlow)" fill="#f17c59"/>
          <circle className="incident-pulse" cx="252" cy="394" r="15" fill="none" stroke="#f17c59" strokeWidth="1.5"/>
          <circle cx="252" cy="394" r="5" fill="#f8a687"/>
          <g className="sat-icon" transform="translate(574 101) rotate(-25)"><rect x="-8" y="-9" width="16" height="18" rx="2" fill="#cde7ed"/><rect x="-34" y="-12" width="23" height="24" fill="#2b627b" stroke="#a1ddeb" strokeWidth="1"/><rect x="11" y="-12" width="23" height="24" fill="#2b627b" stroke="#a1ddeb" strokeWidth="1"/><path d="M-5-16v7M5 9v8" stroke="#a1ddeb" strokeWidth="2"/></g>
          <g className="sat-icon slow" transform="translate(119 160) rotate(16)"><rect x="-5" y="-6" width="10" height="12" rx="2" fill="#d2e8ed"/><rect x="-25" y="-9" width="17" height="18" fill="#1e536d" stroke="#80baca"/><rect x="8" y="-9" width="17" height="18" fill="#1e536d" stroke="#80baca"/></g>
          <g className="svg-coordinates"><text x="253" y="424">NODE / 001</text><text x="585" y="97">LEO / CONCEPT</text><text x="361" y="520" textAnchor="middle">EARTH REFERENCE / SYNTHETIC TOPOLOGY</text></g>
        </svg>
        <div className="globe-floating left-floating"><span>THREAT MODEL</span><strong>LOSS OF CONNECTIVITY</strong><small>Scenario: simulated</small></div>
        <div className="globe-floating right-floating"><span>ROUTE AVAILABILITY</span><strong className={hasRoute?'online':'offline'}>{hasRoute?'PATH AVAILABLE':'NO ROUTE'}</strong><small>No device or satellite connection</small></div>
        <div className="stage-coordinate">51.9808° N&nbsp; / &nbsp;5.9114° E <span>REFERENCE COORDINATES</span></div>
      </div>
      <div className="console-bottom">
        <div className="console-section-title"><span>01 / NETWORK CONDITIONS</span><span>SELECT SCENARIO ↓</span></div>
        <div className="scenario-switch" role="group" aria-label="Select a fictional network scenario">
          {scenarios.map(item=><button key={item.id} type="button" aria-pressed={scenario===item.id} className={scenario===item.id?'scenario-active':''} onClick={()=>setScenario(item.id)}><span className="scenario-name">{item.name}</span><small>{item.subtitle}</small></button>)}
        </div>
        <div className="console-footer">
          <div className="telemetry"><span>02 / PACKET STATE</span><strong aria-live="polite">{result}</strong></div>
          <button type="button" className="inject-packet" onClick={()=>setPackets(n=>n+1)}>+ INJECT TEST PACKET <span>↗</span></button>
        </div>
        <p className="console-disclaimer">Visualization models a scenario only. Use the separate engine demo to inspect real browser-local queue and ACK behavior.</p>
      </div>
    </div>
  );
}
