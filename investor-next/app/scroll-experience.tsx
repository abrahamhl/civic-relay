'use client';

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

const phases = [
  { number:'01',tag:'SYSTEM FAILURE',title:'THE BLACKOUT.',subtitle:'The network disappears.',detail:'Infrastructure can fail without warning. We begin with every modeled route unavailable.',status:'NETWORK ISOLATED',metric:'0',unit:'MODEL PATHS',tone:'failure' },
  { number:'02',tag:'LOCAL RESILIENCE',title:'THE MESSAGE SURVIVES.',subtitle:'Store first. Send when possible.',detail:'A fictional SOS is placed in the browser-local queue. The message can wait for a future route.',status:'LOCAL QUEUE',metric:'1',unit:'QUEUED / ILLUSTRATIVE',tone:'queued' },
  { number:'03',tag:'NETWORK DISCOVERY',title:'A PATH EMERGES.',subtitle:'Peers create possibilities.',detail:'A conceptual mesh shows nearby relays reconnecting. Real device-to-device transport remains a research milestone.',status:'MESH CONCEPT',metric:'3',unit:'NODES / ILLUSTRATIVE',tone:'mesh' },
  { number:'04',tag:'RESILIENT DELIVERY',title:'ROUTE. RETRY. ACK.',subtitle:'Delivery needs evidence.',detail:'Synthetic multipath routes illuminate as simulated acknowledgements return. No external delivery is claimed.',status:'ACK MODEL',metric:'ACK',unit:'SYNTHETIC RECEIPT',tone:'ack' },
  { number:'05',tag:'FIELD VALIDATION',title:'DESIGN FOR RECOVERY.',subtitle:'From simulated to deployable.',detail:'The next frontier is hardware, secure identity and public-safety pilots. The orbital gateway remains conceptual.',status:'PILOT REQUIRED',metric:'NEXT',unit:'PHYSICAL VALIDATION',tone:'recovery' }
] as const;

type GlobeProps={progressRef:RefObject<number>;active:number;reduceMotion:boolean};

