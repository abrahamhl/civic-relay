/** SENDA · Evidence-gated camera-as-environmental-sensor. RESEARCH ONLY.
 *  Input must be genuine calibrated measurements with provenance and time metadata.
 *  None of these functions can autonomously issue an evacuation or emergency alert.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const RAD=Math.PI/180,R=6371.0088;
export function distanceKm(a,b) {
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||
    ![...a,...b].every(finite)||Math.abs(a[0])>90||Math.abs(b[0])>90||
    Math.abs(a[1])>180||Math.abs(b[1])>180)return null;
  const dlat=(b[0]-a[0])*RAD, dlon=(b[1]-a[1])*RAD;
  const q=Math.sin(dlat/2)**2+Math.cos(a[0]*RAD)*Math.cos(b[0]*RAD)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
}
const millis = x => typeof x==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(x)?Date.parse(x):NaN;
/**
 * Time/geo join must be demonstrably the SAME incident. No accidental correlation
 * of historic 2018-2025 satellite fire data with 2026 recorded traffic video.
 * Provider agreement is not inferred. A candidate is not a prediction.
 */
export function evidenceCoincidence(a,b,{maxLagS=180,maxDistanceKm=3,maxUncertaintyS=60}={}) {
  const reasons=[];
  if(!a||!b||!a.sourceId||!b.sourceId||a.sourceId===b.sourceId)
    reasons.push('NOT_INDEPENDENT_OBSERVERS');
  if(!a?.contentSha256||!b?.contentSha256)reasons.push('EVIDENCE_HASH_MISSING');
  if(a?.originType!=='MEASURED'||b?.originType!=='MEASURED')reasons.push('NOT_TWO_MEASURED_SOURCES');
  if(a?.sourceQuality!=='VALIDATED'||b?.sourceQuality!=='VALIDATED')
    reasons.push('SOURCE_MEASUREMENT_NOT_VALIDATED');
  if(a?.rightsApproved!==true||b?.rightsApproved!==true)reasons.push('DATA_REUSE_NOT_APPROVED');
  const at=millis(a?.observedUTC),bt=millis(b?.observedUTC);
  if(!Number.isFinite(at)||!Number.isFinite(bt))reasons.push('MISSING_UTC_TIME');
  const ut=a?.timestampUncertaintyS,vt=b?.timestampUncertaintyS;
  if(!finite(ut)||!finite(vt)||ut<0||vt<0||ut>maxUncertaintyS||vt>maxUncertaintyS)
    reasons.push('TEMPORAL_UNCERTAINTY_TOO_LARGE');
  const delta=Number.isFinite(at)&&Number.isFinite(bt)?Math.abs(at-bt)/1000:null;
  if(delta!=null&&delta>(maxLagS+(finite(ut)?ut:0)+(finite(vt)?vt:0)))
    reasons.push('DIFFERENT_OBSERVATION_EPOCHS');
  const dd=distanceKm(a?.latLon,b?.latLon);
  if(dd==null)reasons.push('NO_GEOLOCATION');
  else if(dd>maxDistanceKm)reasons.push('DIFFERENT_GEOGRAPHIC_AREAS');
  const modalities=[a?.modality,b?.modality];
  if(modalities.every(v=>v==='RGB')) reasons.push('SAME_MODALITY_NO_INDEPENDENT_PHYSICAL_CROSSCHECK');
  return {status:reasons.length?'UNUSABLE_FOR_FUSION':'ALIGNED_RESEARCH_CANDIDATE',
    reasons,deltaSeconds:delta,distanceKm:dd,
    canPublishOperationalPrediction:false};
}
/** Camera visibility through calibrated dark landmark; physically meaningful only
 * with true clear-air reference, same photometric configuration, meter range
 * and propagated uncertainty, not from a detector bounding box.
 *
 * Beer-Lambert: t=C_obs/C_ref; beta=-ln(t)/distance; V_2percent=3.912/beta.
 */
export function landmarkVisibility({contrastNow,contrastClear,distanceM,
   relativeContrastUncertainty,calibrationId,sceneStable,measuredFromRealFrames}={}){
  if(!calibrationId||sceneStable!==true||measuredFromRealFrames!==true||
    !finite(contrastNow)||!finite(contrastClear)||!finite(distanceM)||
    !finite(relativeContrastUncertainty)||distanceM<=0||
    contrastClear<=0||contrastNow<=0||contrastNow>=contrastClear||
    relativeContrastUncertainty<=0||relativeContrastUncertainty>=0.5){
    return {status:'INSUFFICIENT_CALIBRATED_OPTICAL_DATA',visibilityM:null,
      canIssueOfficialAlert:false};
  }
  const t=contrastNow/contrastClear,beta=-Math.log(t)/distanceM;
  const l=Math.max(1e-6,t*(1-relativeContrastUncertainty)),
        h=Math.min(0.999999,t*(1+relativeContrastUncertainty));
  const vis=3.912/beta,
        lower=3.912*distanceM/(-Math.log(l)),
        upper=3.912*distanceM/(-Math.log(h));
  return {status:'LAB_CALIBRATED_ESTIMATE_NEEDS_FIELD_VALIDATION',
    visibilityM:+vis.toFixed(2),intervalM:[+lower.toFixed(2),+upper.toFixed(2)],
    betaPerM:beta,calibrationId,
    limitations:'Assumes homogeneous extinction and stable landmark illumination; cannot distinguish smoke, fog, rain or dust alone.',
    canIssueOfficialAlert:false};
}
/** Stopping-sight engineering comparison; speed must come from an independent
 * calibrated traffic detector or measured homography, never uncalibrated YOLO boxes.
 * Drivers, road friction, curvature and smoke exposure can invalidate simple formula.
 */
export function stoppingSightResearch({visibility,detectorSpeedKmh,sourceTimeAligned,
  reactionS=2.5,decelerationMps2=3.4,roadCalibrationApproved=false}={}){
  if(visibility?.status!=='LAB_CALIBRATED_ESTIMATE_NEEDS_FIELD_VALIDATION' ||
      !finite(detectorSpeedKmh)||detectorSpeedKmh<0||detectorSpeedKmh>150||
      sourceTimeAligned!==true||roadCalibrationApproved!==true||
      !finite(reactionS)||reactionS<0||!finite(decelerationMps2)||decelerationMps2<=0){
    return {status:'INSUFFICIENT_REAL_CORRELATED_MEASUREMENTS',marginM:null,
      canIssueOfficialAlert:false};
  }
  const v=detectorSpeedKmh/3.6,d=v*reactionS+v*v/(2*decelerationMps2);
  return {status:'RESEARCH_ENGINEERING_INDICATOR',
    stoppingDistanceM:+d.toFixed(2),
    marginM:+(visibility.visibilityM-d).toFixed(2),
    conservativeMarginM:+(visibility.intervalM[0]-d).toFixed(2),
    canIssueOfficialAlert:false};
}
