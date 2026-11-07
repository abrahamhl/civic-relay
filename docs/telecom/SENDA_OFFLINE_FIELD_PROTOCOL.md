# SENDA — Protocolo de campo DTN sin red

**Estado de este documento:** protocolo operativo para validación física; la evidencia actual es `SIMULATED_VALIDATED` y la validación física queda `PHYSICAL_TEST_PENDING`.

**Ámbito:** `packages/senda` (núcleo), `packages/senda-relay` (relé IP) y el flujo A → mula → C. No es un servicio 112, no sustituye CAP, no certifica radios y no afirma que el sistema esté listo para producción.

---

## 1. Qué se quiere demostrar

Que un mensaje SOS cifrado extremo a extremo puede salir de un teléfono sin red, cruzar uno o más portadores intermedios, sobrevivir a la pérdida de fragmentos y a un reinicio, llegar al destinatario y ser purgado de la mula solo con un recibo auténtico. También se mide lo que cuesta en bytes, latencia y energía, y se registran los fallos.

La simulación demuestra la lógica y los invariantes del código. **No demuestra** alcance, caudal, consumo ni comportamiento en escombros o multitudes reales.

---

## 2. Piezas del protocolo

| Pieza | Archivo | Función |
|---|---|---|
| Sobre v2 | `packages/senda/src/envelope.mjs` | Cifrado E2E, firma, cabecera autenticada, validación estricta de forma y TTL. |
| Almacén DTN | `packages/senda/src/bundle.mjs` | Cola de sobres, cuota, prioridades, recibos verificados, cuarentena de recibos y transferencias reserve/commit. |
| Fragmentación | `packages/senda/src/erasure.mjs` | Reed–Solomon k-de-n para perder portadores sin perder el mensaje. |
| Enrutado | `packages/senda/src/router.mjs`, `src/opportunistic-routing.mjs` | Llegada más temprana sobre contactos y estrategias oportunistas comparables. |
| Relé | `packages/senda-relay/server.mjs` | Nodo IP que almacena y reenvía sin poder leer el contenido. |
| Evidencia | `packages/senda/scripts/dtn-field-sim.mjs`, `scripts/routing-benchmark.mjs` | Reproducción determinista y JSON con resultados. |

---

## 3. Invariantes que deben cumplirse

1. Un sobre no se acepta si su forma, base64url, longitud, prioridad, TTL o caducidad no son válidos.
2. Un recibo sin sobre **no verifica nada**: se guarda en cuarentena y no suprime la entrega.
3. Un recibo solo pasa a verificado cuando el hash del `ackSecret` coincide con el sobre que se tiene o se acaba de recibir.
4. Un recibo falso no borra una copia; el destinatario detecta un sobre manipulado al abrirlo.
5. Una transferencia reserva copias y solo las descuenta con `commit()`; una caída de transporte ejecuta `rollback()`.
6. La cuarentena está acotada: no puede inundar la memoria con ids o secretos aleatorios.
7. El reinicio conserva sobres, recibos verificados y cuarentena; no resucita un mensaje ya purgado.
8. El relé no puede verificar la firma del emisor porque la clave pública viaja dentro del cifrado; el destinatario sí la verifica. Es una limitación conocida, no una garantía.

---

## 4. Flujo A → B (mula) → C (destino)

1. **A** genera identidad, cifra el SOS para **C** y lo guarda con `put()`.
2. A fragmenta el sobre en `n=5`, `k=3` y entrega cada fragmento por un portador distinto (BLE, LoRa, SMS, satélite D2D, acústico o archivo).
3. **B** recibe al menos 3 fragmentos, reensambla, valida la forma y llama a `ingest()`.
4. Si B tenía un recibo pendiente para ese id, lo compara: si no coincide, lo descarta y almacena el sobre.
5. B se reinicia: `snapshot()` y `restore()` conservan el sobre y sus copias.
6. B transfiere a C con `syncPair()` o con `reserveFor()` + `commit()`.
7. C abre el sobre, comprueba firma y contenido, y crea un recibo con `openMessage().receipt`.
8. C llama a `acceptReceipt()`/`acceptReceiptDetailed()`: sin sobre local queda `PENDING`; con sobre, `VERIFIED_NOW`.
9. El recibo vuelve a B; B verifica el hash, marca el id como entregado, borra el sobre y libera cuota.
10. Un duplicado del sobre ya no se entrega otra vez.

