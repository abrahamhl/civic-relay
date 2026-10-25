/** Pure policy contracts. Inputs must come from trusted adapters in production.
 * No radio, satellite service, CAP verification, E2EE or durable storage is implemented here.
 */
export const MESSAGE_TYPES = Object.freeze(['PERSONAL','HUMAN_STATUS','SENSOR_OBSERVATION','RISK_ADVISORY','OFFICIAL_ALERT','OPERATIONAL_ORDER']);
export const ACK_LEVELS = Object.freeze(['HOP_ACK','GATEWAY_ACK','DESTINATION_ACK','READ']);
const finiteTime = value => Number.isSafeInteger(value) && value >= 0;
const fresh = (value,now) => value && finiteTime(value.observedAt) && finiteTime(value.expiresAt) && value.observedAt <= now && now < value.expiresAt;

export function assessTransport(capability,now) {
  if (!finiteTime(now) || !fresh(capability,now)) return {available:false,reason:'STALE_OR_INVALID'};
  if (capability.consent !== true || capability.authorized !== true) return {available:false,reason:'NO_PERMISSION'};
  if (capability.hardwareCompatible !== true) return {available:false,reason:'HARDWARE_REQUIRED'};
  if (capability.evidence !== 'MEASURED' || capability.linkActive !== true) return {available:false,reason:'NO_MEASURED_LINK'};
  return {available:true,reason:'LINK_OBSERVED_NOT_DELIVERY'};
}

export function assessSatelliteOpportunity(opportunity,now) {
  const no = reason => ({status:'NOT_AVAILABLE',reason,deliveryGuaranteed:false});
  if (!finiteTime(now) || !fresh(opportunity,now)) return no('STALE_ORBIT_DATA');
  if (!['LEO','GEO'].includes(opportunity.orbit) || !['TLE','OMM'].includes(opportunity.format) ||
      opportunity.propagator !== 'SGP4' || !opportunity.source ||
      !Number.isFinite(opportunity.elevationDeg) || opportunity.elevationDeg < 0 || opportunity.elevationDeg > 90) return no('INVALID_GEOMETRY');
  if (!Number.isFinite(opportunity.uncertaintySeconds) || opportunity.uncertaintySeconds < 0) return no('UNCERTAINTY_REQUIRED');
  if (opportunity.hardwareCompatible !== true || opportunity.authorized !== true || opportunity.serviceCompatible !== true) {
    return {status:'GEOMETRY_ONLY',reason:'SERVICE_NOT_ESTABLISHED',deliveryGuaranteed:false};
  }
  return {status:'SERVICE_CANDIDATE',reason:'LINK_AND_ENDPOINT_ACK_STILL_REQUIRED',deliveryGuaranteed:false};
}

export function classifySituation(signal,now) {
  const reject = reason => ({accepted:false,kind:'UNKNOWN',reason,canIssueOrder:false});
  if (!finiteTime(now) || !fresh(signal,now) || typeof signal.source !== 'string' || !signal.source.trim()) return reject('STALE_OR_UNSOURCED');
  if (signal.permission !== 'AUTHORIZED') return reject('NO_PERMISSION');
  if (!['OBSERVATION','FORECAST','MODEL_RISK','OFFICIAL_WARNING','COMMUNITY_REPORT'].includes(signal.kind)) return reject('INVALID_KIND');
  if (signal.kind === 'OFFICIAL_WARNING' && signal.authorityVerdict !== 'VERIFIED_TRUST_ANCHOR') return reject('UNVERIFIED_AUTHORITY');
  return {accepted:true,kind:signal.kind,reason:'SOURCE_CLASSIFICATION_PRESERVED',canIssueOrder:false};
}

export function authorizeMessage(type,context,now) {
  if (!MESSAGE_TYPES.includes(type) || !finiteTime(now) || context?.consent !== true) return false;
  if (!['OFFICIAL_ALERT','OPERATIONAL_ORDER'].includes(type)) return true;
  return fresh(context,now) && context.authorityVerdict === 'VERIFIED_TRUST_ANCHOR' &&
    context.revoked === false && Array.isArray(context.scopes) && context.scopes.includes(type);
}

