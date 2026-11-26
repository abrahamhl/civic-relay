# Práctica de campo del radar de personas · guía para el fundador

App: **APK SENDA Android** (Descargas → `senda-base.apk`) o Chrome/Edge en ordenador → **Radar de personas** (`/senda/personas`).
Protocolo científico completo: `packages/senda/data/mmwave/PROTOCOLO_MEDIDA.md`.

## 1. Qué hace falta
- Módulo **RD-03D** (Ai-Thinker) o **LD2450** (Hi-Link): mismo protocolo.
- Adaptador **USB a serie de 3,3 V** (CH340, CP2102 o FTDI) y, para el móvil, cable o adaptador **USB-OTG** (USB-C macho → USB-A hembra).
- Conexión: **TX del radar → RX del adaptador**, **RX del radar → TX del adaptador**, **GND con GND**.
  Alimentación del radar: la que indique la hoja del fabricante del módulo que compres (**no verificada aquí**; no adivinar).
- Cinta métrica de 5–8 m y cinta adhesiva para marcar 1, 2, 3, 4 y 5 m en el suelo.
- Un soporte fijo para el radar (una caja, un trípode o, cuando exista, la carcasa impresa en 3D).

## 2. En el campo (15 minutos por tanda)
1. Abrir **Radar de personas** → **Conectar radar (USB)**. En el móvil, Android pedirá permiso para el adaptador: aceptar.
2. En **Práctica de campo**, elegir qué se prueba y pulsar **Empezar sesión**.
3. Durante la prueba, **Marcar momento** cuando pase algo (escribir antes la nota: «entra Laura», «perro», «cierra la puerta»).
4. Para calibrar distancia: una persona se balancea suavemente sobre cada marca; escribir la distancia real en **Calibración** y pulsar **Anotar**.
5. **Terminar y guardar**: se crea `senda-campo-<fecha>Z.json` en **Descargas/SENDA** (móvil) o en Descargas (ordenador).
6. Repetir con cada escenario: una persona de frente, de lado, dos cruzándose, persona quieta, detrás de una puerta, perro, sin nadie.

## 3. Enviar los registros
Envía los archivos `senda-campo-*.json` tal cual (chat, correo o una carpeta compartida). **No los edites**: cada uno lleva su
huella SHA-256 y cualquier cambio se detecta. Se analizan con:

```
node packages/senda/scripts/mmwave-field-report.mjs senda-campo-*.json
```

que comprueba la huella, vuelve a pasar los bytes por el mismo código y resume tramas, frecuencia, personas seguidas, momentos marcados
y el ajuste de distancia de la cinta métrica.

## 4. Qué se podrá publicar después
Solo cifras que salgan de estos archivos (`basis: MEASURED`) y pasen la prueba de regresión. Hasta entonces, la web dice
«sin hardware real todavía». Una sesión con la simulación queda marcada `SIMULATION` y nunca cuenta como medida.

## 5. Privacidad
El archivo no guarda nombre, cuenta ni identificador del aparato. La posición solo se guarda si se escribe en «Posición en el mapa».
Las notas las escribes tú: evita nombres completos de terceros.
