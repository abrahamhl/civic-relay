# Auditorías de justificación y responsabilidad

Revisión técnica asistida por IA, con roles **simulados**. Ningún integrante es funcionario, institución ni certificador real; esto **no** sustituye un informe de auditoría, un dictamen jurídico ni una evaluación independiente acreditada. Objeto revisado: `HEAD 3f1c398` + implementación verificada.

## Resumen ejecutivo

- **Exploración (demo pública ficticia) → GO**, acotada y reproducible.
- **Operación real / contratación operativa → NO-GO**, con el estado actual.
- **No se justifica** hoy una inversión pública en producción; sí puede justificarse un experimento controlado comparado con "no hacer nada" y con "reutilizar lo existente".

## Los cinco roles y su veredicto

### 1 · Arquitecto — integridad de mensajes
- **Estado:** una ruta que "acepta" ya no se promueve a `DELIVERED` sin acknowledgment del receptor.
- **Riesgo:** si se acepta sin confirmar, se rompe el segundo trayecto; TTL y colisiones silenciosas.
- **Gates:** cero `DELIVERED` por aceptación simulada; cero envíos caducados en 100 casos con reloj controlado; colisiones rechazadas; pérdida por recarga declarada.
- **Responsable humano por designar:** responsable técnico de integridad de mensajes.
- **Decisión:** invertir solo en el experimento simulado, no en despliegue operativo.

### 2 · Seguridad y protección de datos
- **Estado:** claves Ed25519 para firma, X25519/XSalsa20-Poly1305 para cifrado, separadas. Sin E2E en el flujo de la demo. Sin recuperación de claves. Claves privadas nunca en claro.
- **riesgo:** promesa de "E2E" sin evidencia; API sin autenticación (no expuesta); peticiones externas por mapa/iconos.
- **Gates:** 100/100 cifrado→descifrado y firma→verificación, alteraciones/claves equivocadas fallan; 401/403 en API; cero destinos no declarados por red.
- **Responsables por designar:** responsable de seguridad, responsable del tratamiento (DPD si aplica).
- **Decisión:** publicable como demo estática con aviso inequívoco; no tratar datos reales.

### 3 · Continuidad operativa y despliegue
- **Estado:** `pnpm build`, `pnpm test` (21/21), `pnpm lint` correctos; instalación congelada OK; `base: /civic-relay/`.
- **Riesgo:** PWA/integración IDB merecen por separado, no "completas"; el worker no se registra.
- **Gates:** dos builds limpios reproducibles; cero 404 propios; cinco usuarios identifican la simulación; rollback ≤ 10 min.
- **Responsable por designar:** responsable de continuidad/despliegue (con suplente).
- **Decisión:** despliegue de demo estática GO; no describirla como PWA completa ni como servicio.

### 4 · Contratación pública y control del gasto
- **Estado:** la presentación pública ya no afirma conformidad ENS, piloto ejecutado ni auditoría externa.
- **Riesgo:** cumplir con una matriz de capacidades por probar; identidades institucionales y dominios reservados (`*.example`) para no inducir vinculación gubernamental.
- **Contrato exploratorio recomendado:** objeto y duración limitados; entregables = código snapshot, inventario de limitaciones, guion de comprobación, evidencias y memoria de alternativas/costes; aceptación por acta trazable al commit.
- **Adquisición operacional:** no recomendada con la evidencia actual; requiere evaluación y aceptación separadas.
- **Responsables por designar:** órgano de contratación, responsable de recepción, interventor/control del gasto, responsable de seguridad.
- **Decisión:** exploración GO; no adjudicar ahora.

### 5 · Producto, valor público y presupuesto
- **Estado:** los puntajes como "93%" y la llegada al escalado no respaldan una autorización operativa; son una autoevaluación sintética.
- **Riesgo:** ROI comercial del promotor ≠ valor público; probabilidades de financiación sin respaldo verificable.
- **Decisión:** comparar frente a "no comprar" y a "reutilizar lo existente"; medir tiempo, aciertos, errores y coste por tarea; no inferir vidas salvadas.
- **Gates kill/continue:** continue solo si hay ventaja reproducible dentro del coste autorizado; kill si no hay ventaja, si la reutilización es superior o si se confunde con un servicio real.
- **Responsables por designar:** responsable de producto, responsable de presupuesto y evaluador independiente (el promotor no certifica su propio producto).

## Marco común de coste total (sin cifras inventadas)

`Σ(horas trazables × tarifas verificables)` + herramientas + infraestructura + dispositivos + integraciones + accesibilidad + seguridad + evaluación independiente + formación + soporte + mantenimiento + contratación + retirada/exportación. Separar costes hundidos/futuros, únicos/recurrentes y escenarios de riesgo respaldados. No asumir "gratis" por ser de código abierto ni por GitHub Pages.

## Conclusión

Publicar una demo estática **ficticia**, reproducible y con límites declarados: **sí**, porque produce evidencia verificable. Invertir dinero público para operar, escalar o integrar con emergencias: **no** con el estado actual.
