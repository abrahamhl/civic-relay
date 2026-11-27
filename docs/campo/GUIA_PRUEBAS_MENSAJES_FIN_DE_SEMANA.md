# Guía de pruebas de campo · mensajes SENDA · fin de semana 29–30-11-2026

Participantes: Abraham (Países Bajos), un amigo (Suecia), el hermano (España) y amigos en la misma ciudad.
Objetivo: comprobar que los mensajes cifrados, con o sin foto, **llegan, se abren solo en el destinatario y quedan medidos**
(cuándo se cifró, por qué camino salió, cuándo llegó y cuánto tardó).

## 0. Lo que hay que saber antes (física, sin adornos)
- SENDA **cifra** el mensaje en tu móvil: ECDH P-256 → HKDF-SHA-256 → AES-256-GCM, con firma ECDSA P-256. Solo lo abre el destinatario.
  Pero el sobre cifrado **necesita un camino** para viajar. La app no puede mover datos sin ningún medio físico.
- **Entre Holanda, Suecia y España, sin ningún móvil SENDA en medio, el mensaje NO puede llegar «sin nada»**: sin internet, sin red
  móvil, sin satélite y sin personas que lo lleven. Ninguna app puede: el Bluetooth llega a decenas de metros y el sonido a menos de un
  metro. Lo que SÍ funciona a esa distancia:
  0. **Automático por Internet (red SENDA, activada por defecto)**: si los dos tenéis Internet (datos o Wi-Fi,
     aunque sea la de un bar), el mensaje llega solo en menos de un segundo en las pruebas y vuelve el «✓✓ entregado». Nadie en medio sabe
     quién escribe a quién. Comprobad en «Transferir → 🌍 Red SENDA» que pone «N/M conectados». Hasta desplegar los servidores SENDA, funciona con los relés públicos (canal adicional).
  1. **Por internet, a través de cualquier app** (WhatsApp, Telegram, correo…). Botón **«Otra app»** del chat o «Compartir paquete».
     WhatsApp solo ve un archivo cifrado que no puede leer.
  2. **Por SMS**, si hay red móvil aunque no haya datos. Solo texto corto. Una foto no cabe en un SMS.
  3. **Por satélite**, solo si vuestro móvil tiene mensajería por satélite en ese país. SENDA lo usaría a través del SMS. No está
     comprobado en vuestros móviles.
  4. **Relé SENDA por internet (automático)**: el código ya sincroniza solo (al ganar red, cada minuto y al enviar) y los relés de
     distintos países se pasan los mensajes entre sí; probado SE→NL→ES en laboratorio. **Todavía no hay un servidor en marcha**
     (decisión pendiente). Definición completa en `docs/red/PASARELAS_SENDA.md`.
- **Sin ninguna red** (modo avión), SENDA funciona **cerca**:
  - Bluetooth (APK de Android en los dos móviles), con un alcance de decenas de metros;
  - sonido, a menos de 1 m;
  - archivo por Quick Share;
  - de mano en mano: un tercer móvil SENDA guarda el sobre cifrado (sin poder leerlo) y lo entrega al encontrarse con el destinatario.

## 1. Preparación (cada persona, 10 min)
1. Instalar la última APK (la que os pase Abraham) y abrir **SENDA → Mensajes** (pantalla de inicio de la app de mensajes).
2. «Crear mi identidad cifrada» con vuestro nombre. Las claves no salen del móvil.
3. **Hora automática activada** en el móvil (Ajustes → Fecha y hora). Si no, las latencias saldrán mal: cada móvil usa su propio reloj.
4. Batería por encima del 50 %, Bluetooth activado y permiso de micrófono concedido (para la prueba por sonido).

## 2. Añadir al amigo (sí: con su código basta)
1. En **Contactos → Mi tarjeta → «📋 Copiar código»**, cada uno copia su código (empieza por `SENDA:`) y se lo manda al otro por
   WhatsApp, correo o en persona.
2. El otro pulsa **Contactos → «📥 Pegar código»** y lo pega. Debe salir **«Contacto añadido: nombre»**.
3. Hacedlo en las dos direcciones: el amigo os añade a vosotros y vosotros a él.
4. Desde ese momento ya podéis escribiros. Pegar el código **no envía nada** solo: añade a la persona y su clave pública.

