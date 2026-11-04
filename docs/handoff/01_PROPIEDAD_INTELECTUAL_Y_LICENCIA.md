# Propiedad intelectual, licencia, marca y secretos empresariales

> **No es asesoramiento jurídico.** Es el análisis de partida para que un abogado de propiedad
> intelectual y tecnología lo valide (ver agente A4 en [02](02_AGENTES_Y_PROMPTS.md)).

## 1. Situación actual (hechos)

| Elemento | Estado | Consecuencia |
|---|---|---|
| Licencia del repositorio | **MIT**, © 2026 Abraham Haddioui (`LICENSE`) | Cualquiera puede copiar, modificar y vender lo ya publicado si conserva el aviso. **No se puede revocar** para las versiones ya publicadas. |
| Código generado con asistencia de IA | La mayor parte del código se escribió con un asistente bajo la dirección del fundador | La protección por derecho de autor de lo generado sin aportación creativa humana suficiente es **incierta** (la normativa europea exige autoría humana y la Oficina de Copyright de EE. UU. lo ha señalado). Refuerza la estrategia de **marca + secretos + contratos**, más que depender solo del copyright. |
| Terceros | three.js (MIT), Kokoro-82M (Apache-2.0), costas Natural Earth (dominio público), God's Eye View (**código MIT, datos no comerciales**: TeleGeography CC BY-NC-SA, Vantor CC BY-NC, Google Maps, OpenSky) | Atribuciones en `NOTICE`; **ninguna capa de datos no comercial** puede entrar en un producto que se vende. |
| Marca «SENDA» | **Sin registrar**. Es una palabra común en español. | Riesgo de baja distintividad y de marcas previas: hay que buscar en TMview/OEPM/EUIPO antes de invertir en ella. |
| Prueba de autoría y fecha | Historial de Git firmado por fecha, PR #12, despliegues de Vercel | Conservar. Opcional: depósito notarial o registro de la propiedad intelectual del código y la documentación. |

## 2. Qué se puede proteger de verdad (y qué no)

| Activo | Protección eficaz | Nota |
|---|---|---|
| Nombre, logotipo, dominio | **Marca** (OEPM en España o marca de la UE en EUIPO), en las clases 9, 38, 42 y 45 | Es lo que más protege frente a clones: un fork puede copiar el código, pero no llamarse SENDA ni presentarse como oficial. |
| Código ya publicado | MIT (permisivo) | No se puede «cerrar» lo publicado. |
| Código nuevo | Elegir licencia **antes** de publicar (ver § 3) | Lo que no se publica sigue siendo privado. |
| Datos de calibración (baterías de antenas por operador, p medidas por portador, modelos de apagón ajustados) | **Secreto empresarial**: Ley 1/2019 de Secretos Empresariales y Directiva (UE) 2016/943, que exigen **medidas razonables de confidencialidad** | Nunca subirlos al repositorio público. Acceso con NDA y registro de quién accede. |
| Integraciones con organismos (CAP/112, credenciales de producción, relés gestionados) | Contrato y licencia propietaria | Forman parte de la oferta institucional. |
| Consola «SENDA Mando», Ojo de SENDA 3D y gestor de flota de pasarelas y drones | Código propietario o bajo AGPL (ver § 3) | Es donde está el valor de pago. |
| Conocimiento operativo (pilotos, procedimientos, formación) | Secreto + contratos de servicio | |
| Hardware (kits de pasarela Iridium+LoRa, accesorio de dron) | Diseño propio, marcado CE y modelo de utilidad si hay novedad técnica | |
| Patentes | Posibles sobre combinaciones técnicas nuevas (p. ej. reparto k-de-n entre portadores con restricción legal y plan por probabilidad exacta, o previsión de apagón con colocación de pasarelas) | **No publicar más detalles** de lo que se quiera patentar hasta consultarlo con un agente de patentes: la divulgación previa destruye la novedad, y el código ya publicado es divulgación. |

## 3. Recomendación de licencia (open core)

| Capa | Licencia propuesta | Por qué |
|---|---|---|
| `packages/senda` (núcleo), formatos, app ciudadana PWA, ESP32 | **Mantener MIT** (o pasar el código nuevo a Apache-2.0, que añade concesión de patentes) | Máxima adopción, auditoría pública y confianza institucional. |
| `packages/senda-relay` y futuros servidores | **AGPL-3.0** para el código nuevo | Quien lo ofrezca como servicio modificado debe publicar sus cambios, lo que frena los clones en la nube. El titular puede ofrecer **licencia comercial dual**. |
| Consola de mando, Ojo de SENDA 3D, gestor de flota, conectores con 112/CAD | **Propietaria** (repositorio privado) | Producto de pago para organismos. |
| Marca y logotipo | **No** licenciados por MIT/AGPL; `TRADEMARK.md` (borrador en `templates/`) | Separar código libre de identidad comercial. |

**Requisitos para poder hacer licencia dual:**
- **CLA** (acuerdo de licencia de contribución) para todo colaborador externo. Sin CLA, el código de terceros no se puede relicenciar.
- `NOTICE` con todas las atribuciones.
- **SBOM** en CI y escaneo de licencias de dependencias.
- **Firma de versiones** (tags firmados).

## 4. Protección anti-clon realista

No existe una licencia «abierta pero imposible de copiar». La defensa real es la suma de:

1. **Marca registrada**, y que «SENDA oficial» sea la única con credenciales de organismos reales.
2. **Cadena de confianza**: las anclas de los organismos y las credenciales solo existen en despliegues contratados. Un clon no puede emitir alertas que los teléfonos acepten.
3. **Certificaciones** (ENS, accesibilidad, CE). Cuestan tiempo y dinero; un clon no las hereda.
4. **Datos y calibraciones** como secreto empresarial.
5. **Velocidad y comunidad**: ser la referencia que los desarrolladores de calidad quieren mejorar.
6. **AGPL en servidores**, para que nadie lo convierta en servicio cerrado sin publicar.
7. **Contratos** de operación, soporte y SLA.

## 5. Higiene de secretos (ya aplicada y por mantener)

- **Ninguna credencial** en el repositorio, en variables `NEXT_PUBLIC_*` ni en el frontend.
- **Rotar** cualquier clave que haya llegado alguna vez a un commit público.
- **Claves de los organismos**: en producción, en HSM o tarjeta. La herramienta `/senda/organismo` guarda la clave en el navegador y solo sirve para pilotos.
- `SECURITY.txt` debe apuntar a un **correo real**: hoy contiene uno de ejemplo.

## 6. Acciones inmediatas (orden)

1. Búsqueda de anterioridades de la marca «SENDA» (TMview, OEPM, EUIPO). Si hay conflicto, elegir una variante distintiva.
2. Consulta a un agente de patentes **antes** de publicar más detalle de los algoritmos k-de-n y de la previsión de apagón.
3. Añadir CLA (p. ej. CLA Assistant), `NOTICE`, `TRADEMARK.md` y SBOM al repositorio.
4. Decidir la licencia del código nuevo de servidores (AGPL-3.0 + comercial) y aplicarla **solo** al código nuevo.
5. Sacar del repositorio público todo dato de calibración real que llegue de pilotos.
