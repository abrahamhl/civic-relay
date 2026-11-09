import contextlib
"""Offline tests for the evidence registry, no network or user data."""
import importlib.util
import pathlib
import sqlite3
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_source_db", HERE / "build_source_db.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RegistryTest(unittest.TestCase):
    def test_reproducible_registry_never_grants_permissions(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "evidence.sqlite"
            first = module.create_database(path)
            second = module.create_database(path)
            self.assertEqual(first["sources"], 24)
            self.assertEqual(first["observations"], 0)
            self.assertEqual(second["sources"], first["sources"])
            self.assertEqual(second["permitted_to_ingest"], 0)
            with contextlib.closing(sqlite3.connect(path)) as cx:
                self.assertEqual(cx.execute("SELECT COUNT(*) FROM sources WHERE video_permission=0").fetchone()[0] >= 3, True)
                self.assertEqual(cx.execute("SELECT COUNT(*) FROM observation_batches").fetchone()[0], 0)
                self.assertEqual(cx.execute("SELECT COUNT(*) FROM experiment_runs").fetchone()[0], 0)
                self.assertEqual(cx.execute("SELECT COUNT(*) FROM calibrations").fetchone()[0], 0)
    def test_duplicate_source_is_rejected(self):
        module.validate({"id":"x","owner":"o","region":"r","homepage":"https://x.org","rights":"r",
                         "access":"a","auth":"a","kind":"k","modality":"m","gap":"g",
                         "status":"OFFICIAL_DOCUMENTATION_CHECKED"}, set())
        with self.assertRaises(ValueError):
            ids = {"x"}
            module.validate({"id":"x","owner":"o","region":"r","homepage":"https://x.org","rights":"r",
                         "access":"a","auth":"a","kind":"k","modality":"m","gap":"g",
                         "status":"OFFICIAL_DOCUMENTATION_CHECKED"}, ids)
    def test_orphan_sensor_blocked_by_foreign_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / "evidence.sqlite"
            module.create_database(path)
            with contextlib.closing(sqlite3.connect(path)) as cx:
                cx.execute("PRAGMA foreign_keys=ON")
                with self.assertRaises(sqlite3.IntegrityError):
                    cx.execute("INSERT INTO sensors(sensor_id,source_id,modality) VALUES(?,?,?)",
                               ("invalid-sensor","nonexistent","RGB"))

if __name__=="__main__":
    unittest.main()
