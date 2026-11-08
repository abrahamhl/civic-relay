# SENDA · Checkpoint de reanudación

Fecha: 2026-11-08  
Rama: `mission/senda-95-20261108`  
HEAD de código (producto): `c5821dd93a4b0aee5eadc853d2e7d85b43e25cd6`
Estado: suite SENDA 266/266 y PCI 13/13; benchmark v2 final generado desde árbol limpio (`SOURCE_ONLY`); PCI v0.2 y F-02/F-05 commiteados en `c5821dd`; este checkpoint va en un commit aparte; push al PR #23 pendiente.

## 1. Qué está hecho

- Manifiesto de release y sus 4 pruebas.
- Validación fail-closed de incendios y 9 pruebas nuevas.
- EAOR integrado con reapertura de contactos y 5 pruebas nuevas.
- Benchmark DTN v2 con bootstrap por grafos y deltas pareados.
- 266/266 pruebas SENDA en verde (incluye F-02 y F-05).
- 13/13 pruebas PCI en verde; CLI PCI probada de extremo a extremo.
- `@senda/pci` v0.2.0 con protocolo `senda.pci/1`, cadena de custodia, recibos y verificación fail-closed con anclas externas.
- F-02: versión interna 3 liga la firma y la huella de caja a la tarjeta de contacto; los sobres v2 siguen abriéndose sin vinculación.
- F-05: export/import cifrado de identidad con PBKDF2-SHA-256 + AES-256-GCM; queda pendiente keystore/rotación/revocación.
- 61 módulos sincronizados a `investor-next/public/senda/core`.
- Documentación de misión completa en `docs/`.
- Bug de longitud binaria >65535 B corregido y probado.

## 2. Comandos exactos

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda
node scripts/sync-web.mjs
node --test tests/*.test.mjs
```

Resultado actual: 266 pass, 0 fail.

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda-pci
node --test tests/*.test.mjs
```

Resultado actual: 13 pass, 0 fail.

```powershell
cd C:\Users\2fabr\civic-relay\packages\senda-pci
$dir = "$env:TEMP\senda-pci-smoke"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
node cli.mjs keygen --name "Recogida" --org "Protección Civil" --out "$dir\collector.key.json"
node cli.mjs pub --key "$dir\collector.key.json" --out "$dir\collector.pub.json"
```

El humo completo de CLI está descrito en la sección 5; no usar estas claves fuera de pruebas.

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

El commit de producto es `c5821dd` y contiene PCI v0.2, F-02/F-05, el espejo web y las actualizaciones de estado/seguridad. Este checkpoint se commitea después; tras ese commit el árbol queda limpio.

```text
# estado esperado tras commitear este documento
(limpio)
```

No hacer force push. El push va a `mission/senda-95-20261108`, PR #23, no a `master`.

## 4. Qué falta

1. Commitear PCI v0.2, F-02/F-05, el espejo web y estas actualizaciones; pushear al PR #23.
2. Auditar PCI y la criptografía de identidad de forma externa.
3. Integrar PCI en el producto y desplegarlo con hash verificable.
4. Cerrar F-05 residual: keystore, rotación y revocación.
5. Validación física DTN y calibración de incendios: BLOCKED por hardware/datos/permisos.

## 5. Evidencia limpia ya generada

El JSON final se generó con salida fuera del repo y árbol limpio:

- Commit medido: `3041a52435aadb936e34cf8546df3806a31c68a6`.
- `source.manifestClaim = SOURCE_ONLY`.
- `source.worktreeDirty = false`, `source.dirtyPaths = []`.
- SHA-256 del JSON: `c399870d43f121c4739fb9bb4cc5ed7b652436eac99f7b1ce46642cc7ffcd860`.

Para reproducir: commitear el código, verificar `git status --short` vacío, ejecutar con `--out` fuera del repo, comprobar `SOURCE_ONLY`, copiar el JSON y commitearlo aparte. No presentar un `UNCOMMITTED_BUILD` como release verificada.

### 5.1 Humo PCI

El paquete `packages/senda-pci/` se probó con tres custodios en `C:\Users\2fabr\AppData\Local\Temp\opencode\pci-smoke`: alta, transferencia, recibo, segundo custodio, sello y verificación. Resultado: 4 registros, ledger sellado, custodio final Bruno, digest `cede45246baacb9065a647cb289da99bb5cd48272ae5febeccb8c429b8a90733`. Fue un humo local; no es despliegue ni evidencia de campo.

## 6. Hallazgos

- F-01 PCI implementado localmente y probado (13/13), pero sin auditoría externa, integración ni despliegue verificable.
- F-02 mitigado en código y probado: firma y huella de caja ligadas a la tarjeta; la UI aún debe exigir `expectedSender`.
- F-03 el relé no puede verificar la firma (por diseño).
- F-04 metadatos en cabecera.
- F-05 mitigado parcialmente: export cifrado con frase de paso; faltan keystore, rotación, revocación y eliminar la exportación en claro.
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
- PRs abiertos: #12, #13, #17, #18, #20, #21, #22, #23
