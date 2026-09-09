# Workwize Case Study

Caso de entrevista para un puesto de Product Engineer. Distingue tres responsabilidades: qué decidió la persona, qué implementó la IA y qué se verificó con herramientas automáticas.

## Pregunta: «¿Qué hizo mal el agente y cómo lo supo?»

Hubo al menos tres fallos genuinos, corregidos y verificados:

1. **Contrato/estado falso:** el transport response se trataba como `DELIVERED` sin acknowledgment del receptor.
   - Cómo se supo: el test de aceptación (golden) fallaba en "offline → mesh → later IP"; el estado `ACKNOWLEDGED`/`completeDelivery` lo resuelve y el test "transport accepted without receiver acknowledgment never becomes delivered" lo prueba.

2. **Arquitectura no conectada:** el deduplicador existía como clase pero no estaba en el flujo; era "implementado pero no probado".
   - Cómo se supo: `demo.ts` no enlazaba los transportes al receptor; tras conectarlo, el test "same message delivered twice via two transports is one logical message with both paths" lo valida.

3. **Tokin/cifrado incompatible y sobre-afirmación:** se generaban claves Ed25519 pero se pasaban a un algoritmo que necesita X25519; y el README afirmaba "ENS Alto Compliant / Ready for Pilot / 93%".
   - Cómo se supo: se separaron `generateKeyPair` (Ed25519) y `generateEncryptionKeyPair` (X25519), con pruebas de ida/vuelta y de clave equivocada; las afirmaciones se sustituyeron por límites reales.

## Pregunta: «¿Qué decidiste tú?»

| Categoría | Contenido |
|---|---|
| **Abraham DECISION** | Alcance (V0.1, demo ficticia), no ampliar a satélites/radio/Bluetooth/IA/blockchain; mantener pnpm y Node nativo; publicar demo estática sin API ni datos reales; declarar límites en lugar de inflar. |
| **AI IMPLEMENTATION** | Reescritura del encaminador/almacén/demo, separación de claves, criptografía experimental, `node:test`, limpieza de tenants, README y matriz de auditorías, orientados por un brief humano. |
| **AUTOMATED VERIFICATION** | `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm test` (21/21), `pnpm lint`. No se sustituye por afirmaciones. |

## Responsable humano por designar

No se inventa una institución. Los responsables (integridad de mensajes, seguridad/tratamiento de datos, continuidad y despliegue, contratación/control del gasto, producto/presupuesto y evaluador independiente) quedan **por designar** y referidos en `docs/AUDITORIAS_INVERSION_PUBLICA.md`.

## Lección

Product Engineer = decidir el alcance, delegar la implementación a IA con contexto y **verificar con herramientas ejecutables**. La verdad se demuestra con tests, no con una lista de "features".