/** A trusted verifier must bind every receipt to message, recipient and receipt type.
 * This reducer does not authenticate raw packets: it consumes verifier results.
 */
export function reduceDelivery({message,receipts=[],routes=[],now,consent=true}) {
  if (!message || !finiteTime(now) || !finiteTime(message.createdAt) || !finiteTime(message.expiresAt) ||
      message.createdAt > now || message.expiresAt <= message.createdAt ||
      typeof message.id !== 'string' || !message.id || typeof message.recipient !== 'string' || !message.recipient) {
    return {status:'UNKNOWN',delivered:false,reason:'INVALID_MESSAGE',custody:[]};
  }
  if (consent !== true) return {status:'REVOKED',delivered:false,reason:'LOCAL_CONSENT_REVOKED_EXTERNAL_COPIES_UNKNOWN',custody:[]};
  const accepted = Array.isArray(receipts) ? receipts.filter(r => r && r.verification === 'VERIFIED' &&
    r.messageId === message.id && r.recipient === message.recipient && ACK_LEVELS.includes(r.level) &&
    typeof r.signer === 'string' && r.signer.length > 0 && finiteTime(r.at) &&
    r.at >= message.createdAt && r.at < message.expiresAt && r.at <= now) : [];
  const endpoint = accepted.filter(r => r.signer === message.recipient);
  const destination = endpoint.find(r=>r.level==='DESTINATION_ACK');
  const read = destination && endpoint.find(r=>r.level==='READ' && r.at >= destination.at);
  const custody = [...new Set(accepted.filter(r=>['HOP_ACK','GATEWAY_ACK'].includes(r.level)).map(r=>r.level))];
  // A valid delivery made before expiry remains a historical fact after TTL.
  if (destination) return {status:read?'READ':'DESTINATION_ACK',delivered:true,reason:'VERIFIED_ENDPOINT_RECEIPT',custody};
  if (now >= message.expiresAt) return {status:'EXPIRED',delivered:false,reason:'TTL_ELAPSED',custody};
  const hasRoute = Array.isArray(routes) && routes.some(r=>assessTransport(r,now).available);
  return {status:hasRoute?'PENDING':'NO_ROUTE',delivered:false,reason:hasRoute?'WAITING_FOR_ENDPOINT_ACK':'NO_COMPATIBLE_AUTHORIZED_LINK',custody};
}

export function summarizeOccupancy({confirmedPeople,wifiCount,registeredCapacity}={}) {
  // RF observations and cadastral capacity never establish human presence.
  return {status:Number.isSafeInteger(confirmedPeople)&&confirmedPeople>=0?'CONFIRMED':'UNKNOWN',
    people:Number.isSafeInteger(confirmedPeople)&&confirmedPeople>=0?confirmedPeople:null};
}

export function simulateFamilyDelivery(stage='NO_ROUTE') {
  const message={id:'S01-FIXTURE',recipient:'ismael-fixture-key',createdAt:1000,expiresAt:9000};
  const receipt = (level,signer='gateway-fixture-key',at=3000) => ({level,signer,at,messageId:message.id,recipient:message.recipient,verification:'VERIFIED'});
  const routes=stage==='NO_ROUTE'?[]:[{observedAt:1000,expiresAt:9000,consent:true,authorized:true,hardwareCompatible:true,evidence:'MEASURED',linkActive:true}];
  const receipts=stage==='NO_ROUTE'?[]:[receipt('GATEWAY_ACK')];
  if (['DESTINATION_ACK','READ'].includes(stage)) receipts.push(receipt('DESTINATION_ACK',message.recipient,4000));
  if (stage==='READ') receipts.push(receipt('READ',message.recipient,4500));
  return {kind:'SYNTHETIC_SCENARIO',physicalDelivery:false,encryptionImplemented:false,durableCustodyImplemented:false,
    ...reduceDelivery({message,routes,receipts,now:stage==='EXPIRED'?10000:5000})};
}
