'use client';
import {useEffect,useRef,useState} from 'react';
import type {SimulationResult} from '../lib/emergency-routing.mjs';

export default function EmergencyBuilding({model,stage}:{model:SimulationResult;stage:number}){
 const holder=useRef<HTMLDivElement>(null);
 const [fallback,setFallback]=useState(false);
 useEffect(()=>{
  const host=holder.current;if(!host)return;
  let destroyed=false,raf=0;let cleanup=()=>{};
  async function setup(){
   const THREE=await import('three');if(destroyed)return;
   let renderer:InstanceType<typeof THREE.WebGLRenderer>;
   try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
   catch{setFallback(true);return;}
   renderer.setPixelRatio(Math.min(1.5,window.devicePixelRatio||1));
   renderer.outputColorSpace=THREE.SRGBColorSpace;
   renderer.domElement.style.cssText='width:100%;height:100%;display:block;';
   host.appendChild(renderer.domElement);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,1,.1,100);
   camera.position.set(8,5,12);camera.lookAt(0,0,0);
   scene.add(new THREE.AmbientLight('#93aec8',2.2));
   const sun=new THREE.DirectionalLight('#b8f3f7',2.5);sun.position.set(-4,8,10);scene.add(sun);
   const building=new THREE.Group();scene.add(building);
   const floorMat=new THREE.MeshStandardMaterial({color:'#324658',metalness:.22,roughness:.7,transparent:true,opacity:.88});
   for(let i=0;i<5;i++){
    const floor=new THREE.Mesh(new THREE.BoxGeometry(7.1,.09,3.4),floorMat);
    floor.position.set(i>2?.15*i:0,(i-2)*.7,0);
    if(stage>0&&i===2){floor.rotation.z=-.16;floor.position.y-=.26;}
    building.add(floor);
    for(let j=-3;j<=3;j++){
     const column=new THREE.Mesh(new THREE.BoxGeometry(.055,.64,.055),new THREE.MeshBasicMaterial({color:'#51768a',transparent:true,opacity:.48}));
     column.position.set(j, (i-2)*.7+.35,-1.62);building.add(column);
    }
   }
   const toPoint=(d:SimulationResult['devices'][number])=>new THREE.Vector3((d.x-.5)*6.7,(d.floor-2)*.7+.3,(d.y-.5)*3.05);
   const dotMaterials=[
    new THREE.MeshBasicMaterial({color:'#59d6a7'}),
    new THREE.MeshBasicMaterial({color:'#ff795d'}),
    new THREE.MeshBasicMaterial({color:'#eeb15e'}),
    new THREE.MeshBasicMaterial({color:'#4e8faa'})
   ];
   const points=new Map<string,InstanceType<typeof THREE.Vector3>>();
   for(const d of model.devices){
    const point=toPoint(d);points.set(d.id,point);
    const classified=stage<2?3:stage<3?3:d.humanStatus==='SAFE'?0:d.humanStatus==='SOS_EXPLICIT'?1:2;
    const dot=new THREE.Mesh(new THREE.SphereGeometry(d.humanStatus==='SOS_EXPLICIT'?.105:.07,9,8),dotMaterials[classified]);
    dot.position.copy(point);
    dot.visible=d.participating;building.add(dot);
   }
   const gateway=new THREE.Mesh(new THREE.OctahedronGeometry(.24),new THREE.MeshBasicMaterial({color:'#b2ecff'}));
   gateway.position.set(4.1,-.1,0);gateway.visible=stage>=8&&model.assumptions.gateway;building.add(gateway);
   if(stage>=7){
    const routes=model.routes.filter(r=>r.humanStatus==='SOS_EXPLICIT'&&r.path.length>1).slice(0,6);
    for(const r of routes){
     const coords=r.path.map(id=>id==='GATEWAY'?gateway.position:points.get(id)).filter((v):v is InstanceType<typeof THREE.Vector3>=>Boolean(v));
     if(coords.length<2)continue;
     const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(coords),
      new THREE.LineBasicMaterial({color:'#75e9e3',transparent:true,opacity:.9}));
     building.add(line);
    }
   }
   const grid=new THREE.GridHelper(13,18,'#28606a','#203541');grid.position.y=-2.4;scene.add(grid);
   const resize=()=>{
    if(!host||destroyed)return;
    const w=Math.max(200,host.clientWidth),h=Math.max(200,host.clientHeight);
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
   };
   const ro=new ResizeObserver(resize);ro.observe(host);resize();
   const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   const frame=()=>{if(destroyed)return;if(!reduced)building.rotation.y+=.0022;renderer.render(scene,camera);raf=requestAnimationFrame(frame);};
   frame();
   cleanup=()=>{cancelAnimationFrame(raf);ro.disconnect();scene.traverse(obj=>{
    if(obj instanceof THREE.Mesh){obj.geometry.dispose();}
    if(obj instanceof THREE.Line){obj.geometry.dispose();}
   });floorMat.dispose();dotMaterials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();};
  }
  void setup().catch(()=>{if(!destroyed)setFallback(true);});
  return()=>{destroyed=true;cleanup();};
 },[model,stage]);
 return <div className="mer-building" ref={holder} role="img"
   aria-label="Simulated three-dimensional partially collapsed building, virtual devices and routing paths">
   {fallback&&<p className="mer-fallback">3D unavailable; numerical results remain accessible below.</p>}
   <span className="mer-model-stamp">3D RESEARCH MODEL / NOT A LIVE MAP</span>
 </div>;
}
