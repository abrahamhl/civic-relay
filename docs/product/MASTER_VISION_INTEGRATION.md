# Integración del maestro · CR-VM-2026-10-25

## Autoridad documental y alcance

[El maestro del fundador](CIVIC_RELAY_VISION_MAESTRA_2026-10-25.md) gobierna la visión, M01–M20, S01–S08 y G0–G7. La matriz de voz sigue como antecedente. Los antiguos M01–M19 de SCIENTIFIC_TRUTH_MATRIX son identificadores históricos diferentes: no se deben unir por número con los del maestro. La evidencia histórica no acredita este cambio.

Base exacta: `bf888764bb1b3e36dc8bca5ebc1c0ec4183ee34c`. Implementación local aislada en `C:/Users/2fabr/civic-relay-vision`. El SHA identifica la base, no cambios locales sin commit. El informe generado incluye hashes SHA-256 de los archivos nuevos y modificados para identificar la entrega sin inventar un commit.

## Lo integrado

- Maestro íntegro, descarga pública idéntica comprobada por test y precedencia explícita desde los índices.
- Registro ejecutable `investor-next/lib/master-vision.mjs`: 20 módulos, seis públicos, ocho escenarios, ocho etapas; título y aceptación ES/EN/NL, arquitectura, referencias existentes, contrato, pruebas, evidencia y límites. `operational:false` en todos los módulos.
- Vista `investor-next/app/master-vision.tsx`: tesis completa, caso familiar reproducible, selección de público y escenario, requisitos de salida y clasificación de madurez. Conserva globo, diagnósticos opt-in, cámaras, películas, ciencia y dossier existentes.
- Contratos puros `investor-next/lib/vision-contracts.mjs`: rutas sólo con consentimiento, permiso, compatibilidad y enlace medido vigente; oportunidades orbitales separadas de servicio; observación/previsión/riesgo separados de autoridad; recibos tipados, expiración y revocación; ocupación desconocida ante señales RF.
- Corrección P0 en `live-protocol-node.mjs`: reconstruye el texto firmado desde los campos consumidos, comprueba frame/metadatos y fingerprint derivado de clave; rechazo de hexadecimal malformado. CRC no sustituye autenticidad. Una clave suministrada por el propio emisor no establece identidad institucional.

## Fronteras de confianza y límites

Los contratos reciben resultados de futuros adaptadores fiables. `VERIFIED_TRUST_ANCHOR`, `VERIFIED` y `MEASURED` son precondiciones de un contrato, no un verificador PKI, una firma de recibo ni una medición que este módulo realice. Nunca pasar JSON no confiable directamente a estos contratos en producción.

El recorrido S01 usa fixtures y no envía, cifra ni persiste mensajes. La simulación declara `physicalDelivery:false`, `encryptionImplemented:false` y `durableCustodyImplemented:false`. Un ACK intermedio no entrega al endpoint; un READ aislado tampoco. Un recibo válido anterior al TTL conserva su valor histórico tras la caducidad. Revocación local no acredita borrado de copias externas.

El comprobador orbital valida condiciones declaradas de una oportunidad; no implementa SGP4 ni descarga TLE/OMM. El modelo Kepleriano heredado continúa siendo sintético. Las fuentes ambientales, CAP, sensores sísmicos, ocupación, NTN, drones y operaciones reguladas necesitan implementaciones/mediciones/acuerdos independientes. No hay una nueva integración operativa de ninguna de esas capacidades.

La corrección criptográfica endurece el formato web V1. No lo convierte en protocolo interoperable con Android, no cifra el contenido y no añade por sí sola expiración criptográfica o replay tombstones. No desbloquea G1 completo. La huella corta es una etiqueta visual, no una raíz de confianza.

## Diferenciación que se puede defender

Hipótesis de producto: una misma cadena relaciona contexto anticipatorio, custodia del mensaje, elegibilidad real de transportes y confirmación del destinatario, mostrando la incertidumbre a cada público. La integración y sus invariantes son comprobables en software; superioridad frente a alternativas, patentabilidad, ventaja comercial y resiliencia física aún requieren comparaciones y ensayos. No se afirma novedad científica acreditada.

## Secuencia de ejecución

1. G0: revisar maestro, catálogo e invariantes junto con el fundador; auditar otros textos históricos antes de presentar capacidades operativas.
2. G1: acordar esquema canónico versionado JS/Java, vectores comunes, modelo de claves, E2EE revisado, cola transaccional, pruebas de reinicio/replay/carreras y límites de almacenamiento.
3. G2: ejecutar ≥30 intentos con dos Android y registrar también los fallos. Un APK compilado no cuenta como ensayo.
4. G3: tres nodos físicos y gateway con cortes reproducibles, reconciliación y medición energética.
5. G4–G7: SGP4 contrastado y fuentes con vigencia; luego NTN y pilotos con operadores/entidades autorizadas; extensiones reguladas en proyectos separados.

## Auditoría de usabilidad y alineación

Problemas principales: (1) confusión posible entre firma y autoridad; (2) visión dispersa entre documentos con IDs incompatibles; (3) narrativa centrada en simulaciones sin programa completo; (4) densidad de la portada y múltiples laboratorios; (5) ausencia de evidencias físicas.

Recomendaciones: mantener la precedencia documental y los estados explícitos; entrar por S01; elegir un público antes de explorar módulos; financiar pruebas de salida; trasladar progresivamente la investigación avanzada a sus rutas dedicadas.

Versión mejorada: una entrada de programa, un recorrido con estados comprobables, seis perspectivas y catálogo por escenario. Los públicos son vistas informativas; no son autenticación ni RBAC operativo.

Puntuación editorial provisional: **7/10** para claridad de esta propuesta; no es resultado de estudio con usuarios ni evaluación de la plataforma completa. Validación técnica y observaciones de navegador se registran en el reporte de esta entrega.

Alineación: se conserva toda la amplitud M01–M20 sin presentar aspiraciones como despliegues. Próximo trabajo de mayor valor: cerrar protocolo y custodia, seguido del ensayo físico. Mi aportación más útil es mantener la relación requisito → contrato → prueba → evidencia y detectar contradicciones antes de que lleguen a una presentación.

## Registro de acciones y seguridad local

Copia Git aislada de los archivos versionados y actualización a la base remota confirmada; no se copian secretos, node_modules ni builds ajenos. Originales conservados; cero archivos eliminados. `origin` conserva lectura de GitHub, con `pushurl=DISABLED_LOCAL_REVIEW`. No commit, push, PR, merge ni despliegue. Las consultas de CI son lecturas. No se crea una bóveda AnomalyOS paralela porque el proyecto ya tiene su estructura documental.

Pruebas: `node --test investor-next/tests/*.test.mjs`; en investor-next, `npm run type-check`, `npm run build`, `npm run check:locales` y `node scripts/browser-release-smoke.mjs`. El workflow Emergency routing research lab ya ejecuta el wildcard que incluye las pruebas nuevas.
