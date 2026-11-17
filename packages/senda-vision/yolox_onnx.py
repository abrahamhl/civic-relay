"""SENDA · Detector YOLOX (Apache 2.0) en ONNX Runtime, sin PyTorch.

Pre y posproceso según la demo oficial de YOLOX (Megvii, Apache 2.0): relleno 114, sin normalizar,
rejillas con pasos 8/16/32, cajas cx,cy,w,h → x1,y1,x2,y2 y puntuación = objeto × clase.
Solo se usan las clases de vehículos de COCO. Nunca se identifican personas ni matrículas.
"""
import numpy as np
import onnxruntime as ort

VEHICLES = {2: "coche", 3: "moto", 5: "autobús", 7: "camión"}


class YoloxOnnx:
    def __init__(self, path, size=640, threads=4):
        so = ort.SessionOptions(); so.intra_op_num_threads = threads
        self.s = ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])
        self.inp = self.s.get_inputs()[0].name; self.size = size
        grids, strides = [], []
        for st in (8, 16, 32):
            n = size // st; yv, xv = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
            grids.append(np.stack((xv, yv), 2).reshape(-1, 2)); strides.append(np.full((n * n, 1), st))
        self.grid, self.stride = np.concatenate(grids).astype(np.float32), np.concatenate(strides).astype(np.float32)

    def __call__(self, bgr, conf=0.35, nms=0.45):
        h, w = bgr.shape[:2]; r = min(self.size / h, self.size / w)
        import cv2
        pad = np.full((self.size, self.size, 3), 114, np.uint8)
        pad[: int(h * r), : int(w * r)] = cv2.resize(bgr, (int(w * r), int(h * r)), interpolation=cv2.INTER_LINEAR)
        out = self.s.run(None, {self.inp: pad.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
        xy = (out[:, :2] + self.grid) * self.stride; wh = np.exp(out[:, 2:4]) * self.stride
        cls = out[:, 5:]; ids = cls.argmax(1); score = out[:, 4] * cls[np.arange(len(cls)), ids]
        keep = (score >= conf) & np.isin(ids, list(VEHICLES))
        if not keep.any(): return np.zeros((0, 4), np.float32), np.zeros(0, np.float32), np.zeros(0, int)
        xy, wh, score, ids = xy[keep], wh[keep], score[keep], ids[keep]
        boxes = np.concatenate([xy - wh / 2, xy + wh / 2], 1) / r
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, w); boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, h)
        xywh = [[float(b[0]), float(b[1]), float(b[2] - b[0]), float(b[3] - b[1])] for b in boxes]
        sel = cv2.dnn.NMSBoxes(xywh, score.tolist(), conf, nms)
        sel = np.array(sel).reshape(-1)
        return boxes[sel].astype(np.float32), score[sel].astype(np.float32), ids[sel].astype(int)
