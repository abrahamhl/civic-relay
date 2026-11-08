# SENDA · Checkpoint de reanudación

Fecha: 2026-11-08  
Rama: `mission/senda-95-20261108`  
HEAD de código: `3041a52435aadb936e34cf8546df3806a31c68a6`  
Estado: suite 264/264; benchmark v2 final generado desde árbol limpio (`SOURCE_ONLY`); JSON de evidencia pendiente de commit.

## 1. Qué está hecho

- Manifiesto de release y sus 4 pruebas.
- Validación fail-closed de incendios y 9 pruebas nuevas.
- EAOR integrado con reapertura de contactos y 5 pruebas nuevas.
- Benchmark DTN v2 con bootstrap por grafos y deltas pareados.
- 264/264 pruebas SENDA en verde.
- 61 módulos sincronizados a `investor-next/public/senda/core`.
- Documentación de misión completa en `docs/`.
- Bug de longitud binaria >65535 B corregido y probado.

## 2. Comandos exactos

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda
node scripts/sync-web.mjs
node --test tests/*.test.mjs
```

Resultado actual: 264 pass, 0 fail.

```powershell
cd C:\Users\2fabr\civic-relay
node --test scripts/release-manifest.test.mjs
```

Resultado actual: 4 pass, 0 fail.

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda
node scripts/routing-benchmark-v2.mjs --graphs=30 --realizations=20 --bootstrap=2000 --repeats=10 --seed=20261107 --out="C:\Users\2fabr\AppData\Local\Temp\opencode\routing-benchmark-m95.json"
```

El benchmark tarda varios minutos. Para humo:

```powershell
node scripts/routing-benchmark-v2.mjs --graphs=2 --realizations=2 --bootstrap=40 --repeats=2 --out="$env:TEMP\smoke.json"
```

## 3. Estado de Git

El commit de código es `3041a52` y contiene 38 ficheros. Después se generó la evidencia desde ese commit con árbol limpio. El estado esperado antes del commit de evidencia es:

```text
?? evidence/senda/mission-95/routing-benchmark-m95.json
 M docs/audits/SENDA_MISSION_95_STATUS.md
 M docs/handoff/SENDA_RESUME_CHECKPOINT.md
 M evidence/senda/mission-95/README.md
```

## 4. Qué falta

1. Commitear el JSON y las actualizaciones de documentación.
2. Abrir PR de `mission/senda-95-20261108`.
3. Implementar PCI v0.2 en `packages/senda-pci/`.
4. Cerrar hallazgos F-02 (vinculación de identidad) y F-05 (gestión de claves).
5. Validación física DTN y calibración de incendios: BLOCKED por hardware/datos/permisos.

## 5. Evidencia limpia ya generada

El JSON final se generó con salida fuera del repo y árbol limpio:

- Commit medido: `3041a52435aadb936e34cf8546df3806a31c68a6`.
- `source.manifestClaim = SOURCE_ONLY`.
- `source.worktreeDirty = false`, `source.dirtyPaths = []`.
- SHA-256 del JSON: `c399870d43f121c4739fb9bb4cc5ed7b652436eac99f7b1ce46642cc7ffcd860`.

Para reproducir: commitear el código, verificar `git status --short` vacío, ejecutar con `--out` fuera del repo, comprobar `SOURCE_ONLY`, copiar el JSON y commitearlo aparte. No presentar un `UNCOMMITTED_BUILD` como release verificada.

## 6. Hallazgos abiertos

- F-01 PCI ausente (BLOCKED).
- F-02 identidad del emisor no ligada a tarjeta de contacto.
- F-03 el relé no puede verificar la firma (por diseño).
- F-04 metadatos en cabecera.
- F-05 gestión de claves.
- F-06 broadcast no verificado en el almacén.
- F-08 sin prueba formal ni auditoría externa.
- F-09 evicción/DoS bajo carga.
- F-10 replay mitigado.

Detalle: `docs/security/SENDA_ASSURANCE_REVIEW.md`.

## 7. Reglas que no se deben romper

- No afirmar validación física.
- No afirmar novedad ni patentabilidad.
- No llamar «recuperación» a PCI v0.2.
- No borrar el histórico ni hacer force push.
- No fusionar a `master` sin aprobación.
- No publicar secretos ni datos personales.
- No usar PowerShell `Set-Content -Encoding UTF8` para JSON (BOM).
- Ejecutar `node scripts/sync-web.mjs` tras tocar el núcleo.

## 8. Contacto y entorno

- Repo: `C:\Users\2fabr\civic-relay`
- Node: v22.22.2
- pnpm: 9.12.3
- Git: 2.53.0
- Windows PowerShell 5.1
- Issue de referencia: #19 (SHA ambiguo)
- PRs abiertos: #12, #13, #17, #18, #20, #21, #22