## 3. Pruebas a distancia (NL ↔ SE ↔ ES)

| # | Qué hacéis | Camino | Qué debe pasar |
|---|---|---|---|
| D0 | Mensaje + foto con **los dos con Internet** (datos o Wi-Fi) | Chat → Enviar. Nada más | Le llega solo en segundos («vía Internet (Nostr · …)») y a ti te sale «✓✓ entregado». Repetidlo con uno sin Internet: le llega en cuanto la recupere |
| D1 | Mensaje de texto (≤ 200 caracteres): «Prueba D1 desde NL» | Chat → Enviar → **Otra app** → WhatsApp o Telegram al amigo | Él guarda el archivo `.senda` que le llega por WhatsApp y en SENDA pulsa «Transferir → Importar paquete». Le aparece en su chat («vía archivo») y en tu móvil queda «✓ en camino» hasta que vuelva su recibo |
| D2 | Mensaje + **foto** (📎 en el chat; se comprime sola a ≤ 12 KB) | Igual que D1 | Le llega la foto dentro de la burbuja. Mirad el tamaño en la vista previa: «… KB cifrados» |
| D3 | Solo texto | Chat → **SMS** (con red móvil, aunque sea sin datos) | Él copia el SMS que empieza por `SENDA:` y lo pega en «Contactos → Pegar código» o en «Transferir → Pegar texto recibido» |
| D4 | Respuesta en sentido contrario (SE → NL y ES → NL) | D1 o D2 | Igual |

## 4. Pruebas cerca y sin red (con amigos en la misma ciudad)

| # | Qué hacéis | Cómo | Qué debe pasar |
|---|---|---|---|
| L1 | Los dos móviles en **modo avión con Bluetooth activado**, a 2–5 m | Transferir → «Abrir mi buzón Bluetooth» en el receptor; en el emisor, chat → **Bluetooth** | Llega en segundos. Repetid a 10, 20 y 40 m y anotad hasta dónde funciona |
| L2 | **Sonido**: móviles a < 1 m, volumen alto | Receptor: «Escuchar»; emisor: «Emitir lo urgente» | Un texto corto tarda unos 30 s. **No mandéis fotos por sonido**: una foto de 4–12 KB tardaría muchísimo |
| L3 | **De mano en mano**: A escribe a C, pero solo se cruza con B; luego B se cruza con C | Bluetooth A→B, y más tarde B→C | B lo transporta sin poder leerlo (aparece en «En camino»); C lo recibe. Lo hace solo si B aceptó «transportar mensajes» al crear su identidad |
| L4 | SOS: botón **SOS** de la pantalla de inicio | Después, enviadlo por un camino (Bluetooth, Otra app, SMS) | Cada contacto que lo reciba lo verá como SOS (burbuja roja). El botón cifra el SOS para todos, pero no lo transmite solo sin red |

## 5. Registrar y enviar los resultados
1. Cada móvil: **Transferir → 🧪 Registro de pruebas → «Exportar registro»**. Se exporta un archivo `senda-registro-…json`, sin el
   contenido de los mensajes. Por cada mensaje incluye:
   - `CIFRADO`: hora de creación, bytes, cifrado usado y tamaño de la foto;
   - `ENVIADO`: camino y bytes;
   - `RECIBIDO`: camino, hora de llegada y **latencia en ms**;
   - `DUPLICADO`: si llegó dos veces.
2. Anotad a mano, en una nota, lo que el registro no puede saber: distancia entre móviles en Bluetooth, si había paredes, modelo de
   móvil y versión de Android.
3. Pasad a Abraham los archivos de registro. Claude los analiza y sale una tabla de latencias por camino y distancia.

## 6. Lo que NO hay que concluir de la prueba
- Que funcione «sin nada» a 1 500 km: eso no se ha prometido y no se puede hacer (apartado 0).
- Latencias exactas al milisegundo: dependen de los relojes de cada móvil, que pueden diferir algunos segundos.
- Fiabilidad estadística: con pocos mensajes son pruebas de funcionamiento, no medidas de rendimiento. Para eso hacen falta decenas por camino.
