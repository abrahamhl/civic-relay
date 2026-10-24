/** Local, opt-in browser resources. API presence never means a connected sensor. */
export function createBrowserSensors({nav=globalThis.navigator,secure=globalThis.isSecureContext,onChange=()=>{}}={}) {
  const epochs=new Map(),resources=new Map(),states=new Map();
  const publish=(kind,state,extra={})=>{
    const value={kind,state,source:`browser:${kind}`,timestamp:new Date().toISOString(),
      confidence:'API_REPORTED_UNCALIBRATED',unit:null,sample:null,...extra};
    states.set(kind,value);onChange(value);return value;
  };
  const available=kind=>Boolean(secure&&({
    camera:nav?.mediaDevices?.getUserMedia,microphone:nav?.mediaDevices?.getUserMedia,
    geolocation:nav?.geolocation?.getCurrentPosition,bluetooth:nav?.bluetooth?.requestDevice,
    serial:nav?.serial?.requestPort,usb:nav?.usb?.requestDevice,connectivity:nav&&'onLine' in nav
  })[kind]);
  const release=resource=>{
    try{resource?.getTracks?.().forEach(track=>track.stop());}catch{}
    try{resource?.gatt?.disconnect();}catch{}
  };
  const stop=kind=>{
    epochs.set(kind,(epochs.get(kind)||0)+1);
    release(resources.get(kind));resources.delete(kind);
    return publish(kind,available(kind)?'NO_SENSOR':'UNSUPPORTED');
  };
  return {
    capabilities:()=>Object.fromEntries(['camera','microphone','geolocation','bluetooth','serial','usb','connectivity']
      .map(kind=>[kind,available(kind)?'NO_SENSOR':'UNSUPPORTED'])),
    stop,
    stopAll(){for(const kind of new Set([...epochs.keys(),...resources.keys()]))stop(kind);},
    async request(kind,{consent=false}={}) {
      if(consent!==true)return publish(kind,'PERMISSION_REQUIRED');
      if(!available(kind))return publish(kind,'UNSUPPORTED');
      stop(kind);const epoch=epochs.get(kind);
      publish(kind,'PERMISSION_PENDING');
      let resource;
      try {
        if(kind==='camera'||kind==='microphone') {
          resource=await nav.mediaDevices.getUserMedia({video:kind==='camera'?{facingMode:{ideal:'environment'}}:false,audio:kind==='microphone'});
        } else if(kind==='bluetooth') {
          // Chooser restricted to consenting BLE peripherals exposing the standard Battery Service.
          resource=await nav.bluetooth.requestDevice({filters:[{services:['battery_service']}]});
          if(epoch!==epochs.get(kind)){release(resource);return states.get(kind);}
          if(resource.gatt){
            const server=await resource.gatt.connect();
            if(epoch!==epochs.get(kind)){release(resource);return states.get(kind);}
            resources.set(kind,resource);publish(kind,'DEVICE_CONNECTED');
            const service=await server.getPrimaryService('battery_service');
            if(epoch!==epochs.get(kind)){release(resource);return states.get(kind);}
            const characteristic=await service.getCharacteristic('battery_level');
            const value=await characteristic.readValue();
            if(epoch!==epochs.get(kind)){release(resource);return states.get(kind);}
            const batteryPct=value.getUint8(0);
            if(batteryPct>100)throw Error('INVALID_BATTERY_SAMPLE');
            resource.addEventListener?.('gattserverdisconnected',()=>{
              if(epoch===epochs.get(kind)){resources.delete(kind);publish(kind,'NO_SENSOR');}
            },{once:true});
            return publish(kind,'LIVE_MEASUREMENT',{unit:'%',sample:{batteryPct},
              source:'BLE:standard_battery_service',reason:'Peripheral-reported battery only; no RSSI, CSI or RF spectrum.'});
          }
        } else if(kind==='serial') {
          resource=await nav.serial.requestPort(); // Permission only; do not open an unknown firmware protocol.
        } else if(kind==='usb') {
          return publish(kind,'HARDWARE_REQUIRED',{reason:'A documented device descriptor and driver are required; no generic USB scan.'});
        } else if(kind==='geolocation') {
          resource=await new Promise((resolve,reject)=>nav.geolocation.getCurrentPosition(resolve,reject,
            {enableHighAccuracy:false,timeout:10000,maximumAge:0}));
        } else if(kind==='connectivity') {
          const connection=nav.connection;
          if(epoch!==epochs.get(kind))return states.get(kind);
          return publish(kind,'LIVE_MEASUREMENT',{unit:'browser connection estimate',sample:{
            onlineHint:nav.onLine,effectiveType:connection?.effectiveType??'UNKNOWN',
            downlinkMbps:Number.isFinite(connection?.downlink)?connection.downlink:null,
            rttMs:Number.isFinite(connection?.rtt)?connection.rtt:null},
            reason:'Browser estimates; online hint does not prove Internet access, radio type, RSSI or packet delivery.'});
        }
        if(epoch!==epochs.get(kind)){release(resource);return states.get(kind);}
        if(kind==='geolocation') {
          return publish(kind,'LIVE_MEASUREMENT',{unit:'degrees / metres',sample:{
            latitude:resource.coords.latitude,longitude:resource.coords.longitude,
            accuracyMeters:resource.coords.accuracy},timestamp:new Date(resource.timestamp).toISOString(),
            reason:'Local display only; not stored or transmitted.'});
        }
        resources.set(kind,resource);
        return publish(kind,kind==='camera'||kind==='microphone'?'DEVICE_CONNECTED':'PERMISSION_GRANTED',{
          reason:kind==='bluetooth'||kind==='serial'?'Device selected; no protocol measurement, CSI or RSSI.':
            'Media stream connected. Camera and microphone do not measure RF.',resource});
      } catch(error) {
        release(resource);
        if(epoch!==epochs.get(kind))return states.get(kind);
        return publish(kind,error?.name==='NotAllowedError'?'PERMISSION_DENIED':error?.name==='NotFoundError'?'NO_SENSOR':'UNAVAILABLE',
          {reason:error?.name||'RESOURCE_ERROR'});
      }
    }
  };
}

