'use client';
import {useEffect,useRef,useState} from 'react';
import type {SimulationResult} from '../lib/emergency-routing.mjs';
import type {BuildingMissionState} from '../lib/building-mission.mjs';
import type {Locale} from './copy';
import {buildingMissionCopy} from './building-mission-copy';

type Props={model:SimulationResult;stage:number;selectedId?:string;onSelect?:(id:string)=>void;
 floor?:number|null;mission?:BuildingMissionState|null;playing?:boolean;hopDuration?:number;locale?:Locale};
export default function EmergencyBuilding({model,stage,selectedId='NODE-001',onSelect,floor=null,mission=null,playing=false,hopDuration=950,locale='en'}:Props){
 const t=buildingMissionCopy[locale];
 const holder=useRef<HTMLDivElement>(null),marker=useRef<HTMLSpanElement>(null);
 const [fallback,setFallback]=useState(false);
 const latest=useRef({model,stage,selectedId,onSelect,floor,mission,playing,hopDuration});
 latest.current={model,stage,selectedId,onSelect,floor,mission,playing,hopDuration};
 const controls=useRef<{update:()=>void;zoom:(amount:number)=>void;reset:()=>void}|null>(null);
 useEffect(()=>{controls.current?.update();},[model,stage,selectedId,floor,mission,playing,hopDuration]);
 useEffect(()=>{
  const host=holder.current;if(!host)return;
  let destroyed=false,frame=0;let cleanup=()=>{};
  async function setup(){
   const THREE=await import('three');if(destroyed)return;
   let renderer:InstanceType<typeof THREE.WebGLRenderer>;
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
   catch{setFallback(true);return;}
   renderer.setPixelRatio(Math.min(1.6,window.devicePixelRatio||1));renderer.outputColorSpace=THREE.SRGBColorSpace;
   const canvas=renderer.domElement;canvas.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y;';
   canvas.setAttribute('aria-hidden','true');host!.appendChild(canvas);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.1,100);
   scene.add(new THREE.AmbientLight('#d1e8ee',2));
   const sun=new THREE.DirectionalLight('#bbdbe7',3);sun.position.set(-5,9,8);scene.add(sun);
   const rim=new THREE.DirectionalLight('#6dddd1',1.7);rim.position.set(4,2,-6);scene.add(rim);
   const content=new THREE.Group();scene.add(content);
   const grid=new THREE.GridHelper(15,24,'#264c5b','#162e3b');grid.position.y=-2.15;scene.add(grid);
   let yaw=.47,pitch=.47,distance=17,visible=true,contextLost=false,lastUpdate=performance.now();
   let packet:InstanceType<typeof THREE.Mesh>|null=null;
   let points:InstanceType<typeof THREE.Vector3>[]=[],selectedPoint=new THREE.Vector3();
   let targets:InstanceType<typeof THREE.Mesh>[]=[];
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
   const nodePoint=(device:SimulationResult['devices'][number])=>new THREE.Vector3((device.x-.5)*6.2,(device.floor-2)*.91+.27,(device.y-.5)*2.8);
   const gatewayPoint=new THREE.Vector3(4.5,-1.3,.1),cellPoint=new THREE.Vector3(-4.7,.5,.2),centrePoint=new THREE.Vector3(4.8,.2,.2);
   const disposeContent=()=>{content.traverse(object=>{
    if(object instanceof THREE.Mesh||object instanceof THREE.Line){object.geometry.dispose();
     const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}
   });content.clear();};
   const line=(a:InstanceType<typeof THREE.Vector3>,b:InstanceType<typeof THREE.Vector3>,color:string,opacity:number,thick=false)=>{
    if(thick){const direction=b.clone().sub(a);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,direction.length(),8),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthTest:false}));
     mesh.renderOrder=10;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());content.add(mesh);}
    else content.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color,transparent:true,opacity})));
   };
   const draw=()=>{
    if(destroyed||contextLost)return;
    camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);
    camera.lookAt(.4,.1,0);
    const data=latest.current;
    if(packet&&points.length){
     const cursor=Math.min(data.mission?.cursor??0,points.length-1);
     const amount=data.playing&&!reduced.matches&&data.mission?.state==='IN_TRANSIT'?Math.min(1,(performance.now()-lastUpdate)/data.hopDuration):0;
     packet.position.copy(points[cursor]).lerp(points[Math.min(cursor+1,points.length-1)],amount);
    }
    renderer.render(scene,camera);
    if(marker.current){const projected=selectedPoint.clone().project(camera),w=host!.clientWidth,h=host!.clientHeight;
     marker.current.style.transform=`translate(${Math.min(Math.max(12,(projected.x*.5+.5)*w+12),Math.max(12,w-160))}px, ${Math.max(55,Math.min(h-70,(-projected.y*.5+.5)*h-28))}px)`;}
    if(visible&&!document.hidden&&data.playing&&data.mission?.state==='IN_TRANSIT'&&!reduced.matches)frame=requestAnimationFrame(draw);
   };
   const update=()=>{
    if(destroyed||contextLost)return;
    cancelAnimationFrame(frame);disposeContent();targets=[];packet=null;points=[];lastUpdate=performance.now();
    const data=latest.current;
    for(let n=0;n<5;n++){
     const focus=data.floor===null||data.floor===n;
     const slab=new THREE.Mesh(new THREE.BoxGeometry(6.8,.11,3.25),new THREE.MeshStandardMaterial({color:focus?'#324b5d':'#20313d',roughness:.75,metalness:.25,transparent:true,opacity:focus?(data.floor===null?.32:.6):.07}));
     slab.position.y=(n-2)*.91;content.add(slab);
     const edges=new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry),new THREE.LineBasicMaterial({color:focus?'#7096a7':'#344754',transparent:true,opacity:focus?.6:.22}));edges.position.copy(slab.position);content.add(edges);
     for(const x of [-3.1,0,3.1])for(const z of [-1.5,1.5]){
      const column=new THREE.Mesh(new THREE.BoxGeometry(.045,.91,.045),new THREE.MeshStandardMaterial({color:'#5b7481',transparent:true,opacity:focus?.68:.1}));column.position.set(x,(n-2)*.91+.45,z);content.add(column);
     }
    }
    const byId=new Map<string,InstanceType<typeof THREE.Vector3>>();
    for(const device of data.model.devices){
     if(!device.participating)continue;
     const point=nodePoint(device);byId.set(device.id,point);
     const selected=device.id===data.selectedId,onPath=data.mission?.path.includes(device.id),focus=data.floor===null||data.floor===device.floor||selected;
     const color=device.humanStatus==='SAFE'?'#59d6a7':device.humanStatus==='SOS_EXPLICIT'?'#ff795d':'#8ca5b4';
     const phone=new THREE.Mesh(new THREE.BoxGeometry(selected?.2:onPath?.16:.12,selected?.32:onPath?.26:.2,.06),new THREE.MeshBasicMaterial({color:selected?'#f0ffff':onPath?'#75e9e3':color,transparent:true,opacity:focus?1:.15,depthTest:!selected&&!onPath}));
     phone.renderOrder=selected||onPath?12:0;phone.position.copy(point);phone.userData.nodeId=device.id;content.add(phone);if(focus)targets.push(phone);
     const screen=new THREE.Mesh(new THREE.PlaneGeometry(selected?.105:.07,selected?.17:.115),new THREE.MeshBasicMaterial({color:selected?'#75e9e3':color,side:THREE.DoubleSide,transparent:true,opacity:focus?.95:.12}));
     screen.position.copy(point).add(new THREE.Vector3(0,.005,.025));content.add(screen);
     if(selected){selectedPoint.copy(point);const ring=new THREE.Mesh(new THREE.RingGeometry(.21,.25,36),new THREE.MeshBasicMaterial({color:'#b4fff0',side:THREE.DoubleSide,depthTest:false}));ring.renderOrder=12;ring.rotation.x=-Math.PI/2;ring.position.copy(point).add(new THREE.Vector3(0,-.12,0));content.add(ring);
      line(point.clone().add(new THREE.Vector3(0,.25,0)),point.clone().add(new THREE.Vector3(0,.7,0)),'#b4fff0',.8);}
    }
    // Only draw compatible, model-computed adjacency around the selected source, not all-to-all noise.
    const source=data.model.devices.find(d=>d.id===data.selectedId);
    if(source&&source.permission&&(data.model.assumptions.wifi||data.model.assumptions.bluetooth))for(const other of data.model.devices){
     if(other.id!==source.id&&other.permission&&Math.hypot(source.x-other.x,source.y-other.y)<=data.model.assumptions.radioRange&&byId.has(other.id))
      line(nodePoint(source),nodePoint(other),'#5f94aa',.22);
    }
    // Disconnected mobile tower on the left and a separate model receiver on the right.
    line(new THREE.Vector3(-4.7,-2,0),new THREE.Vector3(-4.7,1,0),'#875f60',.8,true);
    line(new THREE.Vector3(-5,.5,0),new THREE.Vector3(-4.4,1.1,0),'#ff795d',.95,true);
    line(new THREE.Vector3(-5,1.1,0),new THREE.Vector3(-4.4,.5,0),'#ff795d',.95,true);
    const receiver=new THREE.Mesh(new THREE.BoxGeometry(.6,.85,.5),new THREE.MeshStandardMaterial({color:data.model.assumptions.gateway?'#245c66':'#3d444c',roughness:.6,metalness:.45}));receiver.position.copy(gatewayPoint);content.add(receiver);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.38,.36),new THREE.MeshBasicMaterial({color:data.model.assumptions.gateway?'#75e9e3':'#bc8e75',side:THREE.DoubleSide}));panel.position.copy(gatewayPoint).add(new THREE.Vector3(0,.05,.26));content.add(panel);
    byId.set('GATEWAY',gatewayPoint);byId.set('CELLULAR_MODEL',cellPoint);byId.set('CENTRE_MODEL',centrePoint);
    points=(data.mission?.path||[]).map(id=>byId.get(id)).filter((point):point is InstanceType<typeof THREE.Vector3>=>Boolean(point));
    for(let i=0;i<points.length-1;i++)line(points[i],points[i+1],data.mission?.state==='QUEUED'?'#caa276':i<(data.mission?.cursor??0)?'#b4fff0':'#75c4d3',1,true);
    if(points.length){packet=new THREE.Mesh(new THREE.OctahedronGeometry(.19),new THREE.MeshBasicMaterial({color:data.mission?.state==='RECEIVED'?'#b4fff0':'#ffbc74',depthTest:false}));packet.renderOrder=20;content.add(packet);}
    draw();
   };
   const resize=()=>{const w=Math.max(1,host!.clientWidth),h=Math.max(1,host!.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);cancelAnimationFrame(frame);draw();};
   const ro=new ResizeObserver(resize);ro.observe(host!);
   const raycaster=new THREE.Raycaster();let drag:{x:number;y:number;px:number;py:number;distance:number}|null=null;
   const pointerDown=(event:PointerEvent)=>{drag={x:event.clientX,y:event.clientY,px:event.clientX,py:event.clientY,distance:0};canvas.setPointerCapture(event.pointerId);};
   const pointerMove=(event:PointerEvent)=>{if(!drag)return;const dx=event.clientX-drag.px,dy=event.clientY-drag.py;
    drag.distance+=Math.abs(dx)+Math.abs(dy);if(drag.distance>5){yaw-=dx*.008;if(event.pointerType!=='touch')pitch=Math.max(.15,Math.min(.95,pitch+dy*.005));cancelAnimationFrame(frame);draw();}drag.px=event.clientX;drag.py=event.clientY;};
   const pointerUp=(event:PointerEvent)=>{
    if(drag&&drag.distance<=5){const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1),camera);
     const hit=raycaster.intersectObjects(targets)[0];if(hit)latest.current.onSelect?.(hit.object.userData.nodeId);}
    drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
   };
   const cancelPointer=()=>{drag=null;};
   const contextLoss=(event:Event)=>{event.preventDefault();contextLost=true;cancelAnimationFrame(frame);if(!destroyed)setFallback(true);};
   const visibility=()=>{cancelAnimationFrame(frame);if(!document.hidden)draw();};
   const observer=new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting);cancelAnimationFrame(frame);if(visible)draw();});observer.observe(host!);
   canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('webglcontextlost',contextLoss);
   document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);
   controls.current={update,zoom:amount=>{distance=Math.min(23,Math.max(11,distance+amount));cancelAnimationFrame(frame);draw();},reset:()=>{yaw=.47;pitch=.47;distance=17;cancelAnimationFrame(frame);draw();}};
   resize();update();
   cleanup=()=>{controls.current=null;cancelAnimationFrame(frame);ro.disconnect();observer.disconnect();
    canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',cancelPointer);canvas.removeEventListener('webglcontextlost',contextLoss);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);
    disposeContent();grid.geometry.dispose();if(Array.isArray(grid.material))grid.material.forEach(material=>material.dispose());else grid.material.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();};
   if(destroyed)cleanup();
  }
  void setup().catch(()=>{if(!destroyed)setFallback(true);});
  return ()=>{destroyed=true;cleanup();};
 },[locale]);
 const planPoint=(id:string)=>{const device=model.devices.find(d=>d.id===id);return device?{x:70+device.x*480,y:340-device.floor*58+device.y*12}:{x:id==='CELLULAR_MODEL'?30:655,y:320};};
 return <div className="mer-building bml-building" data-testid="mission-scene" data-fallback={fallback} role="group" aria-label={t.view}>
  <div className="bml-canvas-host" ref={holder}/>
  {fallback&&<div className="bml-flat-view"><svg viewBox="0 0 760 440" aria-hidden="true">
   {[0,1,2,3,4].map(n=><g key={n} opacity={floor===null||floor===n?1:.25}><path d={`M55 ${370-n*58}H580`} stroke="#3b6375"/><text x="18" y={366-n*58} fill="#a5bdc9" fontSize="13">{n+1}</text></g>)}
   {(mission?.path||[]).slice(1).map((id,index)=>{const a=planPoint(mission!.path[index]),b=planPoint(id);return <path key={index} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke={index<(mission?.cursor??0)?'#b4fff0':'#448b9c'} strokeWidth="3"/>;})}
   {model.devices.filter(d=>d.participating).map(device=>{const p=planPoint(device.id);return <rect key={device.id} onClick={()=>onSelect?.(device.id)} x={p.x-11} y={p.y-17} width="22" height="34" rx="3" fill={device.id===selectedId?'#e8ffff':device.humanStatus==='SAFE'?'#59d6a7':device.humanStatus==='SOS_EXPLICIT'?'#ff795d':'#8ca5b4'} opacity={floor===null||device.floor===floor||device.id===selectedId?1:.2} style={{cursor:'pointer'}}/>;})}
   <text x={planPoint(selectedId).x} y={planPoint(selectedId).y-28} fill="#e8ffff" fontSize="22">{selectedId}</text>
   {mission?.path.length? <circle cx={planPoint(mission.path[mission.cursor]).x} cy={planPoint(mission.path[mission.cursor]).y} r="13" fill={mission.state==='RECEIVED'?'#b4fff0':'#ffbc74'}/>:null}
   <rect x="635" y="300" width="38" height="42" fill={model.assumptions.gateway?'#75e9e3':'#bc8e75'}/>
   <text x="590" y="367" fill="#a5bdc9" fontSize="13">{t.receiver}</text>
  </svg><p>{t.fallback}</p></div>}
  {!fallback&&<span className="bml-node-label" ref={marker} aria-hidden="true">{selectedId}<small>{t.selected}</small></span>}
  <div className="bml-view-tools"><span>{fallback?'2D':t.drag}</span>{!fallback&&<div>
   <button type="button" aria-label={t.zoomIn} onClick={()=>controls.current?.zoom(-2)}>+</button>
   <button type="button" aria-label={t.zoomOut} onClick={()=>controls.current?.zoom(2)}>−</button>
   <button type="button" aria-label={t.resetView} onClick={()=>controls.current?.reset()}>↺</button>
  </div>}</div>
 </div>;
}
