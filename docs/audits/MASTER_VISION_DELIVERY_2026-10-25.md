# Civic Relay · entrega de integración del maestro

**Estado:** implementación local revisable, sin commit, push, PR, merge ni despliegue. Base `bf888764bb1b3e36dc8bca5ebc1c0ec4183ee34c`. Carpeta: `C:/Users/2fabr/civic-relay-vision`.

## Resultado

La presentación incorpora anticipación, continuidad, coordinación e investigación como programa europeo completo. El maestro queda íntegro y con precedencia documental. Los 20 módulos, ocho escenarios, seis públicos y ocho etapas están en un registro ejecutable con criterios de aceptación ES/EN/NL. El caso Arnhem→San Martín permite comprobar que custodia, entrega y lectura son eventos diferentes. Se conserva el software anterior.

Corrección técnica principal: el verificador web reconstruye el contenido firmado desde los campos de la aplicación. Rechaza sustitución de ID, estado, zona, sector, batería, timestamp, frame con CRC válido, metadatos inconsistentes, fingerprint ajeno y hexadecimal malformado. No confunde integridad con identidad institucional.

Nuevos contratos de laboratorio: elegibilidad de rutas; oportunidad orbital frente a acceso al servicio; clasificación de señales con fuente y caducidad; autoridad y revocación; ACK tipados; TTL; estado humano desconocido ante señales insuficientes. No conectan servicios externos.

## Validación

| Comprobación | Resultado observado |
| --- | --- |
| Pruebas Node del laboratorio web | 98/98 pasan, incluidas 10 nuevas pruebas de integración/adversarias |
| Pruebas workspace/core | 26/26 pasan |
| `pnpm build` y `pnpm type-check` | Pasan; aviso heredado de tamaño de bundle de la demo histórica |
| `npm run type-check` y `npm run build` en investor-next | Pasan; exportación estática ES/EN/NL |
| Locales y dominio canónico | Pasan |
| `npm audit --omit=dev --audit-level=high` en investor-next | 0 vulnerabilidades notificadas en esta ejecución |
| Chromium P01–P15 | 15/15 pasan; catálogo, confirmaciones, filtros, teclado, descarga y móvil |
| Diagnóstico de dispositivo en Chromium | Pasa; 16 mediciones de API, cámara desactivada, exportación sin vídeo |
| CI remoto de la base bf888764 | Seis checks terminados con success, recibo en evidence/remote-ci-baseline.json |
| CI remoto de estos cambios locales | No ejecutado: no se han publicado |
| Android, radio física, satélite, CAP institucional | No ejecutados ni validados en esta entrega |

Evidencia de navegador: `evidence/browser-release/summary.json`, P13–P15 y capturas. Diagnóstico: `evidence/device-field/summary.json`. Identificación de fuentes y logs: `evidence/vision-integration/manifest.json`.

Los checks verdes de la base no se atribuyen a estos cambios. La procedencia del build declara `workingTree: MODIFIED` y `BASE_COMMIT_WITH_LOCAL_CHANGES`. Los SHA-256 del manifiesto identifican los archivos entregados. La compilación web no acredita conectividad física.

## Problemas y prioridades (máximo cinco)

1. **Protocolo transversal pendiente.** La corrección web no unifica JS/Java ni añade E2EE, outbox transaccional o tombstones. Prioridad: completar G1 con vectores cruzados y revisión criptográfica.
2. **Falta de evidencia física.** Prioridad: G2, dos Android y ≥30 intentos registrados con fallos; después tres nodos y gateway.
3. **Integraciones externas pendientes.** SGP4/TLE/OMM, sensores, CAP, NTN y drones necesitan implementación específica, validación y acuerdos según el módulo.
4. **Documentación histórica con nombres y IDs distintos.** El maestro y el registro tienen precedencia; la matriz anterior queda marcada como histórica. Revisar claims antes de cualquier presentación pública.
5. **Densidad de la portada heredada.** El programa nuevo usa un recorrido claro y catálogo plegado; sigue siendo conveniente separar más contenido avanzado en sus rutas dedicadas.

## Usabilidad y alineación

Valoración editorial provisional: **7/10**. Hay una entrada clara por el caso familiar, indicadores textuales, selección por público y pruebas de teclado/móvil. No equivale a un estudio con ciudadanos o personal de emergencia. La navegación y los laboratorios heredados permanecen disponibles.

La visión amplia está preservada. Se añade trazabilidad y lógica comprobable; no se declara que todo el programa esté terminado. La diferencia tecnológica propuesta se centra en conectar riesgo, custodia, oportunidad de enlace y confirmación de destino. Su superioridad comercial o científica necesita comparación independiente.

## Cómo seguir sin perder el foco

Abrir el maestro y el [registro de integración](../product/MASTER_VISION_INTEGRATION.md). Revisar S01 y su prueba negativa. Elegir G1 como siguiente objetivo de ingeniería, con un esquema común y criterios de salida precisos. Mantener G2 como siguiente prueba de realidad, no abrir nuevas pantallas para sustituirla.

Para revisar la interfaz: ejecutar desde investor-next `npm run dev -- --hostname 127.0.0.1 --port 3107` y abrir `http://127.0.0.1:3107/es/#master-vision`. Para repetir la regresión: compilar y ejecutar `node scripts/browser-release-smoke.mjs` con Playwright 1.63.0/Chromium instalados.

## Registro de ejecución

- Copia aislada de los archivos versionados; originales conservados y sin archivos eliminados.
- Lectura de GitHub para identificar base y CI; descarga de la rama actual y dependencias fijadas para pruebas.
- Mapa de activos creado antes de implementar; adjunto copiado sin alterar contenido.
- Cambios documentales, contratos, interfaz y endurecimiento del verificador; pruebas y capturas reales locales.
- Primer ensayo de navegador: 12/15 pasaron; tres fallos por expectativa del test que omitía M19 transversal. Corregida la expectativa con IDs exactos y repetido hasta 15/15.
- Sin cambios de cuenta, secretos, radio, servicios institucionales ni publicación. Destino de push de esta copia: `DISABLED_LOCAL_REVIEW`.

La siguiente mejora más valiosa es convertir las condiciones del laboratorio en evidencia física y seguridad interoperable. El catálogo mantiene la ambición organizada para que ese paso sea visible y medible.
