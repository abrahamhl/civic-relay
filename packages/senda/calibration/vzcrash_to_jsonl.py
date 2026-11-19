"""Convierte un dataset IMU de choques en formato «largo» (una fila por muestra) a trazas JSONL de SENDA.

Pensado para VZCrash (Hugging Face, acceso restringido, licencia CC BY-NC 4.0: NO comercial). No se han podido
ver sus columnas: hay que DECLARARLAS (no se adivinan) y el script falla si no existen.
Unidades de VZCrash según su ficha: acelerómetro en g (100 Hz), giroscopio en °/s, velocidad GPS en km/h (1 Hz).
Salida: líneas para packages/senda/scripts/crash-calibrate.mjs (imu en m/s², gyro en °/s, speed en m/s).
La separación train/test es por EVENTO (hash estable del id), nunca por muestra: evita fugas entre conjuntos.

Uso:
  python3 vzcrash_to_jsonl.py datos.parquet salida.jsonl --event-col E --time-col T --label-col L \
     --acc-cols AX AY AZ --gyro-cols GX GY GZ --speed-col V --test-fraction 0.2 [--time-unit s|ms]
"""
import argparse, hashlib, json, math, sys

G = 9.80665  # gravedad normal (CGPM 1901)


def split_of(event_id, test_fraction):
    h = int(hashlib.sha256(str(event_id).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "test" if h < test_fraction else "train"


def convert(df, a):
    needed = [a.event_col, a.time_col, a.label_col, *a.acc_cols, *(a.gyro_cols or []), *([a.speed_col] if a.speed_col else [])]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise ValueError(f"columnas declaradas que no existen: {missing}. Columnas del fichero: {list(df.columns)}")
    scale_t = 0.001 if a.time_unit == "ms" else 1.0
    for eid, g in df.sort_values([a.event_col, a.time_col]).groupby(a.event_col, sort=False):
        labels = g[a.label_col].dropna().unique()
        if len(labels) != 1:
            yield None, f"evento {eid}: etiqueta ambigua {list(labels)}"; continue
        t0 = float(g[a.time_col].iloc[0]) * scale_t
        t = (g[a.time_col].astype(float) * scale_t - t0).round(4).tolist()
        ax, ay, az = (g[c].astype(float).tolist() for c in a.acc_cols)
        imu = [{"t": ti, "x": x * G, "y": y * G, "z": z * G} for ti, x, y, z in zip(t, ax, ay, az) if not any(map(math.isnan, (x, y, z)))]
        out = {"id": str(eid), "label": bool(labels[0]), "split": split_of(eid, a.test_fraction), "imu": imu}
        if a.gyro_cols:
            gx, gy, gz = (g[c].astype(float).tolist() for c in a.gyro_cols)
            out["gyro"] = [{"t": ti, "x": x, "y": y, "z": z} for ti, x, y, z in zip(t, gx, gy, gz) if not any(map(math.isnan, (x, y, z)))]
        if a.speed_col:
            out["speed"] = [{"t": ti, "ms": v / 3.6} for ti, v in zip(t, g[a.speed_col].astype(float).tolist()) if not math.isnan(v)]
        yield out, None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("parquet"); ap.add_argument("out")
    for k in ("--event-col", "--time-col", "--label-col"):
        ap.add_argument(k, required=True)
    ap.add_argument("--acc-cols", nargs=3, required=True); ap.add_argument("--gyro-cols", nargs=3)
    ap.add_argument("--speed-col"); ap.add_argument("--test-fraction", type=float, required=True)
    ap.add_argument("--time-unit", choices=["s", "ms"], required=True)
    a = ap.parse_args(argv)
    if not 0 < a.test_fraction < 1:
        ap.error("--test-fraction debe estar entre 0 y 1")
    import pandas as pd
    df = pd.read_parquet(a.parquet)
    n, bad = 0, []
    with open(a.out, "w", encoding="utf-8") as f:
        for tr, err in convert(df, a):
            if err:
                bad.append(err); continue
            f.write(json.dumps(tr) + "\n"); n += 1
    print(json.dumps({"traces": n, "rejected": len(bad), "examples": bad[:5]}, ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()
