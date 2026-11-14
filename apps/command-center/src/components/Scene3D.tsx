import { Component, useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { CameraRecord } from '../types';
import { toLocalMeters } from '../lib/geo';

const COLORS: Record<string, string> = {
  tfl: '#3fe0c4',
  caltrans: '#63a8ff',
};

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="scene-fallback">
          <strong>WebGL no disponible en este equipo.</strong>
          <span>El Command Center conserva la vista 2D offline y el resto de paneles.</span>
        </div>
      );
    }
    return this.props.children;
  }
}

function Scene({
  cameras,
  selectedId,
  onSelect,
  span,
}: {
  cameras: CameraRecord[];
  selectedId: string | null;
  onSelect: (camera: CameraRecord) => void;
  span: number;
}) {
  const origin = useMemo(() => {
    const valid = cameras.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
    const lat = valid.reduce((sum, c) => sum + (c.lat as number), 0) / Math.max(valid.length, 1);
    const lon = valid.reduce((sum, c) => sum + (c.lon as number), 0) / Math.max(valid.length, 1);
    return { lat, lon };
  }, [cameras]);

  const positioned = useMemo(
    () =>
      cameras
        .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
        .map((camera) => {
          const { x, z } = toLocalMeters(
            { lat: camera.lat as number, lon: camera.lon as number },
            origin,
          );
          return { camera, x, z };
        }),
    [cameras, origin],
  );

  const gridSize = Math.max(span * 1.4, 4000);
  const cameraDistance = Math.max(span * 1.1, 5000);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[span, span * 0.9, span]} intensity={0.9} />
      <gridHelper args={[gridSize, 48, '#1f3b4d', '#0e1c2a']} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
        <planeGeometry args={[gridSize, gridSize]} />
        <meshStandardMaterial color="#050b12" roughness={1} />
      </mesh>

      {positioned.map(({ camera, x, z }) => {
        const selected = camera.id === selectedId;
        const color = COLORS[camera.dataset] ?? '#93a3b8';
        const height = selected ? 900 : 520;
        return (
          <group key={camera.id} position={[x, 0, z]}>
            <mesh
              position={[0, height / 2, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(camera);
              }}
            >
              <cylinderGeometry args={[selected ? 110 : 70, selected ? 110 : 70, height, 16]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={selected ? 0.9 : 0.35}
              />
            </mesh>
            {selected && (
              <>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
                  <ringGeometry args={[220, 300, 32]} />
                  <meshBasicMaterial color={color} transparent opacity={0.85} side={2} />
                </mesh>
                <Html position={[0, height + 220, 0]} center distanceFactor={span}>
                  <div
                    style={{
                      background: 'rgba(6,10,16,0.92)',
                      border: '1px solid rgba(63,224,196,0.45)',
                      borderRadius: 8,
                      padding: '4px 8px',
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      color: '#e8eef7',
                    }}
                  >
                    {camera.name}
                  </div>
                </Html>
              </>
            )}
          </group>
        );
      })}

      <OrbitControls
        makeDefault
        enablePan
        minDistance={Math.max(span * 0.08, 400)}
        maxDistance={cameraDistance * 3}
        target={[0, 0, 0]}
      />
    </>
  );
}

export function Scene3D({
  cameras,
  selectedId,
  onSelect,
}: {
  cameras: CameraRecord[];
  selectedId: string | null;
  onSelect: (camera: CameraRecord) => void;
}) {
  const valid = cameras.filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  const span = useMemo(() => {
    if (valid.length === 0) return 1000;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const c of valid) {
      minLat = Math.min(minLat, c.lat as number);
      maxLat = Math.max(maxLat, c.lat as number);
      minLon = Math.min(minLon, c.lon as number);
      maxLon = Math.max(maxLon, c.lon as number);
    }
    const metersPerDegLat = 111_320;
    const metersPerDegLon = 111_320 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
    const height = (maxLat - minLat) * metersPerDegLat;
    const width = (maxLon - minLon) * metersPerDegLon;
    return Math.max(Math.min(Math.max(height, width), 2_000_000), 2_000);
  }, [valid]);

  if (valid.length === 0) {
    return (
      <div className="map-frame">
        <div className="map-empty">No hay cámaras para la vista 3D en la selección actual.</div>
      </div>
    );
  }

  return (
    <div className="map-frame">
      <WebGLBoundary>
        <Canvas
          dpr={[1, 2]}
          camera={{
            fov: 48,
            near: 1,
            far: 5_000_000,
            position: [span * 0.5, span * 0.55, span * 1.1],
          }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <Scene cameras={valid} selectedId={selectedId} onSelect={onSelect} span={span} />
        </Canvas>
      </WebGLBoundary>
      <div className="map-overlay">
        <span className="chip">
          <span className="dot info" aria-hidden="true" />
          Marcadores georreferenciados · escala local
        </span>
        <span className="chip">
          <span className="dot muted" aria-hidden="true" />
          Sin pose/FOV: no se simulan conos de cámara
        </span>
      </div>
    </div>
  );
}
