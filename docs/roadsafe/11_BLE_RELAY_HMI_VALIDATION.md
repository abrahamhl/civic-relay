# H-ROAD-BLE-1 / H-ROAD-HMI-1 — Continuación RoadSafe (2026-11-18)

**Estado:** implementado en rama experimental y probado con Node.js; **no desplegado, no aprobado ni validado en carretera**.

**Base:** PR #48 (commit 1c477149). Este trabajo no presupone que los cambios locales no publicados de la sesión Claude existan en GitHub.

## 1. Física del corredor: qué hace y qué NO hace

- Módulo: packages/senda/src/roadsafe-opposite-relay.mjs.
- El incidente está en x=0. Un coche que se acerca comienza a distancia d y velocidad v_a; un vehículo del sentido contrario recoge un aviso en t0 y lo transporta aguas arriba a velocidad v_o.
- Encuentro conservador (sin conceder metros de radio anticipados): t_meet = (d + v_o*t0)/(v_a + v_o).
- Tiempo útil antes del peligro: lead = d/v_a - t_meet. Si no alcanza el margen exigido por el ensayo, el escenario **no computa como aviso útil**.
- Para un flujo de vehículos contrario **Poisson estacionario**, participación a, recepción de origen p_s, recepción final p_r, y ventana de recogida admisible T, la probabilidad teórica de al menos un encuentro válido es 1 - exp[-(flujo/3600)*a*p_s*p_r*T].
- La distancia lateral, las barreras de mediana y la viabilidad real del enlace son prerrequisitos explícitos. La fuente **no** es la baliza V16 emitiendo BLE: se requiere un dispositivo SENDA que haya obtenido el evento por un canal permitido.
- Las probabilidades de contacto en teléfonos Android/iOS en segundo plano **no se inventan**; para obtenerlas es necesario medir.
- El resultado de un relé **no** equivale a acuse de entrega al conductor y jamás habilita automáticamente avisos operativos o despacho.

### Cálculo de sensibilidad, completamente hipotético

Para d=3 km, v_a=v_o=25 m/s, 900 vehículos/h en sentido contrario, p_s=0,5, p_r=0,4, margen de aviso 20 s, TTL/horizonte 180 s, enlace lateral declarado viable:

| Participación efectiva | Probabilidad según el modelo |
|---:|---:|
| 1 % | 3,92 % |
| 5 % | 18,13 % |
| 10 % | 32,97 % |
| 20 % | 55,07 % |

**Interpretación:** ni el 55 % ni el 63 % son tasas observadas. Los parámetros de radio, participación y flujo aún requieren campañas físicas. El intervalo de Wilson proporcionado por Monte Carlo indica solo error de muestreo del simulador, nunca incertidumbre sobre el mundo real.

## 2. Control de atención y redundancia

- Módulo: packages/senda/src/roadsafe-alert-arbiter.mjs.
- Entrada esperada desde el **bus canónico**, no de señales arbitrarias: incidentKey, hazardType, gravedad, ETA, calzada confirmada, evidencia, marca temporal y caducidad.
- Deduplicación por incidente + clase de peligro; DGT/DATEX/BLE no se convierten en confirmaciones independientes por llegar en canales diferentes.
- El primer peligro inminente (p. ej. final de cola) tiene precedencia sobre otro más lejano (p. ej. accidente), con escalado excepcional limitado para peligro crítico.
- Máximo 3 propuestas de voz por minuto, ventana mínima y cooldown por escena. **Estos números son política experimental**, sujetos a ensayos humanos, no distancias ni intervalos reglamentarios.
- Sin consentimiento expreso, puerta de despliegue y aprobación individual del aviso, el canal de voz queda cerrado.
- Datos dudosos pueden figurar como indicación **sin confirmar** en pantalla, pero no en audio.
- Este módulo **no es un motor TTS ni una autoridad de avisos**, y sus booleanos de aprobación no sustituyen un sistema externo de control de acceso.

## 3. Integración prevista con el bus único (P0)

Esquema contractualmente necesario: event_id, incident_key, hazard_type, road_id, carriageway_id, direction, linear_reference, observed_at, received_at, expires_at, source_lineage[], root_id, confidence_status, authenticity, accuracy, consent_scope, delivery_state, destination_receipt.

