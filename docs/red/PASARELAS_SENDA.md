# Pasarelas SENDA: cómo llega un mensaje entre Suecia, Países Bajos y España

Estado a 27-11-2026. Cada vía lleva un estado: **FUNCIONA** (código del repositorio probado), **FALTA DESPLEGAR** (el
código existe y está probado, pero no hay servidor en marcha), **ESPECIFICADO** (diseño y simulación, sin hardware
probado) o **NO VIABLE** (motivo y fuente).

## 1. La regla física (sin ella nada de lo demás tiene sentido)

Un mensaje cifrado necesita un **medio físico** en cada tramo. Entre Suecia, Países Bajos y España hay más de
1 500 km; ninguna radio de un móvil llega tan lejos: el Bluetooth alcanza decenas de metros y el sonido menos de un
metro. Por eso el viaje se divide en tres tramos:

```
 PRIMERA MILLA                     TRONCO                        ÚLTIMA MILLA
 tu móvil ──▶ alguien/algo      ──▶ Internet (relés SENDA      ──▶ algo/alguien ──▶ móvil del
 con Internet                       federados entre países)        con Internet      destinatario
 (Bluetooth de móvil en móvil,                                     (igual que la primera milla)
  Wi-Fi de una gasolinera, un
  Punto SENDA, SMS, LoRa…)
```

- El mensaje se cifra **una vez**, en tu móvil: ECDH P-256 → HKDF-SHA-256 → AES-256-GCM, con firma ECDSA P-256.
  Nadie en medio (móviles, relés ni operadores) puede leerlo ni modificarlo.
- Si en tu lado **no hay nada**, ni móviles SENDA ni red ni Wi-Fi ni satélite, el mensaje **espera guardado y
  cifrado** en tu móvil (7 días para un mensaje normal en la app; el formato admite hasta 90) y sale en cuanto aparece cualquiera de las vías. Esto es tolerancia a
  desconexión (DTN), no magia: **mientras no haya ningún medio físico, no se mueve**.

## 2. La escalera (lo que hace la app, en este orden)

| # | Vía | Tramo | Automática | Estado | Código |
|---|---|---|---|---|---|
| 1 | **Relés SENDA federados por Internet**: en cuanto el móvil tiene Internet (datos propios, itinerancia o la Wi-Fi de una gasolinera, un bar, una biblioteca o un Punto SENDA), sube **todo lo cifrado que lleva, suyo y ajeno**, y baja lo suyo. Los relés se pasan los mensajes entre ellos. | Tronco + primera y última milla | **Sí**: al ganar red, cada 60 s y al enviar | **FALTA DESPLEGAR** (decisión del fundador, §6) | `packages/senda-relay/server.mjs`, `packages/senda/src/relay-client.mjs` |
| 2 | **De móvil en móvil (DTN)**: Bluetooth entre móviles SENDA. Cada móvil que acepta «transportar» guarda copias cifradas que no puede leer y las entrega al cruzarse con otro. Basta con que **uno** de la cadena toque Internet para que entre en el tronco (vía 1). | Primera y última milla | Al abrir el buzón Bluetooth y pulsar Bluetooth (Android) | **FUNCIONA** | `bundle.mjs` (spray-and-wait), `BleMailbox` en el APK |
| 3 | **Otra app**: el mensaje cifrado viaja como archivo `.senda` por WhatsApp, Telegram o correo. Esas apps solo ven un archivo que no pueden leer. | Tronco | No: un toque | **FUNCIONA** | `exportBundleFile` |
| 4 | **SMS** (`SENDA:` + base64): con cobertura móvil, aunque no haya datos. Solo texto; una foto no cabe. | Tronco | No: un toque | **FUNCIONA** | `packEnvelope` |
| 5 | **Punto SENDA**: un móvil Android antiguo, enchufado y con la Wi-Fi de un negocio o de un ayuntamiento que **acepta** prestarla. Tiene la app abierta, el buzón Bluetooth abierto y el relé configurado: recoge por Bluetooth lo que traen los móviles que pasan y lo sube solo al relé. Es la versión legal de «usar la gasolinera o el aerogenerador»: **el dueño lo instala porque quiere**. | Primera y última milla | Sí | **FUNCIONA con el código actual**, sin probar en un local real | App + vía 1 |
| 6 | **LoRa / Meshtastic con pasarela MQTT**: nodo LoRa por Bluetooth al móvil. En la UE se usa la banda ISM de 868 MHz, con ciclo de trabajo limitado. Un mensaje cifrado de 200 caracteres no cabe en una trama y hay que trocearlo (`erasure.mjs`). La malla no cruza países por radio: ES y NL solo se unen por MQTT, a través de Internet. | Primera y última milla | — | **ESPECIFICADO** (`courier.mjs`; fuentes en `docs/research/MENSAJE_SIN_RED_ES_NL_2026-11.md` §2) | `courier.mjs`, `erasure.mjs` |
| 7 | **Satélite**: SOS por satélite de Apple o Pixel (**solo emergencias reales**) y mensajería Iridium dedicada (Garmin inReach, RockBLOCK), con dispositivo y suscripción. El SMS por satélite directo al móvil **no está disponible hoy en ES ni NL** según la investigación del 12-11-2026. | Tronco | — | **ESPECIFICADO**; no verificado en vuestros móviles | `courier.mjs` (vías SAT_MESSENGER, IRIDIUM_SBD) |
| 8 | **Sonido** (< 1 m) y **archivo en mano** (Quick Share, USB) | Primera y última milla | No | **FUNCIONA** | `acoustic-modem.mjs` |

