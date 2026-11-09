"""Contract tests only; fixture is synthetic and NEVER an actual USGS observation."""
import copy
import unittest
from fetch_real_usgs_comcat import normalize_catalog

SYNTHETIC = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "id": "synthetic-event-id-0001",
        "geometry": {"type": "Point", "coordinates": [-118.0, 34.0, 12.0]},
        "properties": {
            "mag": 6.2, "magType": "mw", "status": "reviewed",
            "time": 1791115200000, "updated": 1791118800000
        }
    }]
}

class CatalogContractTest(unittest.TestCase):
    def test_fails_closed_but_captures_historical_event_schema(self):
        data = normalize_catalog(SYNTHETIC, "2026-10-01", "2026-11-01", 6.0, "2026-11-07T14:00:00Z")
        self.assertEqual(data["count"], 1)
        self.assertFalse(data["operational_safety_clearance"])
        self.assertFalse(data["calibrates_mobile_mem_sensors"])
        self.assertIn("SNAPSHOT_RETRIEVED", data["availability_assumption"])
        self.assertEqual(data["records"][0]["label_type"], "RETROSPECTIVE_CATALOG_LABEL_NOT_SENSOR_TRUTH")
    def test_rejects_improper_geometry_and_duplicate_ids(self):
        x=copy.deepcopy(SYNTHETIC)
        x["features"][0]["geometry"]["coordinates"][1]=200
        with self.assertRaises(ValueError): normalize_catalog(x,"2026-10-01","2026-11-01",6.0,"2026-11-07T14:00:00Z")
        x=copy.deepcopy(SYNTHETIC)
        x["features"].append(copy.deepcopy(x["features"][0]))
        with self.assertRaises(ValueError): normalize_catalog(x,"2026-10-01","2026-11-01",6.0,"2026-11-07T14:00:00Z")
    def test_rejects_outside_window_and_fake_magnitudes(self):
        x=copy.deepcopy(SYNTHETIC)
        x["features"][0]["properties"]["mag"]=4.5
        with self.assertRaises(ValueError): normalize_catalog(x,"2026-10-01","2026-11-01",6.0,"2026-11-07T14:00:00Z")
        x=copy.deepcopy(SYNTHETIC)
        with self.assertRaises(ValueError): normalize_catalog(x,"2026-09-01","2026-10-01",6.0,"2026-11-07T14:00:00Z")
    def test_rejects_unverifiable_revision_time(self):
        x=copy.deepcopy(SYNTHETIC)
        x["features"][0]["properties"]["updated"]=None
        with self.assertRaises(ValueError): normalize_catalog(x,"2026-10-01","2026-11-01",6.0,"2026-11-07T14:00:00Z")

if __name__ == "__main__":
    unittest.main()