function GlobeCanvas({progressRef,active,reduceMotion}:GlobeProps){
  const containerRef=useRef<HTMLDivElement>(null);
  const [supported,setSupported]=useState(true);
  useEffect(()=>{
    let destroyed=false;
    let frame=0;
    let observer:IntersectionObserver|undefined;
    let resizeObserver:ResizeObserver|undefined;
    let stop:()=>void=()=>{};
    const mount=containerRef.current;
    if(!mount) return;
    async function setup(){
      const THREE=await import('three');
      if(destroyed||!mount) return;
      const scene=new THREE.Scene();
      scene.background=new THREE.Color('#060e15');
      const camera=new THREE.PerspectiveCamera(39,1,.1,140);
      camera.position.set(0,0,10.6);
      let renderer:InstanceType<typeof THREE.WebGLRenderer>;
      try{ renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'low-power'}); }
      catch{setSupported(false);return;}
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<720?1.5:1.8));
      mount.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden','true');
      renderer.domElement.style.cssText='width:100%;height:100%;display:block;';
      const ambient=new THREE.AmbientLight('#a8cddd',1.35);scene.add(ambient);
      const sun=new THREE.DirectionalLight('#d4e6f4',2.1);sun.position.set(-3,5,7);scene.add(sun);
      const rim=new THREE.PointLight('#ff8664',16,18);rim.position.set(5,-2,-1);scene.add(rim);
      const sphereGroup=new THREE.Group();scene.add(sphereGroup);
      const earth=new THREE.Group();sphereGroup.add(earth);
      const map=document.createElement('canvas');map.width=1024;map.height=512;
      const ctx=map.getContext('2d');
      if(ctx){
        const sea=ctx.createLinearGradient(0,0,1024,512);
        sea.addColorStop(0,'#112d42');sea.addColorStop(.5,'#0d2536');sea.addColorStop(1,'#061522');
        ctx.fillStyle=sea;ctx.fillRect(0,0,1024,512);
        ctx.strokeStyle='rgba(121,200,218,.14)';ctx.lineWidth=1;
        for(let x=0;x<1024;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}
        for(let y=0;y<512;y+=43){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1024,y);ctx.stroke();}
        const shapes=[
          [[76,79],[136,57],[180,78],[219,103],[248,145],[240,173],[216,190],[198,218],[179,232],[166,210],[145,202],[118,178],[102,146],[78,130]],
          [[220,226],[241,237],[258,280],[263,313],[249,358],[236,395],[221,444],[201,422],[204,389],[187,353],[194,307],[185,274]],
          [[463,109],[507,79],[573,70],[614,96],[660,88],[726,96],[781,128],[818,156],[838,190],[802,209],[766,195],[747,231],[712,225],[695,259],[654,244],[616,200],[575,216],[545,188],[510,194],[484,167]],
          [[511,213],[568,220],[591,265],[575,314],[544,369],[518,369],[500,326],[487,295],[483,255]],
          [[775,340],[831,328],[879,364],[890,394],[854,419],[817,399],[790,371]],
          [[920,66],[946,56],[961,95],[947,116],[932,102]]
        ];
        for(const points of shapes){
          ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
          ctx.fillStyle='#254f61';ctx.fill();
          ctx.strokeStyle='rgba(139,211,220,.65)';ctx.lineWidth=1.5;ctx.stroke();
        }
        for(let i=0;i<170;i++){
          const x=(i*97.31)%1024,y=(i*53.11)%512;
          ctx.fillStyle='rgba(151,213,218,.16)';ctx.fillRect(x,y,1.5,1.5);
        }
      }
      const earthTexture=new THREE.CanvasTexture(map);
      earthTexture.colorSpace=THREE.SRGBColorSpace;
      const globe=new THREE.Mesh(new THREE.SphereGeometry(2.45,96,64),new THREE.MeshStandardMaterial({map:earthTexture,metalness:.27,roughness:.84,emissive:'#0b2537',emissiveIntensity:.23}));
      earth.add(globe);
      const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(2.53,72,56),new THREE.MeshBasicMaterial({color:'#5ab4d5',side:THREE.BackSide,transparent:true,opacity:.105,depthWrite:false}));
      earth.add(atmosphere);
      const wireMat=new THREE.LineBasicMaterial({color:'#74d0e1',transparent:true,opacity:.16});
      for(let latitude=-60;latitude<=60;latitude+=30){
        const lat=latitude*Math.PI/180;
        const points=[];
        for(let k=0;k<=160;k++){
          const t=k/160*2*Math.PI;
          points.push(new THREE.Vector3(Math.cos(lat)*Math.cos(t)*2.475,Math.sin(lat)*2.475,Math.cos(lat)*Math.sin(t)*2.475));
        }
        earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),wireMat));
      }
      for(let longitude=0;longitude<180;longitude+=30){
        const lon=longitude*Math.PI/180;
        const points=[];for(let k=0;k<=160;k++){const t=k/160*2*Math.PI;points.push(new THREE.Vector3(Math.sin(t)*Math.cos(lon)*2.475,Math.cos(t)*2.475,Math.sin(t)*Math.sin(lon)*2.475));}
        earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),wireMat));
      }
      let seed=23;
      const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
      const starsGeo=new THREE.BufferGeometry();
      const stars=new Float32Array(600*3);
      for(let i=0;i<600;i++){const r=19+rand()*36;const theta=rand()*2*Math.PI;const phi=Math.acos(2*rand()-1);stars[i*3]=r*Math.sin(phi)*Math.cos(theta);stars[i*3+1]=r*Math.cos(phi);stars[i*3+2]=r*Math.sin(phi)*Math.sin(theta);}
      starsGeo.setAttribute('position',new THREE.BufferAttribute(stars,3));
      scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:'#8bb5c8',size:.045,transparent:true,opacity:.6,sizeAttenuation:true})));
      const toSurface=(lat:number,lon:number,r=2.49)=>{
        const a=lat*Math.PI/180,b=lon*Math.PI/180;
        return new THREE.Vector3(r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b));
      };
      const stationCoords:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[39,-5],[50,9],[57,28],[25,55],[-12,103],[4,-48]];
      const stations=stationCoords.map(([lat,lon],i)=>{
        const material=new THREE.MeshBasicMaterial({color:i===0?'#ff9573':'#74c7da',transparent:true,opacity:i===0?1:.3});
        const mesh=new THREE.Mesh(new THREE.SphereGeometry(i===0?.082:.061,12,12),material);
        mesh.position.copy(toSurface(lat,lon));earth.add(mesh);return mesh;
      });
      const arcs:{line:InstanceType<typeof THREE.Line>;material:InstanceType<typeof THREE.LineBasicMaterial>;start:number;end:number;from:number;to:number;color:string}[]=[];
      const addArc=(from:number,to:number,color:string,start:number,end:number)=>{
        const a=stations[from].position.clone().normalize(),b=stations[to].position.clone().normalize();
        const points=[];
        for(let i=0;i<=72;i++){const t=i/72;const v=a.clone().lerp(b,t).normalize().multiplyScalar(2.52+Math.sin(t*Math.PI)*(.2+Math.acos(Math.max(-1,Math.min(1,a.dot(b))))*.16));points.push(v);}
        const geometry=new THREE.BufferGeometry().setFromPoints(points);
        const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:0,depthWrite:false});
        const line=new THREE.Line(geometry,material);earth.add(line);
        arcs.push({line,material,start,end,from,to,color});
      };
      addArc(0,1,'#ffaf7d',.25,.43);
      addArc(1,2,'#63d8ee',.42,.64);
      addArc(2,3,'#63d8ee',.47,.68);
      addArc(3,4,'#8cdad3',.62,.83);
      addArc(0,5,'#73e0c9',.7,.96);
      const orbitGroup=new THREE.Group();scene.add(orbitGroup);
      for(let i=0;i<3;i++){
        const points=[];for(let j=0;j<=220;j++){const t=j/220*2*Math.PI;points.push(new THREE.Vector3(Math.cos(t)*3.35,0,Math.sin(t)*3.35));}
        const material=new THREE.LineBasicMaterial({color:i===1?'#e68776':'#61a9be',transparent:true,opacity:.16});
        const circle=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);
        circle.rotation.set(.28+i*.5,.25+i*.6,.3+i*.25);orbitGroup.add(circle);
      }
      const satellite=new THREE.Group();
      const chassis=new THREE.Mesh(new THREE.BoxGeometry(.16,.11,.18),new THREE.MeshBasicMaterial({color:'#d9edf2'}));satellite.add(chassis);
      [-.27,.27].forEach(x=>{const panel=new THREE.Mesh(new THREE.BoxGeometry(.29,.016,.13),new THREE.MeshBasicMaterial({color:'#2b8aa7'}));panel.position.x=x;satellite.add(panel);});
      orbitGroup.add(satellite);
      const beacon=new THREE.PointLight('#ff8a68',1.9,3);scene.add(beacon);beacon.position.set(0,0,3.2);
      function measure(){
        if(!mount||destroyed)return;
        const box=mount.getBoundingClientRect();const w=Math.max(1,box.width),h=Math.max(1,box.height);
        camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
      }
      resizeObserver=new ResizeObserver(measure);resizeObserver.observe(mount);measure();
      let visible=false;let t=0,last=0;
      const clock=new THREE.Clock();
      function paint(timestamp=0){
        if(destroyed||!visible)return;
        if(timestamp-last<28&&!reduceMotion){frame=requestAnimationFrame(paint);return;}
        last=timestamp;
        const progress=Math.max(0,Math.min(1,progressRef.current??0));
        const eased=progress*progress*(3-2*progress);
        if(!reduceMotion)t+=Math.min(clock.getDelta(),.05);else clock.getDelta();
        earth.rotation.y=.25+progress*3.65+(reduceMotion?0:Math.sin(t*.18)*.035);
        earth.rotation.x=-.12+Math.sin(progress*Math.PI*2)*.16;
        sphereGroup.rotation.z=(progress-.5)*.09;
        sphereGroup.scale.setScalar(1+.10*Math.sin(progress*Math.PI));
        camera.position.z=10.7-.8*Math.sin(progress*Math.PI);
        const orbitAlpha=Math.max(.05,Math.min(1,(progress-.15)*2.4));
        orbitGroup.rotation.y=progress*1.5+(reduceMotion?0:t*.035);
        orbitGroup.traverse(item=>{
          if(item instanceof THREE.Line){const m=item.material as InstanceType<typeof THREE.LineBasicMaterial>;m.opacity=.08+orbitAlpha*.24;}
        });
        satellite.position.set(3.35*Math.cos(progress*5.6+(reduceMotion?0:t*.32)),.06,3.35*Math.sin(progress*5.6+(reduceMotion?0:t*.32)));
        satellite.lookAt(0,0,0);
        satellite.visible=progress>.42;
        const visibleNodes=Math.max(1,Math.min(6,Math.floor(progress*8)+1));
        stations.forEach((node,i)=>{
          const m=node.material as InstanceType<typeof THREE.MeshBasicMaterial>;
          m.opacity=i===0?1:i<visibleNodes?.8:.08;
          const scale=i===0?1+Math.sin(t*3)*.19:1+(progress*.45);
          node.scale.setScalar(scale);
        });
        arcs.forEach(a=>{
          const inRange=(progress-a.start)/(a.end-a.start);
          a.material.opacity=Math.max(0,Math.min(1,inRange))*.95;
        });
        globe.material.emissiveIntensity=.12+eased*.45;
        atmosphere.material.opacity=.08+eased*.105;
        rim.intensity=11+(1-progress)*7;
        renderer.render(scene,camera);
        if(!reduceMotion)frame=requestAnimationFrame(paint);
      }
      const onWindowScroll=()=>{if(reduceMotion&&visible)paint()};
      const onWindowResize=()=>{measure();if(reduceMotion&&visible)paint()};
      observer=new IntersectionObserver(entries=>{
        visible=!!entries[0]?.isIntersecting;
        cancelAnimationFrame(frame);
        if(visible){clock.getDelta();frame=requestAnimationFrame(paint);}
      },{rootMargin:'150px'});
      observer.observe(mount);
      window.addEventListener('scroll',onWindowScroll,{passive:true});
      window.addEventListener('resize',onWindowResize,{passive:true});
      stop=()=>{
        window.removeEventListener('scroll',onWindowScroll);
        window.removeEventListener('resize',onWindowResize);
        cancelAnimationFrame(frame);
        observer?.disconnect();resizeObserver?.disconnect();
        scene.traverse(object=>{
          if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){
            object.geometry.dispose();
            const material=object.material;
            if(Array.isArray(material))material.forEach(m=>m.dispose());else material.dispose();
          }
        });
        earthTexture.dispose();renderer.dispose();renderer.domElement.remove();
      };
      if(destroyed)stop();
    }
    void setup().catch(()=>{if(!destroyed)setSupported(false)});
    return()=>{destroyed=true;stop();observer?.disconnect();resizeObserver?.disconnect();cancelAnimationFrame(frame)};
  },[progressRef,reduceMotion]);
  return <div ref={containerRef} className="scroll-globe-canvas" aria-label="Illustrative orbital model, not live satellite data">
    {!supported&&<div className="scroll-globe-fallback" role="img" aria-label="Fallback orbital Earth graphic"><span>◉</span><p>ORBITAL MODEL / STATIC VIEW</p></div>}
    <div className="scroll-globe-caption" aria-hidden="true">SYNTHETIC EARTH TOPOLOGY <span>FRAME {String(active+1).padStart(2,'0')}/05</span></div>
  </div>;
}

