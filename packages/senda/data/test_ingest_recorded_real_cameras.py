"""Only real archived footage summaries from the repository. No synthetic observations."""
import pathlib
import sqlite3
import tempfile
import unittest
from ingest_recorded_real_cameras import store_recorded, capture_time

class RecordedCameraTest(unittest.TestCase):
    def test_original_recordings_imported_without_permissions_or_historic_fire_join(self):
        with tempfile.TemporaryDirectory() as directory:
            db=pathlib.Path(directory)/"senda.sqlite"
            first=store_recorded(db)
            self.assertEqual(first["current_total_sources"],24)
            self.assertEqual(first["sources_with_real_recorded_clips"],2)
            self.assertEqual(first["sensors_from_original_recordings"],25)
            self.assertEqual(first["videos_with_detector_measurements"],19)
            self.assertEqual(first["observations_inserted"],57)
            self.assertEqual(first["current_total_observations"],57)
            self.assertEqual(first["historical_co_temporal_fire_camera_matches"],0)
            self.assertEqual(first["operational_fusion_authorizations"],0)
            second=store_recorded(db)
            self.assertEqual(second["observations_inserted"],0)
            self.assertEqual(second["current_total_observations"],57)
            with sqlite3.connect(db) as cx:
                self.assertEqual(cx.execute("SELECT count(*) FROM observation_batches").fetchone()[0],2)
                self.assertEqual(cx.execute("SELECT count(*) FROM sensors WHERE operational_permission=1").fetchone()[0],0)
                self.assertEqual(cx.execute("SELECT count(*) FROM observations WHERE calibration_id IS NOT NULL").fetchone()[0],0)
                self.assertEqual(cx.execute("SELECT count(*) FROM observations WHERE source_quality_code='REAL_VIDEO_MODEL_DERIVED_UNVERIFIED'").fetchone()[0],57)
                self.assertEqual(cx.execute("SELECT count(*) FROM observations WHERE allow_model_fusion=1").fetchone()[0],0)
                self.assertEqual(cx.execute("SELECT COUNT(DISTINCT content_sha256) FROM observation_batches").fetchone()[0],2)
    def test_caltrans_november_timezone_is_pst_not_pdt(self):
        d=capture_time("caltrans_cctv",{"capturaPST":"2026-11-05T17:15"})
        self.assertEqual(d.isoformat(),"2026-11-06T01:15:00+00:00")
    def test_time_must_be_explicit(self):
        with self.assertRaises(ValueError):
            capture_time("tfl_jamcams",{"capturaUTC":"2026-11-06T00:31:00"})

if __name__=="__main__":
    unittest.main()
