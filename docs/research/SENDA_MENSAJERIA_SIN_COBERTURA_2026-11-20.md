# SENDA · Mensajería sin cobertura: el desconocido con datos, el chat familiar y el humo calculado desde casa

**Fecha:** 20-11-2026 · **Autor:** Claude (sesión de ingeniería) para el fundador · **Estado:** implementado y probado en el núcleo (`packages/senda/src`). Todo lo que aparece como *escenario* o *ejemplo* está rotulado así. Ninguna cifra de campo se presenta como medida.

## 0. Qué se pidió y qué NO es SENDA

- **No** sustituye a WhatsApp, Instagram ni Snapchat en el día a día.
- **No** se conecta a ellas ni usa sus servidores.
- **Sí**: cuando esas apps no funcionan porque *tu* móvil no tiene datos ni Wi-Fi, SENDA envía el mensaje por cualquier vía que exista alrededor. La más importante es **el móvil de un desconocido que sí tiene datos y ha aceptado prestar su salida**.
- **Sí**: la experiencia es la que la gente ya conoce: chats, grupos, notas de voz, fotos, ubicación, reacciones, estados de 24 h y tics ✓/✓✓.

El problema, en una frase: *mi hermano no tiene datos, pero alguien en su pueblo sí*. El móvil de mi hermano lo descubre, le entrega el mensaje cifrado y esa persona lo sube a Internet sin poder leerlo.

## 1. Arquitectura en capas

| Capa | Qué hace | Módulo |
|---|---|---|
| Experiencia familiar | Chat, grupos, voz, fotos, ubicación, tics | `familiar-chat.mjs` (nuevo) |
| Sobre extremo a extremo | Firma ECDSA P-256 + ECDH efímero + AES-256-GCM; recibo infalsificable | `envelope.mjs` |
| Sobre exterior + buzón cegado | Oculta incluso la cabecera del sobre y a quién va | `stranger-gateway.mjs` (nuevo) |
| Troceado k-de-n | Reed-Solomon GF(2⁸): bastan k fragmentos cualesquiera | `erasure.mjs` |
| Pasarelas de desconocidos | Baliza, sello de trabajo, cuota, recibo de custodia, reparto óptimo | `stranger-gateway.mjs` (nuevo) |
| Almacenar-llevar-reenviar | Sincronización entre móviles, spray-and-wait, recibos | `bundle.mjs` |
| Portadores | Datos, SMS, satélite D2C, LoRa/Meshtastic, Iridium, sonido, dron… | `bearers.mjs`, `courier.mjs`, `acoustic-modem.mjs` |
| Garantía con fallos correlados | Mezcla exacta de estados de peligro, posterior Beta | `delivery-assurance.mjs` |
| Dispositivos | Drones (MAVLink v2 firmado, Open Drone ID), coches (OBD-II/CAN, Ley de Datos UE), sensores | `sovereign-mesh-kit.mjs`, `drone.mjs`, `vehicle-link.mjs`, `automotive-multisoftware-link.mjs`, `sensor-fabric.mjs`, `platforms.mjs` |
| Ciencia desde casa | Fuego, aire en 3D, pluma y ahora humo en el suelo | `wildfire.mjs`, `atmos3d.mjs`, `smoke-exposure.mjs` (nuevo) |

**Principio universal:** todo lo que mueve bytes es un *portador* con capacidades declaradas (MTU, probabilidad, latencia, coste, si admite cifrado, quién lo controla). Un móvil ajeno con 4G, un coche con módem, un dron o una pasarela LoRa municipal son el mismo objeto para el planificador. Lo que cambia son sus parámetros y su permiso legal.

## 2. La pasarela de un desconocido (`stranger-gateway.mjs`)

### 2.1 Flujo

1. **El desconocido acepta.** Fija su cuota (KB/h), su batería mínima, qué acepta (SOS, personal) y la dificultad del sello. Sin consentimiento no se anuncia nada (`createGatewayPolicy`).
2. **Anuncia una baliza de 18 B** por radio de corto alcance.
   - Contiene: tipo y calidad de salida, batería, cuota restante, qué acepta, ranura de tiempo y un **identificador efímero** que rota en cada ranura (HMAC).
   - Cabe en los 24 B útiles de un anuncio BLE *legacy* (31 B − 3 de flags − 4 de cabecera de fabricante).
   - *Pendiente:* el identificador de compañía o UUID de servicio asignado por el Bluetooth SIG no lo tenemos (no verificado). En Android, la misma baliza puede viajar por Nearby/Wi-Fi Aware.