/** Fixture-tested contract for an OPTIONAL documented lab bridge. No hardware driver is claimed.
 * Raw dBFS spectra cannot be relabelled dBm without independent calibration.
 */
export function validateRfSample(input,{fixture=false}={}) {
  if(!input||input.protocol!=='OEP-LAB-SPECTRUM-v1'||typeof input.source!=='string'||
    !/^[A-Za-z0-9_.:-]{1,80}$/.test(input.source)||!Number.isSafeInteger(input.timestampMs)||
    input.timestampMs<0||input.timestampMs>8640000000000000||!['dBFS','dBm'].includes(input.unit)||
    !Array.isArray(input.frequencyHz)||!Array.isArray(input.power)||input.power.length<1||
    input.power.length>4096||input.frequencyHz.length!==input.power.length)
    throw Error('Invalid RF sample contract');
  if(input.unit==='dBm'&&!(typeof input.calibrationId==='string'&&input.calibrationId.length>0&&input.calibrationId.length<=80))
    throw Error('Calibrated power requires calibration provenance');
  for(let i=0;i<input.power.length;i++)if(!Number.isFinite(input.frequencyHz[i])||input.frequencyHz[i]<=0||
    (i&&input.frequencyHz[i]<=input.frequencyHz[i-1])||!Number.isFinite(input.power[i])||
    input.power[i]<-300||input.power[i]>100)throw Error('Invalid RF frequency or power');
  return {source:input.source,unit:input.unit,timestamp:new Date(input.timestampMs).toISOString(),
    state:fixture?'DEMO_ONLY':'IMPLEMENTED_UNVERIFIED',confidence:fixture?'FIXTURE':'UNVERIFIED_DEVICE_REPORT',
    evidence:fixture?'SIMULATED':'IMPLEMENTED_UNVERIFIED',
    frequencyHz:[...input.frequencyHz],power:[...input.power],calibrationId:input.calibrationId??null};
}
