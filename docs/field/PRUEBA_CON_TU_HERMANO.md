# SENDA · Prueba real con otra persona (sin SIM ni Internet)

**Fecha:** 2026-11-10 · **Para:** probar SENDA hoy con un familiar, sabiendo qué esperar.

## 1. Lo primero: qué es físicamente posible

Un móvil sin SIM y sin Internet **solo puede hablar con algo que esté al alcance de su propia radio o de su altavoz**:

| Canal | Alcance real | ¿Hace falta algo más? | Estado en SENDA |
|---|---|---|---|
| **Sonido** (el móvil «pita» datos) | 1–5 m | Nada | ✅ Funciona hoy (`/senda`, modo sonido) |
| **Código o archivo** (QR, copiar y pegar, archivo `.senda`) | En mano | Nada | ✅ Funciona hoy |
| **Wi-Fi local sin Internet** (punto de acceso de un móvil o router sin conexión) | 10–50 m (una casa o un edificio) | Que un móvil cree un punto de acceso, aunque no tenga datos | ✅ Funciona hoy: chat y **llamada de voz** en `/senda/llamada` |
| **Bluetooth / Wi-Fi Direct entre móviles** | 10–100 m | App nativa Android (no navegador) | 🟡 Prototipo Android; falta probarlo con dos teléfonos |
| **LoRa (Meshtastic)** | **2–10 km** en campo abierto; más con nodos repetidores | Un nodo LoRa de ~30–40 € por persona, unido al móvil por Bluetooth | 🔴 Pendiente: falta el puente SENDA ↔ Meshtastic por Web Bluetooth (siguiente tarea) |
| **Satélite directo al móvil** | Global | Móvil compatible + operador. **Apple y Google no dejan que apps de terceros lo usen** | ⛔ No disponible para SENDA hoy |
| **Llamar al 112 sin SIM** | Donde llegue la antena de **cualquier** operador | El estándar lo permite, pero **cada país decide**; varios lo han desactivado por las llamadas falsas | ⚠️ **Por verificar en España** antes de afirmarlo. Con SIM, el 112 funciona con la antena de cualquier operador |

**Conclusión honesta:** si tu hermano está **en otra ciudad** y entre medias no hay ningún móvil, nodo LoRa, antena ni satélite que haga de puente, **no hay física que permita que el mensaje llegue**. Ninguna app del mundo puede hacerlo. Lo que hace SENDA es **aprovechar cualquier puente que exista**, combinarlos y guardar el mensaje hasta que aparezca uno. Por eso la prueba tiene tres niveles.

## 2. Prueba A — en la misma casa (hoy, sin comprar nada)

1. Los dos abrís **Chrome en Android** (en iPhone, Safari también vale para A1 y A2) en `https://civic-relay-investor.vercel.app/senda` **con Internet**, y pulsáis «Instalar» o «Añadir a pantalla de inicio». Así la app queda guardada para funcionar sin red.
2. Quitad la SIM o activad el **modo avión** (y dejad el Wi-Fi apagado de momento).
3. **A1 · Sonido:** escribe un mensaje → «Enviar por sonido». Acerca tu móvil a menos de 1 m del suyo, que debe estar en «Escuchar». En 8–10 s le aparece el mensaje. Él responde igual.
4. **A2 · Código:** «Copiar código» → enséñaselo o mándaselo como foto o QR → él lo pega o escanea.
5. **A3 · Llamada y chat por Wi-Fi local:**
   - Tú activas el **punto de acceso** de tu móvil (en Android funciona aunque no tengas SIM; en iPhone puede exigir operador, así que mejor que lo cree el Android) y tu hermano se conecta a él.
   - Los dos abrís `/senda/llamada`. Uno pulsa «Llamar» y la conexión se intercambia **por sonido** o con un código corto.
   - Podéis hablar y escribiros por toda la casa **sin Internet, sin operador y sin servidor**.

