# Prompt 03 · Voz y subtítulos

```text
Eres el responsable de voz y subtítulos de SENDA. Ejecuta este encargo antes de publicar cualquier vídeo.

OBJETIVO
Conseguir una voz inglesa limpia y tres subtítulos correctos (es, en, nl) con los mismos tiempos, sin cambiar el significado ni usar la fonética de `_say`.

PASO 1 · VOZ
1. Usa Kokoro-ONNX 0.6.1 con `bf_emma` (en-GB), velocidad 0,95.
2. No cambies de voz sin aprobación.
3. Tono: calmado, competente, sin épica publicitaria.
4. Ritmo: 145–155 palabras por minuto.
5. Pausa entre frases: 350 ms.
6. Escribe en `en_say` los números y siglas como se pronuncian:
   - 112 → one one two
   - DGT → D G T
   - DATEX II → DATEX two
   - QO-100 → Q O one hundred
   - LoRa → LOR-ah
   - PCI → P C I
   - DTN → D T N
   - km/h → kilometres an hour
   - m/s² → metres per second squared
   - SENDA → Senda
7. No pongas `→`, `²`, `%` ni `≤` en `en_say`.
8. Verifica que no hay frases cortadas, clipping ni saltos.

PASO 2 · CAMBIO DE CÓDIGO OBLIGATORIO
En `media/senda-film/voice.py`:
1. En la pasada `lang == "en"`, además de `subtitles-en.vtt`, genera `subtitles-es.vtt` y `subtitles-nl.vtt` con los mismos tiempos de la voz inglesa.
2. Usa `sc[lang]` para el texto del subtítulo; nunca `sc[lang + "_say"]`.
3. Si falta `es` o `nl` en una escena, falla cerrado con un mensaje claro.
4. No generes VTT ingleses desde la pasada española.
5. Mantén el nombre base que espera `publish.sh`.

En `media/senda-film/validate.mjs`:
1. Para `m95-film.json`, exige `en`, `es`, `nl`, `en_say` y títulos en los tres idiomas.
2. Comprueba que ninguna frase de subtítulo sea el texto fonético.
3. Comprueba longitud y que no haya escenas sin los tres idiomas.

En `media/senda-film/publish.sh`:
1. Copia los tres VTT de la pasada inglesa.
2. Comprueba que existen y que empiezan por `WEBVTT`.
3. No sobrescribe los vídeos antiguos.

Añade un verificador `check-vtt.mjs` o equivalente que compruebe:
- primera línea `WEBVTT`;
- timestamps crecientes;
- sin solapamientos;
- sin cues vacíos;
- duración 0,8–7 s;
- máximo 2 líneas y 42 caracteres por línea;
- velocidad de lectura ≤ 20 caracteres/s.

PASO 3 · TRADUCCIÓN
1. Bloquea el guion inglés y los tiempos.
2. Traduce es y nl desde el texto de subtítulo, no desde la fonética.
3. Español de España, natural.
4. Neerlandés estándar.
5. Inglés UK: organisation, metres, kilometres, centre.
6. Mantén sin traducir: 112, DGT, Guardia Civil, ES-Alert, NL-Alert, DATEX II, PCI, DTN, Reed-Solomon, QO-100, LoRa, Iridium.
7. Glosario:
   - kilómetro point → kilometre point / hectometerpaal
   - cruz roja sobre el carril → red cross over the lane / rood kruis boven de rijstrook
   - pasillo → emergency corridor / reddingsstrook
   - puntos cívicos → civic points / burgerpunten
   - receptor → receiver / ontvanger
   - recibo → receipt / ontvangstbewijs
   - cadena de hashes → hash chain / hash-keten
   - prueba → test / test
   - simulación → simulation / simulatie
8. No traduzcas «SENDA».
9. No añadas claims que no estén en inglés.

PASO 4 · REVISIÓN
1. Revisa las tres versiones contra el audio completo.
2. Comprueba sincronización al final: ±200 ms.
3. Comprueba que no hay cues partidos en medio de una cifra o un nombre.
4. Si no hay revisión nativa de neerlandés, marca `REVIEW_REQUIRED` y no publiques producción.
5. Guarda `evidence/video/m95/subtitles-review.md` con revisor, fecha, método y hallazgos.

PASO 5 · ENTREGA
Para cada pieza:
- MP4;
- VTT es/en/nl;
- duración;
- número de cues;
- desviación máxima;
- estado de revisión;
- hashes SHA-256.

NO HAGAS
- No uses `_say` como subtítulo.
- No inventes traducciones.
- No cambies los tiempos para «hacer que quepa».
- No publiques solo en inglés.
- No digas que el neerlandés está verificado si no lo ha revisado alguien competente.
```
