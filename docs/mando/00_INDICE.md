# SENDA Mando — índice de la superficie multicanal (08-11-2026)

> **Estado:** `SIMULATED_VALIDATED`; validación física `PHYSICAL_TEST_PENDING`.
> **Versión:** v0.22 · modelo `mando-2.2.0`.
> **Regla:** ejercicio determinista. No hay radios, cámaras, GPS ni dispatch 112 conectados. El conector de producción de la Consola Mando es privado.

---

## 1. Rutas publicadas

| Idioma | Ruta | Fuente |
|---|---|---|
| Inglés | `/mando/` | `app/(en)/mando/page.tsx` |
| Español | `/es/mando/` | `app/(localized)/[locale]/mando/page.tsx` |
| Neerlandés | `/nl/mando/` | `app/(localized)/[locale]/mando/page.tsx` |

Las tres rutas son estáticas, tienen `canonical`, alternates `en`/`es`/`nl` y `html lang` correcto. La navegación superior de `SurfaceView` incluye «D · Mando / Panel Multicanal» en las tres lenguas, y la portada añade una cuarta tarjeta D con enlace a la vista dedicada.

---

## 2. Archivos principales

| Archivo | Función |
|---|---|
| `investor-next/lib/command-surface.ts` | Modelo determinista: entornos RF, canales, escenarios, activos, pistas, 34 activaciones, cobertura, trilateración ponderada, presupuesto RF y rutas con respaldo. |
| `investor-next/app/command-surface.tsx` | Consola cliente: mapa, capas, cola, detalle, ruta, calculadora RF, auditoría y exportación. |
| `investor-next/app/command-surface.css` | Estilos `.cmd*`, rejilla responsive y movimiento reducido. |
| `investor-next/app/surface-view.tsx` | Navegación e integración de la superficie `MANDO`. |
| `investor-next/tests/command-surface-model.test.mjs` | 9 pruebas del dataset, presupuesto, probabilidad, trilateración, rutas, cobertura y exportación. |
| `investor-next/scripts/finalize-locales.mjs` | Comprueba `lang` en `out/es/mando.html` y `out/nl/mando.html`. |
| `investor-next/test-locales.mjs` | Smoke test de las tres rutas `/mando`. |

---

## 3. Qué muestra la consola

1. **KPIs:** total visible, abiertas, no confirmadas, rojas, mediana de triaje, verificadas, cobertura, activaciones con ruta y entrega media a tres intentos.
2. **Calibración global:** entorno RF, sigma de sombra y versión del modelo; afectan presupuesto, rutas, calor de cobertura y exportación.
3. **Mapa:** activos, cobertura, calor de probabilidad, pistas, elipse de posición y rutas primaria/respaldo; capas conmutables.
4. **Cola de activaciones:** filtros por canal y estado; reproduce el reloj de 0 a 900 s.
5. **Detalle:** severidad, confianza, consentimiento, fuente, geo aproximada y triaje.
6. **Ruta mesh:** saltos, canal, distancia, latencia, P(enlace), pérdida, ETA, energía y salto más débil; ruta de respaldo.
7. **Presupuesto RF:** frecuencia, distancia, potencia, ganancias, sensibilidad, muro, ancho de banda y figura de ruido; usa el entorno y la sombra globales.
8. **Trilateración:** tres anclas no gateway, sigma por activo, GDOP, elipse al 95 % y error residual.
9. **Auditoría y exportación:** registro local de acciones y descarga JSON v2 con entorno, sigma, modelo y rutas.
10. **Activación simulada:** asignación de una activación NEW/TRIAGED, con aviso si no hay ruta.

---

## 4. Escenarios y datos

| Escenario | Canales activos | Gateway | Daño | Nodos |
|---|---|---|---:|---:|
| `blackout` | acústico, BLE, LoRa, satélite | fuera | 100 % | 17 |
| `degraded` | acústico, BLE, Wi-Fi, LoRa, SMS, satélite | degradado | 65 % | 31 |
| `recovery` | los anteriores + celular | online | 15 % | 46 |

- 8 activos: gateway, 2 estaciones, radar, 2 cámaras, turbina y dron.
- 34 activaciones entre 12 s y 899 s (`ACT-2401`…`ACT-2434`).
- 8 canales: acústico, BLE, Wi-Fi, LoRa, SMS, satélite, celular y gateway.
- 5 entornos: abierto, rural, suburbano, urbano y escombros.
- Reloj máximo: 900 s.

---

## 5. Invariantes del modelo

- Una activación solo está cubierta si su canal está activo en el escenario.
- La cobertura exige un activo no offline que declare el canal; los canales globales no comprueban distancia.
- El primer salto de una ruta exige un canal compartido entre la activación y el candidato.
- Un activo sin el canal de la activación no puede ser el primer salto.
- `ACT-2416` usa `CELL`, no un inexistente canal `CAMERA`.
- La carga ilimitada se muestra como `∞`.
- El HUD del mapa distingue «sin ruta» de «gateway caída».
- Los textos de las tres lenguas declaran que es una simulación.
- El margen P90 nunca supera el margen medio y `viable90` exige margen P90 no negativo.
- La probabilidad por salto y la probabilidad de ruta quedan en `[0,1]`.
- La ruta de respaldo, si existe, evita el primer relay de la ruta primaria.
- La elipse de posición usa el 95 % nominal y cumple `mayor ≥ menor > 0`.
- El alcance máximo se limita al alcance de planificación del canal.
- Los tests del modelo se ejecutan con `npm run test:command`.

---

## 6. Límites conocidos

- Modelo log-distancia + sombra log-normal + clutter; sin difracción, multitrayecto, vegetación, lluvia ni interferencia.
- Cobertura en disco y calor por rejilla de 40 unidades; sin relieve ni edificios.
- Trilateración con distancias perturbadas y sigma por tipo de activo; sin calibración de sesgos.
- Fuentes de calibración: estándares y adaptaciones (ITU-R P.525, 3GPP TR 38.901, Semtech AN1200.13, ETSI EN 300 220), no mediciones propias.
- Sin ingestión OSINT en vivo.
- Sin conexión a 112, ES-Alert, NL-Alert ni dispatch.
- Sin mediciones de campo de RSSI, latencia, energía o tasa de error.
- Datos y fuentes del modelo son etiquetas de ejercicio, no telemetría.

---

## 7. Verificación

Ejecutar desde `investor-next`:

```powershell
npm run type-check
npm run test:command
npm run build
npm run check:locales
```

Resultado del 08-11-2026:

- `type-check`: sin errores.
- `test:command`: 9/9 pruebas.
- `build`: 14 páginas estáticas, incluidas las tres rutas `/mando`.
- `check:locales`: 6/6, incluidas las tres superficies de mando.

---

## 8. Documentos relacionados

- [Física y matemática de la malla](../telecom/MALLAS_OFFLINE_FISICA_MATEMATICA_2026-11-08.md)
- [OSINT, canales y límites](../research/OSINT_MALLAS_OFFLINE_2026-11-08.md)
- [Protocolo de campo DTN](../telecom/SENDA_OFFLINE_FIELD_PROTOCOL.md)
- [Huecos del 112 y canales ciudadanos](../research/CANALES_SENSORES_Y_HUECOS_112_2026-11-05.md)
- [Cambios v0.22](../../00_CHANGELOG.md)

---

## 9. Siguiente paso

Sustituir la validación simulada por un protocolo físico acotado: tres teléfonos, un gateway, dos muros de distinta atenuación y registro de RSSI, latencia, energía y pérdida de paquetes. Sin ese paso, la etiqueta correcta sigue siendo `SIMULATED_VALIDATED`.
