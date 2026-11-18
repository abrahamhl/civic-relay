# 11 · La carretera como senda principal: bus de avisos, horizonte, atención e intercambio entre dispositivos

> Iteración VI · 18-11-2026 · Firma: Claude (Asistente de Orquestación Senior)
> Regla de veracidad: los umbrales, presupuestos, alcances y penetraciones de este documento son **decisiones de diseño o escenarios declarados**. **No están medidos.** El código los exige como parámetros; ninguno tiene valor por defecto.

## 1. 🎯 Problema que cierra

Un mismo peligro llega por muchas puertas: la baliza V16, DATEX II oficial, una cápsula BLE firmada, el detector del móvil o un plan de zona. Para que la carretera funcione como **una sola senda** entre dispositivos y programas, hacían falta cinco piezas:

1. **Fusionar** sin contar dos veces la misma causa.
2. **Repartir** por canales que fallen de forma independiente.
3. **Decir solo lo que está por delante** y en tu sentido.
4. **No saturar** al conductor.
5. **Seguir propagando sin red**, de coche a coche, sin que nadie pueda inundar la vía con avisos falsos.

## 2. 🧩 Piezas (todas en `packages/senda/src/`)

| Módulo | Qué hace | Decisión clave |
|---|---|---|
| `roadsafe-warning-bus.mjs` | Aviso canónico; normalizadores de 6 fuentes; fusión por familia, vía y sentido; reparto por canal | La confianza **no sube** con pistas de la misma raíz. Dos raíces de multitud dan CORROBORATED, nunca oficial. Solo una fuente oficial o un operador cierra el aviso. El refuerzo se cuenta en **familias de fallo**, no en canales. |
| `roadsafe-horizon.mjs` | Proyecta la posición sobre la geometría y lista lo que hay por delante | Descarta lo que queda detrás, el sentido contrario (salvo el tiempo meteorológico), lo caducado y otra carretera, y dice por qué. |
| `roadsafe-attention.mjs` | Presupuesto de atención: como mucho **un** aviso por turno | Orden explicable: ventana útil → WARNING → gravedad del tipo → menor tiempo de llegada. El contexto (punto negro) solo usa presupuesto sobrante. Lo urgente salta la separación mínima. |
| `roadsafe-attention.mjs` · `bleRelayReach` | Alcance de la cadena BLE del mismo sentido | Modelo de Poisson espacial con reenvío al más lejano. |
| `roadsafe-gossip.mjs` | Qué pasar a otro dispositivo en un contacto breve | Papeles CONSUMIDOR / PORTADOR, presupuesto de bytes, umbral de confianza para transportar, tope de saltos, recepción que nunca sube la confianza. |
| `roadsafe-exposure.mjs` | Tasas por 100 M veh-km (GB: AADF × STATS19) | Cota inferior declarada: los accidentes sin tramo aforado no se imputan. |

## 3. 📡 Resultado de modelo: cadena BLE contra portador del sentido contrario

Escenario declarado (no medido): 25 veh/km, 200 m por salto, tope de 10 saltos. Resultados calculados por `bleRelayReach`:

| Penetración SENDA | P(siguiente salto) | Alcance esperado |
|---|---|---|
| 1 % | 0,049 | ≈ 5 m |
| 5 % | 0,221 | ≈ 30 m |
| 20 % | 0,632 | ≈ 198 m |
| 50 % | 0,918 | ≈ 887 m |

**Conclusión de diseño.** Con la penetración baja de un despliegue inicial, la cadena del mismo sentido prácticamente no propaga. El vehículo del **sentido contrario** que ya pasó la escena sí lo hace: se aleja de ella justo hacia quienes se acercan (modelo en `v2vUpstreamDelivery`).

Por eso `selectForPeer` da a ese vehículo el papel de **PORTADOR**:

- recibe los avisos del otro sentido que quedan detrás de él;
- solo si su confianza alcanza `carryMinTrust` (blindaje contra inundación);
- con un tope de saltos.

## 4. 🛡️ Blindaje del intercambio

- **El HELLO no lleva ningún identificador** de dispositivo ni de persona: solo vía, sentido, posición y los prefijos de los avisos que ya conoce.
- **La confianza nunca sube al recibir.** Lo que llega de un par entra como `SIGNED_PEER` si la firma se verificó y como `UNVERIFIED_HINT` si no, diga lo que diga el aviso.
- **Lo malformado se rechaza**: caducado, tipo desconocido, coordenadas imposibles o demasiados saltos.
- **Límite declarado:** los prefijos de 8 hex pueden colidir (probabilidad del orden de n²/2³³). Si colisionan, el par no recibe ese aviso en este contacto; se le vuelve a ofrecer en el siguiente.

## 5. 🧪 Verificación

| Comprobación | Resultado |
|---|---|
| Núcleo y defensa (`node --test packages/senda/tests/*.test.mjs packages/senda/tests/defense/*.test.mjs`) | 788/788 |
| Adversariales (incluye la auditoría del corredor C1–C6) | 31/31 |
| Chromium E2E | 72/72 |

Lo que comprueba el E2E en la pestaña Carretera:

- se dice exactamente un aviso por turno;
- con más penetración, la cadena BLE llega más lejos.

## 6. ⏳ Pendiente y no verificado

- **Presupuesto de atención.** Falta calibrarlo con estudios de distracción o con un piloto. Los valores de la consola (3 avisos cada 5 min, 20 s entre avisos) son un **ejemplo declarado**.
- **Alcance BLE.** Falta medir el alcance real en carretera (habitáculo, carrocería, velocidad relativa) y la probabilidad de contacto en un cruce a 2 × 90 km/h. **No verificado.**
- **DATEX II.** Falta la validación contra el XSD oficial.
- **Exposición.** Falta la de DE (BASt) para tener tasas fuera de GB.
