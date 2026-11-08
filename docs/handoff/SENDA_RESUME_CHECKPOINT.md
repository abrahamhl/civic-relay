# SENDA · Checkpoint de reanudación

Fecha: 2026-11-08  
Rama: `mission/senda-95-20261108`  
HEAD: `1136f572bb696a6a1da30eb4693b866b983f3b7e` (antes del commit de la misión)  
Estado: árbol de trabajo sucio; suite 264/264; benchmark v2 generado pero pendiente de regenerar desde árbol limpio.

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
node scripts/routing-benchmark-v2.mjs --graphs=30 --realizations=20 --bootstrap=2000 --repeats=10 --seed=20261107 --out=evidence/senda/mission-95/routing-benchmark-m95.json
```

El benchmark tarda varios minutos. Para humo:

```powershell
node scripts/routing-benchmark-v2.mjs --graphs=2 --realizations=2 --bootstrap=40 --repeats=2 --out=evidence/senda/mission-95/routing-benchmark-smoke.json
```

Borrar el smoke después.

## 3. Estado de Git

```powershell
git status --short
git diff --stat
```

Modificados:

- `packages/senda/src/{envelope,fire-field,opportunistic-routing,wildfire}.mjs`
- `packages/senda/tests/dtn-hardening.test.mjs`
- espejo `investor-next/public/senda/core/*`
- `package.json`

Nuevos:

- `scripts/release-manifest.mjs`, `scripts/release-manifest.test.mjs`
- `packages/senda/scripts/routing-benchmark-v2.mjs`
- `packages/senda/tests/{eaor-routing,fire-audit,routing-benchmark-v2}.test.mjs`
- `docs/**` de la misión
- `evidence/senda/mission-95/`
- `.opencode/agents/*` (11 agentes)

## 4. Qué falta

1. Commit de código, tests, docs y agentes.
2. Regenerar el benchmark desde árbol limpio:
   - commit del código;
   - ejecutar el benchmark con `--out` fuera del repo (por ejemplo, `%TEMP%`);
   - copiar el JSON a `evidence/senda/mission-95/`;
   - commitear la evidencia como acto de contabilidad.
3. Abrir PR de `mission/senda-95-20261108`.
4. Implementar PCI v0.2 en `packages/senda-pci/`.
5. Cerrar hallazgos F-02 (vinculación de identidad) y F-05 (gestión de claves).
6. Validación física DTN y calibración de incendios: BLOCKED por hardware/datos/permisos.

## 5. Regeneración limpia de evidencia

El manifiesto no puede describir limpio un árbol que contiene su propia salida sin commitear. Procedimiento honesto:

1. Commitear todo el código y la documentación, sin el JSON final.
2. Verificar `git status --short` vacío.
3. Ejecutar el benchmark con `--out="$env:TEMP\routing-benchmark-m95.json"`.
4. Verificar que `source.manifestClaim` sea `SOURCE_ONLY` y que `source.git.dirtyPaths` esté vacío.
5. Copiar el JSON a `evidence/senda/mission-95/routing-benchmark-m95.json`.
6. Commitear solo ese JSON.
7. En el PR, citar el commit de código medido y el commit de evidencia.

No presentar un `UNCOMMITTED_BUILD` como release verificada.

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