3. **El móvil sin datos prepara el mensaje:**
   - sobre E2E;
   - sobre exterior AES-256-GCM con clave de la pareja y AAD = buzón;
   - troceado k-de-n.
4. **Entrega fragmentos distintos a pasarelas distintas.** Cada entrega lleva un **sello de trabajo** ligado a *esa* pasarela y *esa* ranura.
5. **La pasarela comprueba** el sello con un solo hash, la cuota, la batería, que no sea un duplicado y que la ranura no haya caducado. Sube el fragmento al buzón y devuelve un **recibo de custodia firmado** (ECDSA P-256 con clave efímera). Ese recibo es el «✓».
6. **El destinatario recoge su buzón** mezclado con *d* buzones señuelo, junta k fragmentos, abre el sobre exterior y luego el E2E. Su recibo E2E es el «✓✓».

### 2.2 Qué ve cada parte (comprobado en la prueba de punta a punta)

| Parte | Ve | No ve |
|---|---|---|
| Desconocido que presta datos | Bytes aleatorios, un buzón de 16 B que cambia cada día, tamaño | Texto, remitente, destinatario, cabecera del sobre interior |
| Servidor de buzones | Lo mismo | Lo mismo |
| Otras pasarelas | Nada de lo que no llevan | — |
| Destinatario | Todo, con firma verificada del remitente | — |

La prueba busca el texto y la huella del destinatario dentro de cada fragmento entregado: **no aparecen**.

### 2.3 Matemática

- **Buzón cegado:** `buzón = HMAC-SHA-256(secreto_pareja, "mbox|destinatario|día")[0:16]`.
  - El secreto de la pareja sale de ECDH P-256 + HKDF con sal = SHA-256 de ambas claves ordenadas, así que es simétrico.
  - Sin el secreto, dos buzones de días distintos no se pueden enlazar (seguridad de HMAC como PRF).
- **Sello de trabajo (hashcash):** hay que encontrar un `nonce` tal que SHA-256(digest‖pasarela‖ranura‖nonce) tenga ≥ b bits iniciales a cero.
  - Intentos ~ Geométrica(2⁻ᵇ), media 2ᵇ. La pasarela verifica con 1 hash.
  - *Medido* (200 sellos de 6 bits): media dentro de [40, 95] frente a 64 teóricos.
  - *Medido en este contenedor* (Node, SHA-256 en JS puro): ≈ 66 000 hash/s, así que 12 bits ≈ 0,06 s, 16 bits ≈ 1 s y 20 bits ≈ 16 s. En móviles: **no medido**.
  - Dificultad: b = base + ⌈bytes / bytesPorBit⌉, y `sosBits` para SOS. Todo lo declara quien presta la conexión.
- **Reparto k-de-n entre pasarelas:** P(≥k fragmentos subidos) es una Poisson-binomial agrupada exacta (`bearers.mjs`).
  - El optimizador enumera todos los repartos si son ≤ 20 000 (**óptimo exacto**). Si no, usa multiarranque + búsqueda local.
  - *Hallazgo medido:* la asignación codiciosa sola se queda en óptimos locales. En 1 500 instancias aleatorias la brecha máxima fue 0,17 (caso k = n), y por eso se usa el exacto siempre que se puede. La prueba compara 200 instancias con la enumeración: brecha 0.
  - *Ejemplo:* 3 pasarelas con p = 0,9 / 0,7 / 0,6, k = 3, n = 6. **Repartir da 0,970** (3+3); la mejor pasarela sola da 0,90.
- **Causa común:** si todas las pasarelas cuelgan de la misma antena (p_antena declarada), se hace una mezcla exacta sobre los 2^K estados de los K tipos de salida.
  - *Comprobado:* con dos pasarelas 4G y antena al 50 %, P ≤ 0,5.
  - Mezclar 4G con el Wi-Fi de un bar la supera. **Diversificar el tipo de salida importa más que el número de pasarelas.**

