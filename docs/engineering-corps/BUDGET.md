# Control de coste y paralelismo

**Operación predeterminada:** 1 orquestador + 1 implementador + 1 revisor. Máximo 2 implementadores simultáneos con worktrees distintos. No mantener 22 procesos abiertos.

**Clasificación de esfuerzo:**
- Bajo coste: inventarios, cambios CSS, TS sencillo, tests focalizados, docs y registro de fuente: modelo rápido con acceso a herramientas.
- Alto razonamiento: matemáticas RF/estadística, criptografía, integración concurrente, diseño de modelo, revisión de hallazgos: modelo de razonamiento medio-alto.
- Cómputo especializado local: tests Node, Python, SUMO, simulación CPU o GPU en lotes; antes de alquilar recursos, demostrar qué métrica mejora y medir consumo.

**Guardarraíles:** antes de cada fase declarar estimación de tokens, gasto máximo sugerido y criterio de parada. El presupuesto solo puede limitar trabajo futuro, no rebajar los gates. Reducir contexto usando `git diff --name-only`, subárboles y tests focalizados. No releer todo el repositorio en cada subagente. No descargar GB de datasets sin delimitar región, época, licencias y presupuesto. Cache legal. Evitar runs duplicados. Mantener trazas y checkpoint después de cada cambio.

**Hardware piloto orientativo, no precio comprobado:** teléfono Android propio + segundo Android; ESP32 dev board; LoRa compatible con normativa local; Raspberry Pi opcional; cables, powerbank; grabar precios reales y compatibilidad. No prometer radios LoRa/NTN directamente desde móvil sin transceptor.