---

## 5. Límites operativos actuales

| Límite | Valor | Consecuencia |
|---|---:|---|
| Tamaño máximo de sobre | 512 KiB | Se rechaza antes de descifrar. |
| TTL máximo | 90 días | Evita mensajes eternos. |
| Prioridad | 0–9 | 0 es SOS; 9 es rutina. |
| Caducidad máxima representable | `2^48 - 1` ms | Evita desbordamientos. |
| Recibos pendientes | 1024 | Cuarentena acotada. |
| Recibos verificados | 8192 | Se purgan los más antiguos al superar el tope. |
| Secretos pendientes por id | 2 | Un atacante no puede acumular infinitos secretos para un id. |
| Difusión | 16 KiB y 200 entradas | Se rechazan difusiones gigantes o duplicadas. |
| Ingesta por llamada | 1000 sobres / 5000 recibos | Corta lotes abusivos. |
| Cuota del relé | 256 MiB | Configurable en el servidor. |
| Cuerpo HTTP del relé | 2 MiB | Configurable con `MAX_BODY`. |

---

## 6. Protocolo de validación física (pendiente)

**Material necesario:** tres teléfonos Android con la app de laboratorio instalada, batería al 100 %, relojes sincronizados, un espacio abierto y otro con obstáculos, y una persona con un relé IP (Starlink/Wi-Fi) si se prueba el tramo de vuelta.

**Preparación:**

1. Desactivar datos móviles y Wi-Fi en A, B y C; activar solo la radio del tramo que se prueba.
2. Emparejar A–B y B–C con confirmación manual de dígitos; no usar emparejamiento automático.
3. Anotar versión de la app, modelos, Android, fecha/hora y nivel de batería.
4. Confirmar que el sobre va firmado y que el destinatario es C, no B.

**Ensayo mínimo (30 repeticiones por escenario):**

1. A crea un SOS de prueba con cuerpo ficticio y TTL de 24 h.
2. A fragmenta 3-de-5 y entrega tres fragmentos a B por el portador indicado; se destruyen dos fragmentos.
3. B reensambla, guarda y se reinicia; se comprueba que el sobre sigue.
4. B transfiere a C; C abre y devuelve el recibo.
5. Se inyecta un recibo falso antes y después de la entrega; se comprueba que no suprime el mensaje.
6. Se reenvía un duplicado; se comprueba que no se entrega dos veces.
7. Se repite con un sobre manipulado y otro malformado; deben rechazarse.
8. Se registran bytes, tiempo hasta entrega, batería inicial/final y errores de radio.

**Criterios provisionales de aceptación física:**

- 30/30 entregas con 2 de 5 fragmentos perdidos.
- 0/30 supresiones por recibo falso.
- 30/30 reinicios conservan el sobre.
- 30/30 duplicados suprimidos.
- 30/30 purgas de la mula tras recibo auténtico.
- Ningún fallo silencioso: cada rechazo debe tener motivo visible.

**Condiciones de parada:** interferencia que afecte a otros servicios, radio que exija permisos no previstos, batería crítica, pérdida de mensajes no explicada o cualquier indicio de que el ensayo pueda confundirse con una emergencia real.

**Estado:** no ejecutado en este entorno. No hay JDK, Android SDK ni teléfonos disponibles; por eso no se declara validación física.

---

## 7. Comandos reproducibles

Desde `packages/senda`:

```powershell
node --test tests/*.test.mjs
node scripts/sync-web.mjs
node scripts/dtn-field-sim.mjs --trials=30 --seed=357397
node scripts/routing-benchmark.mjs --seeds=20 --seed=20261107
```

Salidas:

- `evidence/senda/dtn-field-sim-2026-11-07.json`
- `evidence/senda/routing-benchmark-2026-11-07.json`

---

## 8. Límites y no-claims

- No hay radio real ni app Android en esta máquina; los resultados son simulación.
- La energía se mide como proxy de catálogo, no en julios.
- El relé IP no puede verificar la firma del emisor; solo el destinatario.
- No se ha probado con personas, servicios de emergencia, 112, CAP ni infraestructura institucional.
- Los resultados no certifican el sistema ni demuestran su validez en campo.
- Cualquier despliegue real requiere revisión legal, de privacidad, de seguridad y de radiofrecuencia.
