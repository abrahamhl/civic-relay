# Gates obligatorios para cada funcionalidad

1. **G0 repositorio:** `git status` limpio o preservado, SHA real, worktree, dependencias, licencia.
2. **G1 ecuaciones:** unidades, contraejemplo, reproducción y comparativa con implementación independiente.
3. **G2 datos:** fuente y hash originales, hora UTC, permiso y licencia, frescura, schema y procedencia.
4. **G3 seguridad:** autorización, segmentación de roles, secreto fuera de respuesta, privacidad, fuzzing según superficie.
5. **G4 pruebas:** tests y CI en SHA exacto; negativos, bordes, P95, fallos de red.
6. **G5 calibración:** HOLDOUT espacial y temporal; métricas interpretables con intervalos; no data leakage.
7. **G6 hardware:** dispositivo real y receptor real, logs y escenario repetido; sino `LAB_ONLY`.
8. **G7 producto:** UI móvil/desktop en navegador, accesibilidad y fallback por ausencia de fuente.
9. **G8 despliegue:** manifest Git/build/artefacto/deployment+smoke tests en URL real.
10. **G9 revisión:** auditor diferente firma PASS/BLOCKED con SHA y evidencia reproducible.

Estados permitidos: `LIVE_VERIFIED`, `FIELD_MEASURED`, `LAB_VERIFIED`, `RECORDED_REAL_SAMPLE`, `MODEL_FORECAST`, `SYNTHETIC`, `STALE`, `UNAVAILABLE`, `PARTNER_REQUIRED`, `HARDWARE_REQUIRED`.

Semántica: Un programa que compila no es `FIELD_MEASURED`. Un hash SHA-256 no autentica al proveedor. Una cámara no se convierte en bearer de radio por mostrar imágenes.