**Encontrar camino.** Lo que pediste, «que rebote buscando dispositivos», es la vía 2 unida a la 1:

- Cada sobre nace con 8 copias. Al cruzarse con otro móvil, se le cede la mitad (*spray-and-wait* binario), y así
  no se inunda la red.
- Cualquier móvil que toque Internet lo sube al relé de su país, aunque solo le quede una copia: a un relé se le
  entrega como a infraestructura (`infrastructure: true`).
- Los relés lo reparten entre países (federación).
- El primer móvil del otro lado que tenga Internet, o el propio destinatario, lo baja.
- Cuando el destinatario lo abre, emite un **recibo infalsificable** (`ackSecret`). Ese recibo viaja de vuelta por
  el mismo camino y **borra las copias** que siguen en tránsito en móviles y relés.

## 3. Prueba de que funciona (medido, no prometido)

| Prueba | Qué demuestra | Resultado |
|---|---|---|
| `packages/senda-relay/tests/long-distance.test.mjs` | Ana (SE) sin red → Bluetooth → Bo (SE) gana Internet → relé SE ⇄ relé NL ⇄ relé ES → Hermano (ES) abre texto de 200 caracteres + imagen de 10 KB. El recibo vuelve hasta Ana y borra las copias de Bo y de los relés. Ningún relé ve el texto. | 4/4 en verde |
| La misma prueba | Una copia sola también sube al relé y el transportista la conserva para entregarla en mano. | Verde |
| La misma prueba | Con un relé caído, basta con otro. Lista de relés: solo `https` (o `localhost`) y sin credenciales en la URL. | Verde |
| La misma prueba | Sincronización automática: espera sin red, reintenta con retroceso 2→4→8 s (tope configurable) y vuelve al intervalo tras un éxito. | Verde |
| Navegador real (Chromium, Pixel 7 emulado, dos móviles), relés locales SE⇄ES federados cada 2 s | Mensaje con foto de 4 KB cifrada (sobre de 4 488 B). Entregado sin que el receptor envíe nada: el registro de B marca `RECIBIDO vía relé, latencyMs 2032, withImage: true`. | **2,0 s en localhost**. No representa la latencia real entre países, que dependerá del servidor y de las redes. |

## 4. «Pasarelas» que NO se pueden usar (y por qué)

| Idea | Por qué no |
|---|---|
| **Radar meteorológico** | Emite pulsos y escucha su eco; no recibe ni reenvía datos de terceros. Además, es infraestructura estatal (AEMET, KNMI, SMHI). No hay forma técnica ni legal de usarlo como enlace. |
| **Aerogenerador, gasolinera, antena o cualquier equipo ajeno sin permiso** | Sus redes (SCADA, TPV, routers) son privadas. Entrar sin autorización es un delito de acceso ilícito a sistemas de información en toda la UE (Directiva 2013/40/UE). La vía legal es la 5: el dueño **instala** un Punto SENDA o **ofrece** su Wi-Fi. |
| **Radioaficionado (APRS, HF)** con mensajes cifrados | Prohibido cifrar entre estaciones de aficionado de distintos países (Reglamento de Radiocomunicaciones de la UIT, art. 25.2A). Solo sirve para mensajes públicos firmados, que no son privados. |
| **Redes de localización de Apple/Google** («Send My», 2021) | Usa dispositivos ajenos que no ofrecen ese servicio y vulnera sus condiciones de uso (ver `courier.mjs`). |
| **Red móvil sin SIM** | Solo permite llamadas al 112. No transporta datos de una app. |

## 5. Qué ve cada intermediario

- **Móvil que transporta:** destino (huella), caducidad, prioridad y tamaño. No ve el texto, la foto ni el remitente.
- **Relé:** lo mismo, más la IP de quien sincroniza (es un servidor HTTP; el código solo la usa en memoria para
  limitar a 120 peticiones por minuto y no la escribe en disco). La prueba E2E comprueba que el texto no aparece en
  el almacén de ningún relé.
- **WhatsApp/SMS (vías 3 y 4):** un bloque cifrado.

## 6. Lo que falta para que funcione entre países fuera del laboratorio (decisión del fundador)

1. **Alojar al menos un relé** con HTTPS. Mejor dos en países distintos, federados con `PEERS`. El código y el
   `Dockerfile` están listos; no hay servidor en marcha. No se ha contratado nada (regla: sin gasto nuevo sin
   preguntar).
2. **Añadir el dominio del relé** a `connect-src` de `investor-next/vercel.json` y a `NetAllow.java` del APK.
   Hoy la app en producción **bloquea** cualquier relé no listado, por seguridad.
3. **Configurar por defecto** la lista de relés en la app, para que nadie tenga que escribirla.

Hasta entonces, para la prueba del fin de semana valen las vías 3 (Otra app) y 4 (SMS) a distancia, y la 2 y la 8
de cerca (ver `docs/campo/GUIA_PRUEBAS_MENSAJES_FIN_DE_SEMANA.md`).

## 7. Registro de pruebas

Cada sincronización con un relé queda en el registro exportable (Transferir → 🧪 Registro de pruebas):

- `RELE_SINCRONIZADO` / `RELE_FALLO`, con `relay` (host), `uploaded`, `downloaded`, `bytesUp`, `bytesDown`,
  `rttMs` y `error`;
- `RECIBIDO`, con `via: "relé"` y `latencyMs`.

---
*Registro de cambios* · 27-11-2026 · Relés federados (`PEERS`), cliente en 2 rondas con varios relés, sincronización
automática, entrega a infraestructura con 1 copia y prueba E2E SE→NL→ES. Firma: Claude (sesión de orquestación SENDA).