export default function ScrollExperience(){
  const sectionRef=useRef<HTMLElement>(null);
  const chaptersRef=useRef<Array<HTMLElement|null>>([]);
  const progressRef=useRef(0);
  const [active,setActive]=useState(0);
  const [reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduceMotion(query.matches);update();
    query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    let frame=0;
    const measure=()=>{
      frame=0;const cards=chaptersRef.current;if(!cards[0]||!cards[4])return;
      const anchor=window.innerHeight*.53;
      const positions=cards.map(card=>{const r=card?.getBoundingClientRect();return r?r.top+r.height*.5:0});
      const d=positions[0]-positions[4];
      const next=d===0?0:Math.min(1,Math.max(0,(positions[0]-anchor)/d));
      progressRef.current=next;
      let closest=0;let gap=Infinity;
      for(let i=0;i<positions.length;i++){const delta=Math.abs(positions[i]-anchor);if(delta<gap){gap=delta;closest=i;}}
      setActive(previous=>previous===closest?previous:closest);
      sectionRef.current?.style.setProperty('--journey',next.toFixed(4));
    };
    const onScroll=()=>{if(!frame)frame=requestAnimationFrame(measure)};
    onScroll();
    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',onScroll,{passive:true});
    return()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);cancelAnimationFrame(frame)};
  },[]);
  const step=phases[active];
  return <section id="architecture" className="journey" ref={sectionRef} aria-label="Five-stage scroll-controlled communications resilience story">
    <div className="container journey-heading"><span className="eyebrow">01 / INTERACTIVE MISSION</span><h2>WATCH THE NETWORK <em>EVOLVE.</em></h2><p>Scroll to move through five stages of a simulated communications crisis.</p></div>
    <div className="container journey-grid">
      <div className="journey-chapters">
        {phases.map((phase,i)=><article key={phase.number} id={'stage-'+(i+1)} ref={node=>{chaptersRef.current[i]=node}} className={'journey-chapter '+(active===i?'chapter-current':'')}>
          <div className="chapter-rail"><span>{phase.number} / 05</span><i/></div>
          <div className="chapter-copy"><p className="eyebrow">{phase.tag}</p><h3>{phase.title}</h3><h4>{phase.subtitle}</h4><p>{phase.detail}</p>
            <span className="chapter-claim">{i<2?'BROWSER SOFTWARE CONCEPT':i<4?'SYNTHETIC NETWORK VISUALIZATION':'RESEARCH ROADMAP / NOT CERTIFIED'}</span>
          </div>
        </article>)}
      </div>
      <div className="journey-viewport">
        <div className="journey-stage-panel" data-phase={active}>
          <div className="journey-topline"><span><i/> MISSION SIMULATION / SCROLL ENGINE</span><span>0{active+1} / 05</span></div>
          <div className="journey-visual"><GlobeCanvas progressRef={progressRef} active={active} reduceMotion={reduceMotion}/>
            <div className="journey-hud hud-top"><span>MODEL STATE</span><strong className={'tone-'+step.tone}>{step.status}</strong></div>
            <div className="journey-hud hud-bottom"><span>OBSERVATION</span><strong>{step.metric}</strong><small>{step.unit}</small></div>
            <div className="journey-crosshair" aria-hidden="true"><span>+</span></div>
          </div>
          <div className="journey-controls">
            <div className="journey-progress"><span>SEQUENCE PROGRESS</span><strong>{Math.round((active/4)*100)}%</strong><div className="journey-track"><i/></div></div>
            <div className="journey-phase-nav" role="group" aria-label="Jump between the five chapters">
              {phases.map((phase,i)=><button type="button" key={phase.number} aria-label={'Go to '+phase.tag} aria-current={active===i?'step':undefined} className={active===i?'selected':''} onClick={()=>chaptersRef.current[i]?.scrollIntoView({behavior:reduceMotion?'instant':'smooth',block:'center'})}>{phase.number}</button>)}
            </div>
          </div>
          <p className="journey-footnote">All paths, satellites and scenario telemetry are illustrative. No real device, official alert or live uplink.</p>
        </div>
      </div>
    </div>
  </section>;
}
