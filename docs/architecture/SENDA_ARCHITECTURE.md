# SENDA · Arquitectura e infraestructura (v0.6 · 04-11-2026)

> **Entrada → Procesamiento → Validación → Salida.** Este documento describe qué pieza hace qué,
> quién confía en quién, por dónde viajan los datos, cómo se despliega cada componente y cómo se
> verifica. Está escrito para que cualquier persona (o agente) pueda retomarlo sin contexto previo.

## 1. Componentes

```
                ┌──────────────────────── packages/senda/src (núcleo, JS puro, sin dependencias) ────────────────────────┐
                │ envelope (ECDH+AES-GCM, recibos) · bundle (DTN, alertas difundidas) · router · ladder · zones · seismic │
                │ roles (organismo, credenciales, códigos) · remote-command (alertas firmadas, respuestas, cuadro)        │
                │ building-twin (EMS-98, routers, personas) · beacon (trama BLE, barrido JSONL, enlace nativo)           │
                │ acoustic-modem · rubble · through-wall · rail-incident · orbital · feeds                                │
                │ erasure (k-de-n GF256) · bearers (portadores + plan exacto) · satellites · blackout · drone · interop   │
                └───────────────┬───────────────────────────┬───────────────────────────────┬────────────────────────────┘
                                │ sync-web (copia literal)   │ import                         │ mismos vectores de prueba
              ┌─────────────────▼──────────────┐ ┌──────────▼───────────┐   ┌────────────────▼───────────────┐
              │ SENDA Campo (PWA, /senda)      │ │ Relé (@senda/relay)  │   │ SENDA Android · ESP32           │
              │ app · coord · organismo ·      │ │ POST /sync, /health  │   │ baliza BLE · escucha · barrido  │
              │ incidente · edificios · estado │ │ Docker, sin deps     │   │ Wi-Fi → JSONL                   │
              │ service worker + IndexedDB     │ └──────────────────────┘   └────────────────────────────────┘
              └────────────────────────────────┘
```

| Componente | Ruta | Despliegue | Verificación |
|---|---|---|---|
| Núcleo | `packages/senda/src` | Se copia a la web (`npm run sync-web`) y lo importa el relé | `node --test packages/senda/tests/*.test.mjs` |
| App de campo (PWA) | `investor-next/public/senda/*` | Vercel (`/senda`), instalable, abre sin red | `investor-next/scripts/senda-offline-e2e.mjs` (Chromium real, red cortada) |
| Herramienta de organismo | `/senda/organismo` | Misma PWA; la clave privada vive solo en ese equipo | E2E (crea organismo, firma credencial) |
| Relé por Internet | `packages/senda-relay` | Contenedor del organismo (`Dockerfile`), detrás de HTTPS | Tests de unidad + E2E + arranque de la imagen en CI |
| SENDA Android | `apps/senda-android` | APK (CI `senda-android-ci.yml`) | Formatos en JVM (14 invariantes) + compilación del APK |
| Accesorio ESP32 | `hardware/esp32-survey` | Firmware Arduino (`esp32:esp32@3.0.7`) | Trama en g++ (mismos vectores) + compilación en CI + autotest al arrancar |


## 1 bis. Capa centralizadora multiportador (v0.6)

```
 mensaje cifrado (envelope)  ──►  erasure.encodeShards(k, n)  ──►  bearers.planMultiBearer()  ──►  tramas por portador
                                   Reed-Solomon GF(2^8), Cauchy       P(≥k) exacta (Poisson-binomial    SMS/D2C: texto «SND1 …» ≤160
                                   cualquier k de n reconstruye       agrupada), coste, latencia,        LoRa/Iridium/QO-100: binario ≤ MTU
                                                                      ley (aficionado = sin cifrar)      vecinos/dron/relé: paquete DTN
 receptor / pasarela  ◄──  createReassembler().add(fragmento, vía)  ◄──  fragmentos de cualquier portador, en cualquier orden
```