### 2.4 Física del descubrimiento

- **Pérdida en espacio libre:** FSPL(dB) = 20·log₁₀ d + 20·log₁₀ f − 147,55. A 2,44 GHz y 1 m son 40,2 dB (comprobado en prueba).
- **Alcance** con modelo log-distancia, PL(d) = FSPL(1 m) + 10·n·log₁₀ d, y un presupuesto de enlace de 90 dB (0 dBm de emisión y −90 dBm de sensibilidad, *valores de escenario*):

| Exponente n | Pérdida extra | Alcance |
|---|---|---|
| 2 (espacio libre) | — | 309 m |
| 3 | — | 46 m |
| 3 | +10 dB (una pared) | 21 m |

  **El alcance real depende del entorno mucho más que del teléfono.** Por eso n y las pérdidas se declaran y se calibran midiendo.
- **Descubrimiento BLE** (aproximación de primer orden): E[T] ≈ intervalo_anuncio / (ventana/intervalo de escaneo). Con 100 ms de anuncio y un 10 % de ciclo de escaneo sale ≈ 1 s. Ignora el salto entre los 3 canales y el retardo aleatorio del estándar.
- **Pasarelas al alcance** como proceso de Poisson espacial de intensidad ρ·φ:
  - P(≥1 ahora) = 1 − e^(−ρφπr²);
  - si nos movemos a velocidad v respecto a ellas, entran pasarelas nuevas a ritmo 2rvρφ.
  - La simulación Monte Carlo reproduce la mediana teórica ln2/ritmo con error < 6 % (prueba).

**Escenarios de ejemplo** (EJEMPLO_DECLARADO, sin fuente; 5 % de personas con SENDA, datos y consentimiento; k = 3 de n = 6, 2 fragmentos por pasarela, entrega con éxito al 80 %):

| Escenario | P(≥1 ya) | Pasarelas nuevas/h andando | Mediana hasta salir | p90 | P(< 6 h) |
|---|---|---|---|---|---|
| Pueblo, 60 hab/km², alcance 40 m | 1,5 % | 1,0 | 2,0 h | 4,7 h | 95,7 % |
| Pueblo con una pasarela de alcance 120 m (bar, ayuntamiento) | 12,7 % | — | 0,63 h | 1,5 h | 100 % |
| Ciudad, 5 000 hab/km², alcance 40 m | 71,5 % | 86 | 32 s | 149 s | 100 % |

**Conclusión de ingeniería:** en un pueblo, lo que convierte horas en minutos no es la app, son **unas pocas pasarelas fijas con buen alcance**: el Wi-Fi del bar o del ayuntamiento, una pasarela LoRa municipal, el coche de protección civil. El alcance entra al cuadrado. Es la recomendación concreta para un piloto municipal.

### 2.5 Abusos y su respuesta

| Abuso | Defensa | Prueba |
|---|---|---|
| Inundar a la pasarela | Sello ligado a pasarela y ranura + cuota por hora | `BAD_STAMP`, `QUOTA` |
| Reutilizar un sello en otra pasarela | El sello incluye el identificador efímero de la pasarela | `BAD_STAMP` |
| Repetir un blob | Registro de huellas | `DUPLICATE` |
| Sello viejo | Ranura actual o anterior | `STALE_SLOT` |
| Agotar la batería de quien ayuda | Batería mínima declarada; por debajo, ni se anuncia | `LOW_BATTERY` |
| Pasarela que tira los datos | Troceado k-de-n entre pasarelas independientes + reintento si no llega el «✓✓» | Probabilidad exacta |
| Seguir a quien presta su conexión | Identificador efímero que rota | Prueba de rotación |
| Saber a quién escribe alguien | Buzón cegado diario + señuelos al recoger: P(acertar) = 1/(d+1) | Prueba |

**Legalidad:** quien presta su conexión usa *su* plan de datos con *su* consentimiento y *su* cuota. No se usan redes ajenas que no ofrezcan ese servicio; `courier.mjs` ya excluye las redes de localización de Apple y Google por sus condiciones de uso. Queda **por revisar con un jurista** la responsabilidad de quien presta la salida si un tercero la usa para contenido ilícito: el contenido es opaco para esa persona, pero la revisión jurídica no está hecha.

