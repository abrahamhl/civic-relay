"""Prueba del conversor con un parquet SINTÉTICO (las columnas reales de VZCrash no se han podido ver)."""
import json, os, subprocess, sys, tempfile, unittest
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))


class TestConvert(unittest.TestCase):
    def test_roundtrip_units_split_and_missing_columns(self):
        rows = []
        for ev, lab in (("a", 1), ("b", 0), ("c", 1)):
            for i in range(50):
                rows.append({"ev": ev, "ts": i * 10, "y": lab, "ax": 0.0, "ay": 0.0, "az": 1.0, "gx": 0.0, "gy": 0.0, "gz": 30.0, "kmh": 90.0 if i % 10 == 0 else float("nan")})
        with tempfile.TemporaryDirectory() as d:
            p, out = os.path.join(d, "s.parquet"), os.path.join(d, "o.jsonl")
            pd.DataFrame(rows).to_parquet(p)
            cmd = [sys.executable, os.path.join(HERE, "vzcrash_to_jsonl.py"), p, out, "--event-col", "ev", "--time-col", "ts", "--label-col", "y",
                   "--acc-cols", "ax", "ay", "az", "--gyro-cols", "gx", "gy", "gz", "--speed-col", "kmh", "--test-fraction", "0.34", "--time-unit", "ms"]
            subprocess.run(cmd, check=True, capture_output=True)
            tr = [json.loads(l) for l in open(out)]
            self.assertEqual(len(tr), 3)
            self.assertAlmostEqual(tr[0]["imu"][0]["z"], 9.80665); self.assertAlmostEqual(tr[0]["speed"][0]["ms"], 25.0)
            self.assertAlmostEqual(tr[0]["imu"][1]["t"], 0.01); self.assertEqual(len(tr[0]["speed"]), 5)
            self.assertTrue(all(t["split"] in ("train", "test") for t in tr))
            bad = subprocess.run(cmd[:4] + ["--event-col", "NOPE"] + cmd[6:], capture_output=True, text=True)
            self.assertNotEqual(bad.returncode, 0); self.assertIn("no existen", bad.stderr)


if __name__ == "__main__":
    unittest.main()
