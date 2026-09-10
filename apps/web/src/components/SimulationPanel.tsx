import { useState, useEffect } from 'react';

export const SimulationPanel = ({ role, dispatchSimulatedMessage }: any) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<any>(null);

  useEffect(() => {
    let timer: any;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      // Auto-dispatch SOS
      dispatchSimulatedMessage('SOS', 'CRITICAL', 'ATRAPADO: No confirmación de seguridad', [
        { transportId: 'mesh (bluetooth via transeúnte)', status: 'DELIVERED', timestamp: new Date().toISOString() },
        { transportId: 'wifi-local', status: 'DELIVERED', timestamp: new Date().toISOString() },
        { transportId: 'satellite (LEO)', status: 'DELIVERED', timestamp: new Date().toISOString() }
      ]);
      setCountdown(null);
      setIncomingAlert(null);
      alert("Alerta SOS automática enviada (Inactividad). Geoposición añadida.");
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const emitMassAlert = () => {
    alert("Alerta masiva emitida a todos los ciudadanos en la zona (vía Satélite LEO -> Mesh).");
    dispatchSimulatedMessage('INFO', 'HIGH', 'ESTADO: BROADCAST ALERTA EMITIDO', [
        { transportId: 'satellite (Broadcast)', status: 'DELIVERED', timestamp: new Date().toISOString() }
    ]);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-purple-500/30">
      <h2 className="text-xl font-bold mb-4 text-slate-900 flex items-center gap-2">
        <span>🎮</span> Simulación Táctica Avanzada
      </h2>
      
      {role === 'coordinator' && (
        <div className="space-y-4">
          <button 
            onClick={emitMassAlert}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition-colors"
          >
            🚨 Emitir Alerta de Estado a Población
          </button>
          <p className="text-sm text-slate-600">Fuerza un 'Safety Check' en los dispositivos ciudadanos. Si no responden, se auto-geolocalizan como 'Atrapados'.</p>
        </div>
      )}

      {role === 'citizen' && (
        <div className="space-y-4">
          <button 
            onClick={() => {
              setIncomingAlert({ text: "ALERTA DEL ESTADO: Confirme su seguridad inmediatamente." });
              setCountdown(10);
            }}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-md shadow-blue-500/20"
          >
            📡 Simular: Recibir Alerta Gubernamental
          </button>
          
          <button 
            onClick={() => dispatchSimulatedMessage('INFO', 'LOW', 'Mensaje Bidireccional (Holanda): "Estamos bien, y vosotros?"', [
              { transportId: 'satellite-leo (Holanda)', status: 'DELIVERED', timestamp: new Date().toISOString() },
              { transportId: 'mesh-local (Zona 0)', status: 'DELIVERED', timestamp: new Date().toISOString() }
            ])}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors shadow-md shadow-purple-500/20"
          >
            🌍 Simular: SMS Bidireccional Extranjero
          </button>

          {incomingAlert && countdown !== null && (
            <div className="mt-4 p-4 bg-red-100 border-2 border-red-500 rounded-lg animate-pulse">
              <h3 className="font-bold text-red-700">{incomingAlert.text}</h3>
              <p className="text-red-600 font-mono text-2xl my-2">Tiempo para responder: {countdown}s</p>
              <button 
                onClick={() => {
                  setCountdown(null);
                  setIncomingAlert(null);
                  dispatchSimulatedMessage('INFO', 'LOW', 'CIUDADANO A SALVO', [
                    { transportId: 'mesh (bluetooth)', status: 'DELIVERED', timestamp: new Date().toISOString() }
                  ]);
                }}
                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold"
              >
                ✅ CONFIRMAR QUE ESTOY A SALVO
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
