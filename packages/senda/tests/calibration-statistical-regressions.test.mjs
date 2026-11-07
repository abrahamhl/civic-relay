import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCalibrationRows, evaluateHeldOutCalibration } from '../src/calibration-gates.mjs';
const registry = JSON.parse(readFileSync(new URL('../calibration/sources.v1.json', import.meta.url), 'utf8'));
function rows() {
  const result=[];
  for(let c=0;c<4;c++) for(let i=0;i<(c===0?4:10);i++) {
    const p=30+i+c;
    result.push({
      id:`synthetic-${c}-${i}`,engine:'traffic-speed-flow',case_id:`event-${c}`,
      site_id:c===0?'shared-site':'site-'+c,model_version:'frozen-1',kind:'REGRESSION',
      fold:c===0?'TRAIN':'TEST',unit:'km/h',feature_source_id:'digitraffic-weathercam',
      truth_source_id:'digitraffic-tms',raw_sha256:'sha256:'+'a'.repeat(64),
      prediction:p,truth:p,predicted_at_utc:'2026-11-01T00:10:00Z',
      feature_available_at_utc:'2026-11-01T00:05:00Z',
      truth_observed_at_utc:'2026-11-01T00:20:00Z',
      truth_available_at_utc:'2026-11-01T00:30:00Z',
      rights_verified:true,access_authorized:true,quality_masks_preserved:true,
      units_checked:true,spatial_alignment_checked:true,
      independent_truth_verified:true,privacy_review_passed:true,
      lower:p-2,upper:p+2
    });
  }
  return result;
}
test('synthetic: same physical site across folds blocks score despite different case IDs',()=>{
  const data=rows();
  data[4].site_id='shared-site';
  assert.ok(validateCalibrationRows(data,registry).errors.some(e=>e.includes('SITE_LEAKAGE_ACROSS_FOLDS')));
  assert.equal(evaluateHeldOutCalibration(data,registry).status,'BLOCKED');
});
test('synthetic: interval availability is reported over all held-out predictions',()=>{
  const data=rows();
  for(let i=5;i<data.length;i++) {delete data[i].lower;delete data[i].upper;}
  const evaluation=evaluateHeldOutCalibration(data,registry);
  assert.equal(evaluation.status,'HELD_OUT_RESEARCH_EVALUATION_ONLY');
  const m=evaluation.metrics['traffic-speed-flow/REGRESSION'];
  assert.equal(m.intervalCount,1);
  assert.equal(m.intervalAvailability,1/30);
  assert.equal(m.intervalCoverage,1);
  assert.equal(m.intervalCoverageUnconditional,1/30);
});