## 3. El chat familiar (`familiar-chat.mjs`)

### 3.1 Lo mismo de siempre, con tics que se pueden comprobar

| Tic | Significado | Prueba criptográfica |
|---|---|---|
| 🕓 | Sellado en tu móvil | — |
| ✓ | Alguien lo custodia | Recibo firmado de la pasarela (`verifyCustodyReceipt`) |
| ✓✓ | Entregado | Secreto de acuse que solo conoce el destinatario (`envelope.mjs`) |
| ✓✓ azul | Leído | Recibo cifrado, solo si el destinatario lo activa |

Los tics solo avanzan: un recibo tardío no hace retroceder un ✓✓.

### 3.2 Escalera de medios: una foto por LoRa

Se ha implementado un **códec de miniaturas real**:
- reducción por cajas;
- YCbCr BT.601 con submuestreo 4:2:0;
- cuantización uniforme; la crominancia usa 2ᵇ−1 niveles para que el gris neutro sea representable (sin eso, negros y blancos salían azulados: fallo encontrado y corregido con su prueba).

La miniatura elegida es la que **mejor se ve medida** entre todas las que caben, no la más grande. La calidad se mide con PSNR frente a una referencia común de 64 px, así que todos los escalones se miden con la misma vara.

*Medido sobre una foto real* (`fotos/dana-voluntarios.jpg`, voluntarios de la DANA, reducida a 640×360):

| Presupuesto | Miniatura elegida | Bytes | PSNR (ref. 64×36) |
|---|---|---|---|
| 4 000 B | 64×36, Y6/C4 | 2 308 | 30,8 dB |
| 1 000 B | 48×27, Y4/C3 | 904 | 24,1 dB |
| 500 B | 40×23, Y3/C2 | 469 | 22,5 dB |
| 200 B | 24×14, Y3/C2 | 172 | 20,3 dB |
| 100 B | 16×9, Y3/C2 | 78 | 19,0 dB |

*Medido:* el sobre E2E completo añade **314 B** (`packEnvelope` de un cuerpo de 10 B). Por eso una foto por Meshtastic necesita **dos tramas de 200 B**: sobre + miniatura de unos 86 B. Para contactos emparejados, el modo compacto de `courier.mjs` añade solo 25 B (9 de cabecera y 16 de etiqueta GCM).

**La foto completa queda en cola y se completa cuando aparece una vía mejor.** Es lo que la gente ya conoce como «vista previa borrosa → foto».

### 3.3 Notas de voz

Tasas publicadas: Codec2 de 700 (modo 700C) a 3 200 bit/s; Opus de 6 a 510 kbit/s (RFC 6716).

| Nota de voz | Opus 16 kbit/s | Opus 6 kbit/s (mínimo) | Codec2 700C |
|---|---|---|---|
| 10 s | 20 000 B | 7 500 B | 875 B |

Con 200 B solo caben 2 s, y la app lo dice y propone dictar texto. El códec lo aporta la app (libcodec2 o libopus). Aquí se decide **qué cabe**, no se comprime audio.

### 3.4 Grupos y cola

- **Grupo de 8 personas, 10 mensajes de 60 B:**
  - sobre por miembro: 26 180 B;
  - clave de remitente: 6 162 B (4,2× menos);
  - la clave de remitente gana a partir del 2.º mensaje.
- **Cola por ventana** (p. ej. el ciclo de trabajo de LoRa): mochila 0/1 exacta por programación dinámica, comparada con fuerza bruta en 100 instancias. Los valores de prioridad (SOS ≫ texto > voz > foto > estado) son una **política declarada**, no un dato.
- **Ubicación** en 8 B con resolución de 1e-7° (error < 1 cm).

## 4. El humo en el suelo, calculado desde casa (`smoke-exposure.mjs`)

**Modelo:** penacho gaussiano estacionario con reflexión en el suelo (Turner 1970), σy y σz de Briggs (1973) para terreno rural y clase de estabilidad de Pasquill–Turner.

