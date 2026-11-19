import React, { useState } from 'react';
import { TacticalHyperframePlayer } from './TacticalHyperframePlayer';
import { WallRadarScanner } from './WallRadarScanner';
import { CameraThroughWallView } from './CameraThroughWallView';
import { SatellitePassCalculator } from './SatellitePassCalculator';
import { UasRelaySimulator } from './UasRelaySimulator';
import { EwSpectrumSimulator } from './EwSpectrumSimulator';
import { GnssDeniedSimulator } from './GnssDeniedSimulator';
import { Camera, Orbit, Eye, Plane, ShieldAlert, Compass, Play, ArrowLeft } from 'lucide-react';

interface Props {
  onBackToMain: () => void;
}

export const TacticalMasterSuite: React.FC<Props> = ({ onBackToMain }) => {
  const [activeTab, setActiveTab] = useState<
    'camera_ar' | 'satellites' | 'wall_radar' | 'hyperframes' | 'uas_relay' | 'ew_spectrum' | 'gnss_denied'
  >('camera_ar');

  return (
    <div className="min-h-screen bg-[#03070b] text-slate-100 font-[Inter,system-ui,sans-serif]">
      {/* Top Cybernetic Nav Header */}
      <header className="sticky top-0 z-50 border-b border-[#344b55] bg-[#070e14]/90 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onBackToMain}
              className="flex items-center gap-2 px-3 py-2 text-xs font-mono border border-slate-700 bg-slate-900 rounded hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <ArrowLeft size={14} /> VOLVER A CIVIC RELAY
            </button>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-base font-black tracking-tight">
                CIVIC RELAY <span className="text-[#ff7857]">/ OEP-TACTICAL</span>
              </span>
              <p className="text-[9px] font-mono tracking-widest text-[#38bdf8]">
                SUITE TÁCTICA MULTI-DOMINIO & SIMULADORES MATERIALIZADOS
              </p>
            </div>
          </div>

          {/* Tactical Status Badges */}
          <div className="hidden lg:flex items-center gap-3 font-mono text-[10px]">
            <span className="px-2.5 py-1 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/40">
              ● MOTORES RF ACTIVOS
            </span>
            <span className="px-2.5 py-1 rounded bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40">
              ● MAVLINK V2 0xBF READY
            </span>
            <span className="px-2.5 py-1 rounded bg-[#ff7857]/15 text-[#ff7857] border border-[#ff7857]/40">
              ● CÁMARA TRAS PAREDES ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Simulator Switcher Navigation Bar */}
      <div className="border-b border-[#273a44] bg-[#091219]">
        <div className="max-w-[1600px] mx-auto px-5 lg:px-10 flex gap-2 overflow-x-auto py-3">
          {[
            { id: 'camera_ar', label: 'CÁMARA AR TRAS PAREDES', icon: Camera, color: '#ff7857' },
            { id: 'satellites', label: 'CÁLCULOS SATÉLITES SGP4', icon: Orbit, color: '#38bdf8' },
            { id: 'wall_radar', label: 'RADAR UWB B-SCAN', icon: Eye, color: '#10b981' },
            { id: 'hyperframes', label: 'HYPERFRAMES EXPLICATIVOS', icon: Play, color: '#f59e0b' },
            { id: 'uas_relay', label: 'RELAY AÉREO UAS & MAVLINK', icon: Plane, color: '#818cf8' },
            { id: 'ew_spectrum', label: 'GUERRA ELECTRÓNICA & EMCON', icon: ShieldAlert, color: '#f43f5e' },
            { id: 'gnss_denied', label: 'NAVEGACIÓN GNSS-DENIED', icon: Compass, color: '#14b8a6' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`px-4 py-2.5 rounded text-xs font-mono font-bold tracking-wider flex items-center gap-2.5 whitespace-nowrap border transition-all ${
                  isActive
                    ? 'border-[#ff7857] bg-[#ff7857]/20 text-white shadow-lg shadow-[#ff7857]/10'
                    : 'border-slate-800 bg-[#0d1720] text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={15} style={{ color: isActive ? item.color : undefined }} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-[1600px] mx-auto px-5 lg:px-10 py-8">
        {activeTab === 'camera_ar' && (
          <div className="space-y-6">
            <CameraThroughWallView />
          </div>
        )}

        {activeTab === 'satellites' && (
          <div className="space-y-6">
            <SatellitePassCalculator />
          </div>
        )}

        {activeTab === 'wall_radar' && (
          <div className="space-y-6">
            <WallRadarScanner />
          </div>
        )}

        {activeTab === 'hyperframes' && (
          <div className="space-y-6">
            <TacticalHyperframePlayer />
          </div>
        )}

        {activeTab === 'uas_relay' && (
          <div className="space-y-6">
            <UasRelaySimulator />
          </div>
        )}

        {activeTab === 'ew_spectrum' && (
          <div className="space-y-6">
            <EwSpectrumSimulator />
          </div>
        )}

        {activeTab === 'gnss_denied' && (
          <div className="space-y-6">
            <GnssDeniedSimulator />
          </div>
        )}
      </main>
    </div>
  );
};