| Módulo | Qué hace | Base |
|---|---|---|
| `erasure.mjs` | Fragmentación k-de-n MDS y reensamblado desde cualquier portador | Reed-Solomon sistemático, matriz de Cauchy sobre GF(256) |
| `bearers.mjs` | Registro de portadores (MTU, p, latencia, coste, hardware, acceso, cifrado permitido), plan óptimo y adaptadores de trama | Poisson-binomial agrupada; asignación voraz por ganancia marginal |
| `satellites.mjs` | Redes satelitales por nivel de acceso, con fuentes y estado | Starlink D2C, Skylo, Iridium SBD, QO-100, Cospas-Sarsat/Galileo, EWSS, GOVSATCOM/IRIS², SatNOGS |
| `blackout.mjs` | Previsión de cobertura tras un corte de luz y colocación de pasarelas | Supervivencia Weibull por clase de respaldo; cobertura 1−Π(1−S); voraz submodular ≥(1−1/e) |
| `drone.mjs` | Open Drone ID (ubicación e identificación), misión de fachada QGroundControl, dron mula | ASTM F3411 / EN 4709-002 (disposición según opendroneid-core-c) |
| `interop.mjs` | CAP 1.2 de incidentes y alertas, mapeo EMSI, auditoría encadenada SHA-256 | OASIS CAP 1.2; ISO/TR 22351 (pendiente de validar) |

Pantalla: `/senda/red` (planificador con prueba real de pérdida, catálogo satelital, mapa de apagón, drones y CAP).

## 2. Modelo de confianza (quién puede pedir qué a qué teléfono)

```
Organismo (protección civil, bomberos…)            Coordinador                         Residente / vecino
 crea par ECDSA P-256 (/senda/organismo)            genera su identidad en SENDA Campo   instala SENDA Campo
 publica ANCLA  ── SENDA-ANCLA:… (web, QR, bando) ──────────────────────────────────────▶ la importa (Zona › Organismos)
                ◀── SENDA-SOLICITUD:{nombre, huella de su clave de firma} ──
 firma CREDENCIAL {org, sujeto=huella, rol, unidad, validez}
                ── SENDA-CREDENCIAL:… ──▶ la importa (Coordinar)
                                            firma ALERTA {destino edificio/plantas, acciones,
                                            mensaje, caducidad, reply=su clave pública} ──▶ verifica en el teléfono:
                                                                                         1. ancla conocida y del mismo tipo
                                                                                         2. credencial firmada por el ancla y vigente
                                                                                         3. sujeto = huella de la clave que firma la alerta
                                                                                         4. rol de coordinación (COORD/JEFE/MANDO/INCIDENT)
                                                                                         5. firma de la alerta (incluye reply: no se puede desviar)
                                                                                         6. no repetida ni caducada
                                                                                         7. CONSENTIMIENTO del dueño para órdenes remotas
                                                                                         8. zona declarada o edificio propio
                                                                                         9. va dirigida a su edificio/planta
```

- **Sin consentimiento → se ignora** pero se sigue transportando (el teléfono es mula para los demás). Probado en E2E.
- **Respuesta del residente** (`SAFE/NEED_HELP/TRAPPED/AWAY/NO_RESPONSE`): cifrada extremo a extremo hacia la clave `reply` firmada en la alerta. Sin pulsar nada en 60 s → `NO_RESPONSE` («teléfono activo, dueño no contesta»), nunca «víctima».
- **Cuadro del coordinador**: `aggregateResponses` por edificio/planta/puerta. Con padrón voluntario, quien no aparece tras ≥2 alertas y 10 min → `MISSING_UNCONFIRMED` (desaparecido sin confirmar).
- **Acciones nativas** (baliza BLE, barrido Wi-Fi): la web abre `senda://accion?…`; Android acepta solo una lista blanca y **siempre** espera el toque del usuario (el SO no permite otra cosa y SENDA no lo intenta).

## 3. Flujos de datos

