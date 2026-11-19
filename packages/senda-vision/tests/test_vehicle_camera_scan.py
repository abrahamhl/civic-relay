"""Pruebas de vehicle_camera_scan.py sin modelo: detector simulado y vídeos sintéticos (ningún dato real)."""
import json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import vehicle_camera_scan as vcs

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = vcs.load_config(os.path.join(HERE, "example_scan_config.json"))
W, H = 1280, 720


def frames_with(box_fn, n=6, dt=0.5):
    return [(i * dt, box_fn(i)) for i in range(n)]


class TestConfigAndPrivacy(unittest.TestCase):
    def test_undeclared_thresholds_rejected(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"egoLane": []}, f)
        with self.assertRaisesRegex(ValueError, "deben declararse"):
            vcs.load_config(f.name)

    def test_pseudonym_never_contains_label(self):
        p = vcs.device_pseudonym("Coche de Juan 1234ABC")
        self.assertTrue(p.startswith("dev-")); self.assertNotIn("1234", p); self.assertEqual(p, vcs.device_pseudonym("Coche de Juan 1234ABC"))

    def test_event_has_no_image_or_plate_fields(self):
        e = vcs.make_event("VEHICLE_ACROSS_LANE", 1000.0, 50.6, 5.57, "dev-x", 0.7, "h", "yolox_s.onnx", False, "video:a.mp4")
        self.assertEqual(e["schema"], "senda-camera-event/1"); self.assertFalse(e["consent"]["share"]); self.assertFalse(e["heuristic"]["validated"])
        self.assertTrue(set(e).isdisjoint({"image", "frame", "plate", "face", "vin"}))


class TestHeuristics(unittest.TestCase):
    def test_wide_box_in_ego_lane_is_vehicle_across(self):
        # caja ancha (vehículo de lado) centrada en el carril propio, cerca
        out = vcs.analyze_detections(frames_with(lambda i: [(470, 480, 810, 620, 2, 0.8)]), CFG, W, H)
        self.assertEqual(out[0][0], "VEHICLE_ACROSS_LANE"); self.assertEqual(out[0][3], "caja-ancha-en-carril-propio")

    def test_normal_rear_view_is_not_across(self):
        out = vcs.analyze_detections(frames_with(lambda i: [(580, 480, 700, 580, 2, 0.8)]), CFG, W, H)
        self.assertNotIn("VEHICLE_ACROSS_LANE", [o[0] for o in out])

    def test_fast_growing_box_is_stopped_vehicle(self):
        # Acercamiento SINTÉTICO a un coche parado: Z = 34 − 15·t m, altura aparente h = f·1,45/Z (f = 1000 px).
        # Nota: el TTC por diferencia hacia atrás va ~1 fotograma por detrás del real (propiedad documentada).
        def box(i):
            z = 34 - 15 * (i * 0.5); h = 1000 * 1.45 / z; w = 1.2 * h
            return [(640 - w / 2, 500 - h / 2, 640 + w / 2, 500 + h / 2, 2, 0.8)]
        out = vcs.analyze_detections(frames_with(box, n=5), CFG, W, H)
        self.assertIn("STOPPED_VEHICLE_IN_LANE", [o[0] for o in out])
        # Coche delante a distancia constante: la caja no crece ⇒ no hay aviso.
        out = vcs.analyze_detections(frames_with(lambda i: [(600, 470, 680, 540, 2, 0.8)]), CFG, W, H)
        self.assertNotIn("STOPPED_VEHICLE_IN_LANE", [o[0] for o in out])

    def test_person_on_road_detected_without_identity(self):
        out = vcs.analyze_detections(frames_with(lambda i: [(620, 500, 650, 600, 0, 0.6)]), CFG, W, H)
        self.assertEqual([o[0] for o in out], ["PERSON_ON_ROADWAY"])

    def test_short_glitch_does_not_fire(self):
        out = vcs.analyze_detections([(0, [(470, 480, 810, 620, 2, 0.8)]), (0.5, []), (1.0, [(470, 480, 810, 620, 2, 0.8)])], CFG, W, H)
        self.assertEqual(out, [])


class TestTeslaCam(unittest.TestCase):
    def _make_tree(self, root, with_pos=True):
        import cv2, numpy as np
        d = os.path.join(root, "SavedClips", "2026-11-01_10-00-00"); os.makedirs(d)
        vw = cv2.VideoWriter(os.path.join(d, "2026-11-01_09-59-00-front.mp4"), cv2.VideoWriter_fourcc(*"mp4v"), 10, (W, H))
        for _ in range(30):
            vw.write(np.full((H, W, 3), 90, np.uint8))
        vw.release()
        open(os.path.join(d, "2026-11-01_09-59-00-back.mp4"), "wb").close()
        ev = {"timestamp": "2026-11-01T10:00:00", "reason": "user_interaction_dashcam_icon_tapped"}
        if with_pos:
            ev.update({"est_lat": "50.6", "est_lon": "5.57"})
        json.dump(ev, open(os.path.join(d, "event.json"), "w"))

    def test_find_clips_and_defensive_event_json(self):
        with tempfile.TemporaryDirectory() as root:
            self._make_tree(root)
            clips = vcs.find_teslacam_clips(root)
            self.assertEqual(len(clips), 1); self.assertEqual(len(clips[0]["front"]), 1)
            self.assertEqual((clips[0]["event"]["lat"], clips[0]["event"]["lon"]), (50.6, 5.57))

    def test_scan_with_fake_detector_emits_events_and_requires_timezone(self):
        fake = lambda img, conf, classes: (__import__("numpy").array([[470, 480, 810, 620]], "float32"), __import__("numpy").array([0.8], "float32"), __import__("numpy").array([2]))
        with tempfile.TemporaryDirectory() as root:
            self._make_tree(root)
            ev, skipped = vcs.scan_teslacam(root, fake, CFG, "dev-x", True, "yolox_s.onnx", utc_offset_min=None)
            self.assertEqual(ev, []); self.assertIn("zona horaria", skipped[0]["why"])
            ev, skipped = vcs.scan_teslacam(root, fake, CFG, "dev-x", True, "yolox_s.onnx", utc_offset_min=60)
            self.assertEqual(skipped, []); self.assertEqual(ev[0]["anomaly"], "VEHICLE_ACROSS_LANE"); self.assertEqual(ev[0]["source"], "TESLACAM_USB")
            import calendar
            self.assertEqual(ev[0]["at"], calendar.timegm((2026, 11, 1, 9, 0, 0, 0, 0, 0)))  # 10:00 hora local (UTC+1) = 09:00 UTC

    def test_no_position_no_event(self):
        fake = lambda img, conf, classes: (__import__("numpy").zeros((0, 4), "float32"), __import__("numpy").zeros(0, "float32"), __import__("numpy").zeros(0, int))
        with tempfile.TemporaryDirectory() as root:
            self._make_tree(root, with_pos=False)
            ev, skipped = vcs.scan_teslacam(root, fake, CFG, "dev-x", True, "m", utc_offset_min=60)
            self.assertEqual(ev, []); self.assertIn("sin posición", skipped[0]["why"])


if __name__ == "__main__":
    unittest.main()
