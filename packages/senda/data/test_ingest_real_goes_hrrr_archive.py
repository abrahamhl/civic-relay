"""Actual archived NOAA-derived files from repo only. No synthetic weather/fire rows."""
import pathlib,sqlite3,tempfile,unittest
from ingest_real_goes_hrrr_archive import ingest_archived_real_goes_hrrr

class RealNoaaArchiveTest(unittest.TestCase):
 def test_real_noaa_historical_rows_import_without_false_calibration(self):
  with tempfile.TemporaryDirectory() as d:
   db=pathlib.Path(d)/"evidence.sqlite"
   first=ingest_archived_real_goes_hrrr(db)
   self.assertEqual(first["cases"],7)
   self.assertEqual(first["goes_pixel_observations"],13116)
   self.assertEqual(first["hrrr_forecast_values"],535)
   self.assertEqual(first["operational_fusion_authorizations"],0)
   self.assertEqual(first["total_research_observations"],13651)
   self.assertFalse(first["goes_mask_and_dqf_preserved"])
   self.assertFalse(first["hrrr_forecast_issue_time_known"])
   second=ingest_archived_real_goes_hrrr(db)
   self.assertEqual(second["goes_pixel_observations"],0)
   self.assertEqual(second["hrrr_forecast_values"],0)
   self.assertEqual(second["total_research_observations"],13651)
   with sqlite3.connect(db) as cx:
    self.assertEqual(cx.execute("select count(*) from observation_batches where origin_type='MEASURED'").fetchone()[0],7)
    self.assertEqual(cx.execute("select count(*) from observation_batches where origin_type='FORECAST'").fetchone()[0],7)
    self.assertEqual(cx.execute("select count(*) from observations where allow_model_fusion=1").fetchone()[0],0)
    self.assertEqual(cx.execute("select count(*) from observations where source_quality_code='REAL_SATELLITE_PIXEL_MASK_LOST_NO_CALIBRATION'").fetchone()[0],13116)

if __name__=='__main__':unittest.main()