| Flujo | Camino | Qué ve cada intermediario |
|---|---|---|
| Mensaje personal / SOS | sonido (MFSK-16) · archivo `.senda` · código de texto · mula DTN · relé | Cabecera de enrutamiento (destino por huella, caducidad, prioridad). Nunca el contenido. |
| Recibo de entrega | igual que el mensaje, en sentido contrario | Un hash de 16 bytes; solo el destinatario conoce el secreto que lo abre → borra las copias en tránsito. |
| Alerta firmada de coordinación | `broadcasts` del almacén DTN (sin destinatario: la verifica cada teléfono) · relé | Contenido en claro y firmado (es una instrucción pública). Deduplicada, caduca, máx. 200 por teléfono. |
| Respuesta del residente | sobre cifrado al coordinador, prioridad alta si pide ayuda | Solo cabecera. |
| Barrido Wi-Fi / balizas | Android o ESP32 → JSONL → web del coordinador (archivo / compartir) | Local. No sale del equipo del coordinador salvo que él lo comparta. |

## 4. Despliegue

1. **Web**: Vercel, proyecto `civic-relay-investor` (producción en `https://civic-relay-investor.vercel.app/senda`). Service worker en la raíz (`/senda-sw.js`, alcance `/senda`) por las URL limpias.
2. **Organismo**: abre `/senda/organismo` en un equipo controlado, crea sus claves (en producción: HSM o tarjeta) y publica el código de ancla.
3. **Relé** (opcional, recomendado): `docker run -p 8787:8787 -v senda-relay-data:/data -e ALLOWED_ORIGINS=https://… senda-relay` detrás del proxy HTTPS del organismo. Ver `packages/senda-relay/README.md`.
4. **Android**: APK de CI para pilotos; publicación en tienda tras auditoría y DPIA.
5. **ESP32**: firmware desde `hardware/esp32-survey` (Arduino IDE o `arduino-cli`), partición `huge_app`.

## 5. Interoperabilidad y estándares

- Alertas oficiales: CAP 1.2 / EU-Alert (`feeds.mjs`, `zones.mjs`). SENDA es **secundario**: nunca sustituye la alerta oficial y lo etiqueta.
- BLE: anuncio heredado no conectable, *Manufacturer Specific Data*. **Company ID 0xFFFF = pruebas**; un despliegue real necesita su propio identificador del Bluetooth SIG (cambiarlo en `beacon.mjs`, `SendaFormats.java` y `senda_frame.h`; los tests de paridad fallarán hasta que los tres coincidan).
- Edificios: OpenStreetMap (Overpass), daños EMS-98; Catastro INSPIRE como siguiente fuente.
- Criptografía: WebCrypto estándar (ECDSA/ECDH P-256, HKDF-SHA-256, AES-256-GCM). Ver `docs/CRYPTO_ARCHITECTURE.md`.

## 6. Qué está verificado y qué se mide en campo

| Verificado por máquina (CI en cada cambio) | Se mide en piloto de campo |
|---|---|
| Cifrado, firmas, recibos, cadena organismo→credencial→alerta, rechazo de alertas falsas/robadas/repetidas/caducadas | Alcance real de la baliza BLE entre forjados y escombros |
| App completa sin red en 3 navegadores aislados: sonido, archivo, mula, recibos, persistencia, modo viaje, panel ferroviario, gemelo 3D, flujo institucional completo, relé | Precisión del barrido Wi-Fi en edificios reales (el escenario sintético da ±1 planta en el 100 % de los routers) |
| Formatos idénticos web/Android/ESP32 (mismos vectores en JS, Java y C++) | Tiempo hasta el primer «atrapado» localizado en un simulacro |
| Compilación del APK y del firmware; arranque y persistencia de la imagen del relé | Comportamiento de cada fabricante Android con radios y ahorro de batería |

## 7. Registro de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 04-11-2026 | v0.6 | Capa centralizadora: fragmentos k-de-n entre portadores con probabilidad exacta y límites legales; catálogo satelital con fuentes; previsión de apagón y pasarelas óptimas; drones (Open Drone ID, misión QGroundControl); CAP 1.2 y auditoría encadenada; modo fácil y auditoría automática de accesibilidad; portada trilingüe con película. Núcleo 78/78, E2E 23/23. |
| 04-11-2026 | v0.5 | Infraestructura de coordinación: herramienta de organismo, credenciales portables, alertas firmadas difundidas por DTN y relé, respuestas cifradas y cuadro por planta; relé Docker; SENDA Android (baliza, escucha, barrido); accesorio ESP32; formatos compartidos con vectores de paridad; E2E 19/19. |
