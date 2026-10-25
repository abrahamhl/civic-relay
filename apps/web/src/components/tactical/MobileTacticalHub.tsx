import React, { useState } from 'react';
import { CameraThroughWallView } from './CameraThroughWallView';
import { SatellitePassCalculator } from './SatellitePassCalculator';
import { WallRadarScanner } from './WallRadarScanner';
import { EwSpectrumSimulator } from './EwSpectrumSimulator';
import { UasRelaySimulator } from './UasRelaySimulator';
import { TacticalHyperframePlayer } from './TacticalHyperframePlayer';
import { Camera, Orbit, Radio, ShieldAlert, Plane, Play, ArrowLeft, BatteryCharging, Wifi, Signal } from 'lucide-react';

interface Props {
  onBackToMain: () => void;
}

export const MobileTacticalHub: React.FC<Props> = ({ onBackToMain }) => {
  const [activeTab, setActiveTab] = useState<'camera_ar' | 'satellites' | 'radar_wall' | 'spectrum' | 'uas_relay' | 'hyperframes'>(
    'camera_ar'
  );

  return (
    <div className="min-h-screen bg-[#03070b] text-slate-100 flex flex-col font-[Inter,system-ui,sans-serif]">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-50 border-b border-[#273a44] bg-[#070e14]/95 backdrop-blur-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMain}
            className="p-1.5 rounded border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            title="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-sm font-black tracking-tight flex items-center gap-1.5">
              CIVIC RELAY <span className="text-[#ff7857]">/ TÁCTICO MÓVIL</span>
            </h1>
            <p className="text-[9px] font-mono text-[#38bdf8]">INTERFAZ OPERATIVA DE CAMPO 2026</p>
          </div>
        </div>

        {/* Mobile Device Status Indicators */}
        <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400">
            <Wifi size={12} /> MESH ON
          </span>
          <span className="flex items-center gap-1 text-[#38bdf8]">
            <Signal size={12} /> L-BAND
          </span>
          <span className="flex items-center gap-1 text-slate-300">
            <BatteryCharging size={13} className="text-emerald-400" /> 84%
          </span>
        </div>
      </header>

      {/* Main Interactive Screen */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-3 sm:p-5 pb-24">
        {activeTab === 'camera_ar' && <CameraThroughWallView />}
        {activeTab === 'satellites' && <SatellitePassCalculator />}
        {activeTab === 'radar_wall' && <WallRadarScanner />}
        {activeTab === 'spectrum' && <EwSpectrumSimulator />}
        {activeTab === 'uas_relay' && <UasRelaySimulator />}
        {activeTab === 'hyperframes' && <TacticalHyperframePlayer />}
      </main>

      {/* Mobile Touch-Friendly Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-[#060c12]/95 border-t border-[#273a44] backdrop-blur-xl px-2 py-1.5 flex justify-around items-center">
        {[
          { id: 'camera_ar', label: 'Cámara AR', icon: Camera, color: '#ff7857' },
          { id: 'satellites', label: 'Satélites', icon: Orbit, color: '#38bdf8' },
          { id: 'radar_wall', label: 'Radar Muro', icon: Radio, color: '#10b981' },
          { id: 'spectrum', label: 'Espectro EW', icon: ShieldAlert, color: '#f43f5e' },
          { id: 'uas_relay', label: 'Drones', icon: Plane, color: '#a855f7' },
          { id: 'hyperframes', label: 'Misión', icon: Play, color: '#f59e0b' },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id as any)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-all ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`p-1 rounded-md transition-all ${
                  isActive ? 'bg-[#ff7857]/20 border border-[#ff7857]/40 shadow-sm' : ''
                }`}
              >
                <Icon size={18} style={{ color: isActive ? item.color : undefined }} />
              </div>
              <span className={`text-[9px] font-mono mt-0.5 tracking-tight ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