- **Ingesta:** V16 publicada por DGT 3.0/DATEX, operadores autorizados, proveedor de asistencia, aviso ciudadano, cola verificada, BLE de pares autorizados y gemelo. Tratar cada dato como no verificado hasta comprobar origen y procedencia.
- **Fusión:** una raíz física no se contabiliza de nuevo al recorrer varias redes. No deducir una probabilidad a partir de fiabilidades ficticias.
- **Distribución:** UI/voz local, SMS consentido, BLE/DTN experimental, DATEX II/CIFS/DENM/CAP/PMV únicamente con autorización e integración real. No existe acceso presunto a infraestructuras de terceros.
- **Acuses:** distinguir QUEUED, CUSTODY_ACK, FORWARDED_UNCONFIRMED y DESTINATION_ACK con evidencia final verificable. Las copias por canales independientes refuerzan resiliencia pero no generan automáticamente corroboración.
- **Bloqueo:** el bus canónico y el horizonte electrónico descritos en la última sesión de Claude no aparecían publicados en PR #48 al comienzo de esta continuación. Antes de fusionar código nuevo, comparar sus interfaces reales cuando se publiquen.

## 4. Campaña mínima en campo (prerrequisito de producto)

1. **Laboratorio:** 2 Android físicos y 2 iPhone físicos; ensayar app en primer plano, segundo plano, pantalla bloqueada, ahorro de batería y revocación de permisos; registrar versión OS y hardware.
2. **Carretera controlada o recinto autorizado:** distancia lateral y separación entre calzadas; barreras metálicas; velocidad relativa; tiempo de contacto radio; advertencias fallidas y duplicadas; condiciones meteorológicas; sin manipular el teléfono al volante.
3. **Diseño estadístico:** registrar total de intentos (incluidos fallos), denominadores por OS/canal, p50/p95 de latencia, tasa de **acuse de destino** y no solo custodia, distribución de adelanto útil, falsos positivos, contradicciones y tasas de mensajes por minuto.
4. **Factor humano:** ensayos autorizados con conductor/pasajero en simulador, comprobación de distracción, comprensión de voz, acceso universal y políticas de silencio; evitar órdenes de maniobra no verificadas.
5. **Pilotos institucionales:** convenio/alta explícita con gestor vial, aseguradora/asistencia y 112 si corresponde; DPA/DPIA y licencias de datos; nunca confundir el modo demostración con servicio de emergencias operativo.

## 5. Normativa y límites

- España: **Instrucción 8.3-IC** (Orden de 31 de agosto de 1987, BOE-A-1987-21608) establece señalización y balizamiento de **obras fijas fuera de poblado**. No trasladar automáticamente sus tablas a avisos de averías o al HUD.
- La **V16 conectada** es el dispositivo legal de preseñalización de vehículos inmovilizados en España desde el 1 de enero de 2026, según DGT y el régimen reglamentario aplicable. SENDA complementa; **no sustituye** el dispositivo ni el 112.
- iOS limita escaneo/publicidad BLE en segundo plano; Android también impone restricciones. Una PWA no puede prometer una malla vehicular persistente por radio.

Fuentes públicas de orientación:
- BOE: https://www.boe.es/diario_boe/txt.php?id=BOE-A-1987-21608
- DGT: https://www.dgt.es/muevete-con-seguridad/tecnologia-e-innovacion-en-carretera/Dispositivos-de-presenalizacion-V16
- Apple: https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html
- Android AOSP: https://source.android.com/docs/core/connect/bluetooth/ble_advertising

## 6. Gates de esta iteración

- [x] Reenvío en sentido contrario con geometría de encuentro y margen útil.
- [x] Probabilidades desconocidas no generan falsa confianza.
- [x] Monte Carlo determinista con intervalo **solo de simulación**.
- [x] Antisaturación, clasificación por ETA y deduplicación en recepción.
- [x] Pruebas adversariales locales: **13/13** con Node 22.
- [x] Copia exacta de ambos módulos en el core web, para paridad sync-web.
- [ ] Revisión de CI del PR y comparativa con nuevas fuentes de Claude.
- [ ] Ensayo físico, UX con usuarios, autorización y validación externa.
- [ ] Integración efectiva con el bus canónico, HUD, proveedores y destinos externos.