**Comprobación física:** el flujo de masa a través de cualquier plano vertical, ∬u·C dy dz, es igual a la emisión Q con error < 0,2 %. Se ha comprobado en las 6 clases y a 300 m, 2 km y 8 km.

**Aplicación a San Martín de Valdeiglesias (23-07-2026)** con datos que SENDA ya tiene: altura final de la pluma 1 880 m (Briggs, `fire3d.json`), viento de la capa de mezcla 9,8 m/s hacia 61°, viento a 10 m de 20,6 km/h con insolación fuerte (clase C).

| Fase | H | Viento | Clase | Máximo en el suelo por cada g/s emitido |
|---|---|---|---|---|
| Llamas, de día | 1 880 m | 9,8 m/s | C | 2,3·10⁻⁵ µg/m³ (a 10 km, límite de validez) |
| Rescoldo, de noche (escenario: H = 100 m) | 100 m | 1,9 m/s (21Z del GFS) | F (extensión no tabulada, rotulada) | 0,64 µg/m³ (a 10 km) |

- **Hallazgo:** el humo del rescoldo nocturno llega al suelo unas **28 000 veces más** por gramo emitido que el de la fase de llamas, cuya pluma se queda arriba.
- **Consecuencia para alertar:** el aviso de calidad del aire tiene que mirar la **noche y el rescoldo**, no solo la columna visible de día. Es lo que se suele observar en valles con humo nocturno; aquí sale de la física del modelo y no se ha validado con estaciones de San Martín.
- **Emisión Q** = consumo de combustible × factor de emisión (g/kg).
  - El consumo se obtiene de la intensidad de Byram, I/H·L: con I = 9 794 kW/m y frente de 2 000 m (salida de SENDA), y H = 18 000 kJ/kg como *escenario*, salen ≈ 1 088 kg/s.
  - **El factor de emisión no lleva valor por defecto:** depende de la vegetación y de la fase de combustión (p. ej. Andreae 2019) y se declara.
- **Umbral:** guía de la OMS de 2021 para PM2.5, 15 µg/m³ como media de 24 h.
- **Límites (rotulados en la salida):** terreno llano (San Martín no lo es), viento uniforme, sin deposición ni química, validez de las curvas de Briggs hasta unos 10 km. Sirve para decidir **dónde mirar y a quién preguntar**: estaciones, sensores de bajo coste, la malla de verificadores. No sustituye a un modelo operativo.

## 5. Qué queda por hacer (con el bloqueo exacto)

| Pendiente | Bloqueo |
|---|---|
| Anunciar la baliza en móviles reales (Android BLE / Nearby; iOS en segundo plano) | App nativa; identificador asignado por el Bluetooth SIG (no verificado) |
| Medir alcance, exponente n y probabilidades de entrega en el pueblo | Ensayo de campo |
| Codec2 en la app | Integrar libcodec2 (LGPL) en Android/iOS |
| Factor de emisión PM2.5 por tipo de vegetación | Fuente bibliográfica verificada (no consultada en esta sesión) |
| Revisión jurídica de quien presta su conexión | Jurista |
| Malla de verificadores conectada a la pasarela | Unir `drive-autostart.mjs` + `stranger-gateway.mjs`: el coche como pasarela móvil (su módem como salida `VEHICLE`) |

## 6. Cómo comprobarlo

```bash
node --test packages/senda/tests/stranger-gateway.test.mjs packages/senda/tests/familiar-chat-smoke.test.mjs
```

Son 20 pruebas nuevas:
- la de punta a punta (hermano sin datos → dos desconocidos → buzón → abierto);
- los abusos rechazados;
- el óptimo exacto frente a la enumeración;
- la causa común;
- la física y la simulación frente a la teoría;
- el códec de miniaturas y la escalera monótona;
- la sobrecarga real del sobre;
- voz, tics, grupos y mochila frente a fuerza bruta;
- la conservación de la masa del humo, Pasquill–Turner, la reflexión y la exposición por dirección del viento.

**Confianza:** 90 % en lo implementado y probado. Lo que baja la cifra es lo que no se ha medido en campo, que está rotulado arriba como pendiente.
