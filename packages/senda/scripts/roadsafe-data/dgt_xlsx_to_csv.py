#!/usr/bin/env python3
"""Convierte TABLA_ACCIDENTES_YY.XLSX (DGT, microdatos con víctimas) a CSV con ';'.

Uso: python3 -I dgt_xlsx_to_csv.py <entrada.xlsx> <salida.csv>
Requiere openpyxl (lectura en modo streaming). No modifica valores: copia la primera hoja tal cual.
"""
import csv
import sys

import openpyxl


def main(src: str, dst: str) -> None:
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb.worksheets[0]
    n = 0
    with open(dst, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        for row in ws.iter_rows(values_only=True):
            w.writerow(["" if v is None else v for v in row])
            n += 1
    print(f"{n - 1} filas -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("uso: dgt_xlsx_to_csv.py <entrada.xlsx> <salida.csv>")
    main(sys.argv[1], sys.argv[2])