**Qué demuestra:** mensajería cifrada y voz sin red. **Qué no demuestra:** alcance de kilómetros.

## 3. Prueba B — en la misma calle o edificio (cuando esté la app Android)

Bluetooth y Wi-Fi Direct desde la app nativa: de 10 a 100 m. Si hay un tercer teléfono SENDA entre vosotros, el mensaje **salta** a través de él. El protocolo de prueba con 2 y 3 teléfonos está en `docs/field/` (misión L3 de Antigravity).

## 4. Prueba C — a kilómetros, sin SIM (con dos nodos LoRa)

1. Comprad **dos nodos Meshtastic**: por ejemplo, Heltec V3 o LilyGO T-Beam, de ~30–40 € cada uno, en la banda **EU_868**.
2. Cada uno empareja su nodo con su móvil por Bluetooth (configuración inicial con la app oficial de Meshtastic).
3. Cuando esté el puente SENDA ↔ Meshtastic, SENDA enviará sus mensajes cifrados en fragmentos por LoRa. Con línea de vista se alcanzan varios kilómetros; con un nodo en un sitio alto (un tejado), bastante más.
4. Respetar el límite legal de la banda: **10 % de tiempo de emisión** en la sub-banda que usa Meshtastic en Europa.

## 5. Modo usuario y modo administrador

- **Tu hermano (modo usuario):** recibe mensajes y alertas y contesta con los botones grandes («Estoy bien», «Necesito ayuda», «Estoy atrapado»).
- **Tú (modo administrador o 112):** con una **credencial institucional firmada** (`roles.mjs`) puedes:
  - Ver la **superficie** de una zona (`area-activation.mjs`): teléfonos SENDA en agregado, cámaras públicas, tráfico, población, satélites, GDACS y meteorología.
  - Enviar una **orden firmada** a los teléfonos de la zona (`remote-command.mjs`): sirena, baliza, informe de sensores, evacuación.
  - En la prueba con tu hermano, tú harías de «organismo» con una credencial de pruebas. **Cada teléfono comprueba la firma, la zona y su propio consentimiento antes de obedecer.**

## 6. Sobre la «reserva de 1 GB»

Ya existe (`/senda/reserva`, 1.024 MB por defecto). Mientras hay Wi-Fi, guarda lo que necesitarás sin red: mapas, plan de emergencia, albergues, últimas órbitas de satélites, contactos y documentos cifrados. Elige qué guardar con un cálculo óptimo según su utilidad y su caducidad. Sin red, la app responde desde la reserva, y lo que haya que enviar se guarda hasta la primera ventana de conexión.

**Límite físico:** un giga guardado **no se convierte en cobertura**. Los bytes almacenados no crean una antena. Lo que sí convierte «reserva» en conexión real:
1. **Datos de emergencia pactados con operadores**: un saldo o eSIM de emergencia, o itinerancia nacional en catástrofes. Requiere convenio comercial y regulatorio.
2. **Vecinos que comparten su conexión**: un móvil con cobertura hace de puente para los de alrededor (punto de acceso o malla SENDA).
3. **Mensajes por satélite prepagados**: por ejemplo, créditos de Iridium SBD con un accesorio.

## 7. Qué no hará SENDA (y por qué)

- **Activar un coche ajeno o leer los sensores de un aerogenerador «rebotando» una señal:** un pulso de radio que rebota da **distancia y movimiento** (así funciona un radar), **no** las lecturas internas del aparato. Entrar en un sistema ajeno es acceso no autorizado (art. 197 bis del Código Penal). Los datos de coches y aerogeneradores llegan **por convenio** con el fabricante u operador, o con el consentimiento del usuario (Ley de Datos de la UE). SENDA ya tiene preparados esos conectores.
- **Mostrar a cada usuario en el mapa**, como hace Waze: SENDA solo usa recuentos agregados (≥ 5 dispositivos por celda).
