import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Line, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// Data flow particles for the mesh network
function DataParticles({ points }: { points: THREE.Vector3[] }) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleCount = 200;
  
  const [positions, phases] = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const ph = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      ph[i] = Math.random() * Math.PI * 2;
    }
    return [pos, ph];
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const time = clock.getElapsedTime();
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      // Pick two random points to travel between
      const idx1 = i % points.length;
      const idx2 = (i + 1) % points.length;
      const p1 = points[idx1];
      const p2 = points[idx2];
      
      const t = (Math.sin(time * 0.5 + phases[i]) + 1) / 2; // 0 to 1
      
      positions[i * 3] = p1.x + (p2.x - p1.x) * t;
      positions[i * 3 + 1] = p1.y + (p2.y - p1.y) * t + Math.sin(t * Math.PI) * 0.5; // Arc
      positions[i * 3 + 2] = p1.z + (p2.z - p1.z) * t;
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#38bdf8" size={0.05} transparent opacity={0.8} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// Earth with advanced wireframe and glowing atmosphere
function AdvancedEarth() {
  const earthRef = useRef<THREE.Group>(null);
  const atmosRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (earthRef.current) {
      earthRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
    if (atmosRef.current) {
      atmosRef.current.rotation.y = clock.getElapsedTime() * 0.06;
      const scale = 1 + Math.sin(clock.getElapsedTime() * 2) * 0.01;
      atmosRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={earthRef}>
      {/* Core solid earth */}
      <Sphere args={[2, 64, 64]}>
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </Sphere>
      
      {/* High-tech wireframe layer */}
      <Sphere args={[2.01, 32, 32]}>
        <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.15} blending={THREE.AdditiveBlending} />
      </Sphere>

      {/* Pulsing Atmosphere */}
      <Sphere ref={atmosRef} args={[2.15, 64, 64]}>
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.05} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </Sphere>
    </group>
  );
}

// Complex Satellite with scanning rays
function AdvancedSatellite({ position, label, active, delay = 0 }: { position: [number, number, number]; label: string; active: boolean; delay?: number }) {
  const satelliteRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const [x, y, z] = position;
  const radius = Math.sqrt(x * x + z * z);
  const color = active ? "#10b981" : "#ef4444";

  useFrame(({ clock }) => {
    if (satelliteRef.current) {
      const time = clock.getElapsedTime() + delay;
      const angle = time * 0.2;

      // Orbit
      satelliteRef.current.position.x = Math.cos(angle) * radius;
      satelliteRef.current.position.z = Math.sin(angle) * radius;
      satelliteRef.current.position.y = y + Math.sin(time) * 0.5;
      
      // Look at Earth (0,0,0)
      satelliteRef.current.lookAt(0, 0, 0);
    }
    
    if (beamRef.current) {
       beamRef.current.scale.y = 1 + Math.sin(clock.getElapsedTime() * 4 + delay) * 0.5;
       (beamRef.current.material as THREE.MeshBasicMaterial).opacity = (0.2 + Math.sin(clock.getElapsedTime() * 8 + delay) * 0.1) * (active ? 1 : 0);
    }
  });

  const orbitPoints = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
    return curve.getPoints(128).map(p => new THREE.Vector3(p.x, y, p.y));
  }, [radius, y]);

  return (
    <group>
      {/* Orbit Trail */}
      <Line points={orbitPoints} color={color} lineWidth={1} opacity={0.15} transparent dashed dashSize={0.5} gapSize={0.2} />

      {/* Satellite Body */}
      <group ref={satelliteRef} position={[x, y, z]}>
        {/* Main chassis */}
        <mesh>
          <boxGeometry args={[0.4, 0.4, 0.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        
        {/* Solar panels */}
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[1.2, 0.05, 0.4]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[-0.6, 0, 0]}>
          <boxGeometry args={[1.2, 0.05, 0.4]} />
          <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
        </mesh>
        
        {/* Antenna / Emitter */}
        <mesh position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.1, 0, 0.3, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
        </mesh>

        {/* Scanning Beam pointing to earth */}
        <mesh ref={beamRef} position={[0, -2, 0]}>
          <cylinderGeometry args={[0.05, 1.5, 4, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        {/* Dynamic Label */}
        <Html position={[0, 1, 0]} center className="pointer-events-none">
          <div className={`px-2 py-1 rounded bg-slate-900/80 backdrop-blur border text-xs font-mono tracking-widest flex flex-col items-center ${active ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400'}`}>
            <span className="font-bold">{label}</span>
            <span className="text-[8px] opacity-70">{active ? 'UPLINK ACTIVE' : 'NO SIGNAL'}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

// Global Mesh Network wrapping the globe
function GlobalMeshNetwork() {
  const points = useMemo(() => {
    const pts = [];
    // Generate random points on a sphere
    for (let i = 0; i < 40; i++) {
      const phi = Math.acos(-1 + (2 * i) / 40);
      const theta = Math.sqrt(40 * Math.PI) * phi;
      const r = 2.05;
      pts.push(new THREE.Vector3(
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi)
      ));
    }
    return pts;
  }, []);

  return (
    <group>
      {/* Nodes */}
      {points.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color={i % 3 === 0 ? "#f97316" : "#38bdf8"} />
        </mesh>
      ))}
      
      {/* Connections (Mesh links) */}
      {points.map((start, i) => {
        // Connect to nearest 3 neighbors
        const distances = points.map((p, j) => ({ j, dist: start.distanceTo(p) }));
        distances.sort((a, b) => a.dist - b.dist);
        const neighbors = distances.slice(1, 4).map(d => points[d.j]);
        
        return neighbors.map((end, idx) => (
          <Line
            key={`${i}-${idx}`}
            points={[start, end]}
            color={i % 3 === 0 ? "#f97316" : "#3b82f6"}
            lineWidth={1.5}
            opacity={Math.random() * 0.3 + 0.1}
            transparent
            blending={THREE.AdditiveBlending}
          />
        ));
      })}

      {/* Flowing data particles */}
      <DataParticles points={points} />
    </group>
  );
}

// Glitch/Data streams on screen
function DataOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden mix-blend-screen opacity-30">
       <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-slate-900/80"></div>
       {/* Tech grid lines */}
       <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
    </div>
  );
}

