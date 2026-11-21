/** Policy boundaries for research. No device API or signature verifier is implemented here.
 * Never run authority verification from an untrusted browser or with a caller-set boolean.
 */
export const CAPABILITY_STATES=Object.freeze(['AVAILABLE','DISABLED','PERMISSION_REQUIRED','UNSUPPORTED','RESTRICTED']);
export function capabilityState({supported=true,restricted=false,enabled=false,permission=false}={}){
 if(!supported)return 'UNSUPPORTED';
 if(restricted)return 'RESTRICTED';
 if(!enabled)return 'DISABLED';
 return permission?'AVAILABLE':'PERMISSION_REQUIRED';
}
export const SAFETY_RESPONSES=Object.freeze(['SAFE','SOS_EXPLICIT','OTHERS_AFFECTED','CANNOT_DETERMINE']);
export function recordSafetyResponse({response,now=Date.now(),retentionSeconds=3600,shareLocation=false,location=null,consented=false}){
 if(!consented)throw new Error('Explicit consent required');
 if(!SAFETY_RESPONSES.includes(response))throw new Error('Only explicit human responses accepted');
 if(!Number.isSafeInteger(retentionSeconds)||retentionSeconds<=0||retentionSeconds>86400)
   throw new Error('Invalid retention TTL');
 return {response,recordedAt:new Date(now).toISOString(),expiresAt:new Date(now+retentionSeconds*1000).toISOString(),
   location:shareLocation?location:null,locationShared:shareLocation,revoked:false};
}
export function revokeSafetyRecord(record){
 return {...record,response:'UNKNOWN',location:null,locationShared:false,revoked:true};
}
export function expireSafetyRecord(record,now=Date.now()){
 return now>=Date.parse(record.expiresAt)?revokeSafetyRecord(record):record;
}
export function energyPolicy(battery,alertActive){
 if(!Number.isFinite(battery)||battery<0||battery>100)throw new Error('Invalid battery');
 const profile=battery<=15?'CRITICAL':battery<=35?'CONSERVATION':alertActive?'ALERT':'NORMAL';
 // Proposed configuration knobs, NOT real measured power draws.
 const suggestions={
  NORMAL:{discoverySeconds:8,discoveryIntervalSeconds:60,retrySeconds:60,relay:true},
  ALERT:{discoverySeconds:8,discoveryIntervalSeconds:20,retrySeconds:25,relay:true},
  CONSERVATION:{discoverySeconds:4,discoveryIntervalSeconds:120,retrySeconds:90,relay:true},
  CRITICAL:{discoverySeconds:2,discoveryIntervalSeconds:300,retrySeconds:180,relay:false}
 };
 return {profile,...suggestions[profile],systemBatterySaverChanged:false,measurements:'NOT_MEASURED'};
}
/** Only an externally authenticated server-side verifier may promote a CAP message.
 * Exercise, Test, Draft and unauthenticated alerts can NEVER be treated as official.
 * CAP 1.2 XML parsing, canonicalisation and signature checking belong to the verifier adapter.
 */
export async function acceptAuthorizedCapAlert(alert,verifyIssuer,{now=Date.now()}={}){
 if(typeof verifyIssuer!=='function')throw new Error('External trusted issuer verifier required');
 if(!alert||alert.status!=='Actual'||alert.scope!=='Public')throw new Error('Non-actual CAP alert');
 if(!['Alert','Update','Cancel'].includes(alert.msgType))throw new Error('Unsupported CAP message type');
 for(const field of ['identifier','sender','sent']){
  if(typeof alert[field]!=='string'||!alert[field])throw new Error('Missing CAP '+field);
 }
 if(!Number.isSafeInteger(now)||now<0)throw new Error('Invalid verification clock');
 if(!Number.isFinite(Date.parse(alert.sent)))throw new Error('Invalid CAP sent timestamp');
 if(!Array.isArray(alert.polygons)||alert.polygons.length===0||alert.polygons.length>50||
    !alert.polygons.every(poly=>Array.isArray(poly)&&poly.length>=3&&poly.length<=500&&
      poly.every(point=>Array.isArray(point)&&point.length===2&&
        typeof point[0]==='number'&&typeof point[1]==='number'&&
        Number.isFinite(point[0])&&Number.isFinite(point[1])&&
        point[0]>=-90&&point[0]<=90&&point[1]>=-180&&point[1]<=180)))
   throw new Error('Invalid CAP polygon geometry');
 if(!alert.expires||!Number.isFinite(Date.parse(alert.expires)))throw new Error('Missing or invalid CAP expiry');
 if(alert.expires&&Date.parse(alert.expires)<=now)throw new Error('Expired CAP alert');
 if(Date.parse(alert.sent)>now+60000)throw new Error('Future alert rejected');
 if(Date.parse(alert.expires)<=Date.parse(alert.sent))throw new Error('CAP expiry must follow issue timestamp');
 if((alert.msgType==='Update'||alert.msgType==='Cancel')&&
    (typeof alert.references!=='string'||!alert.references.trim()))
   throw new Error('Update/Cancel requires an authentic referenced prior alert');
 const proof=await verifyIssuer(alert);
 if(!proof||proof.authenticated!==true||typeof proof.trustAnchorId!=='string'||!proof.trustAnchorId)
   throw new Error('Untrusted issuer; institutional actions prohibited');
 return {id:alert.identifier,source:alert.sender,createdAt:alert.sent,expiresAt:alert.expires||null,
   polygons:alert.polygons,type:alert.event||'UNSPECIFIED',severity:alert.severity||'Unknown',
   certainty:alert.certainty||'Unknown',action:alert.msgType==='Cancel'?'CANCEL':alert.msgType==='Update'?'UPDATE':'ACTIVATE',
   provenance:'TRUSTED_VERIFIER_ASSERTION',trustAnchorId:proof.trustAnchorId,
   permissionPolicy:'EXPLICIT_OPT_IN',verifiedAt:new Date(now).toISOString()};
}