export function SatelliteVisualization() {
  return (
    <div className="w-full h-[700px] relative bg-slate-950 rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 border border-slate-800">
      <DataOverlay />
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
          <span className="text-green-400 font-mono text-xs tracking-widest font-bold">SYSTEM ACTIVE</span>
        </div>
        <div className="text-slate-400 font-mono text-xs">GLOBAL MESH PROTOCOL v2.1</div>
      </div>

      <Canvas camera={{ position: [0, 4, 8], fov: 45 }} gl={{ antialias: true, alpha: false }}>
        <color attach="background" args={['#020617']} />
        
        {/* Cinematic Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 3, 5]} intensity={2} color="#ffffff" />
        <pointLight position={[-5, -5, -5]} intensity={5} color="#3b82f6" />
        <pointLight position={[0, 5, 0]} intensity={2} color="#f97316" />

        {/* Deep space background */}
        <Stars radius={150} depth={100} count={8000} factor={6} saturation={1} fade speed={0.5} />
        <Stars radius={50} depth={50} count={2000} factor={3} saturation={1} fade speed={1.5} />

        <AdvancedEarth />
        <GlobalMeshNetwork />

        {/* Constellation */}
        <AdvancedSatellite position={[4.5, 1, 2]} label="SAT-ALPHA" active={true} delay={0} />
        <AdvancedSatellite position={[-3, 2, 4]} label="SAT-BETA" active={true} delay={2.5} />
        <AdvancedSatellite position={[2, -1.5, -4]} label="SAT-GAMMA" active={false} delay={1.2} />
        <AdvancedSatellite position={[-4, -2, -1]} label="SAT-DELTA" active={true} delay={4.1} />

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          minDistance={4}
          maxDistance={15}
          autoRotate
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>

      {/* Advanced HUD Legend */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end pointer-events-none z-20">
        <div className="bg-slate-900/60 backdrop-blur-md px-6 py-4 rounded-xl border border-slate-700/50 flex flex-col gap-3">
          <div className="text-xs font-mono text-slate-400 mb-1 border-b border-slate-700 pb-2">NETWORK TOPOLOGY</div>
          <div className="flex items-center gap-4 text-xs font-mono text-white">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span>SATELLITE UPLINK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              <span>TERRESTRIAL MESH</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-pulse" />
              <span>ACTIVE RELAY</span>
            </div>
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1 font-mono text-[10px] text-slate-500">
          <div>DATA: AES-256 ENCRYPTED</div>
          <div>LATENCY: &lt;45ms</div>
          <div>PACKET LOSS: 0.001%</div>
        </div>
      </div>
    </div>
  );
}
