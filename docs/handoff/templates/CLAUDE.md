# SENDA · Reglas para agentes en este repositorio

## Qué es
SENDA — Sistema de Enrutamiento de Emergencia por canales alternativos. Capa offline-first que coordina todo lo que puede mover un mensaje de emergencia. Canal **secundario**: nunca sustituye al 112 ni a EU-Alert.

## Reglas innegociables
1. **Offline first, for sure.** Toda función de campo funciona sin red; lo que necesite red se degrada con aviso visible.
2. **Verdad verificable.** Cada cifra pública con fuente o con test reproducible. Si no está confirmado: «pendiente de verificar» y cómo verificarlo. Nunca inventar fuentes, normas, precios ni capacidades.
3. **Consentimiento y ley.**
   - No interceptar comunicaciones ajenas.
   - No encender radios sin el toque del usuario.
   - En bandas de radioaficionado, solo estados públicos firmados, sin cifrar.
   - Nadie es «víctima» sin confirmación oficial: se usa «desaparecido sin confirmar».
4. **Datos de terceros.** Cada capa lleva su licencia; lo no comercial se marca «solo demostración» y nunca entra en el producto de pago.
5. **Secretos.**
   - Ninguna credencial en el repositorio ni en el frontend.
   - Las claves de producción de los organismos, en HSM.
   - Los datos de calibración reales nunca van al repositorio público.
6. **Decisiones del fundador.** Licencia, marca, alcance, precio y promesas públicas se preguntan antes de cambiarlos.

## Antes de cada commit
```bash
node --test packages/senda/tests/*.test.mjs packages/senda-relay/tests/*.test.mjs
node packages/senda/scripts/sync-web.mjs          # si cambió el núcleo
node investor-next/scripts/senda-offline-e2e.mjs   # app sin red, accesibilidad incluida
cd investor-next && npm run build && node test-locales.mjs && node --test tests/*.test.mjs   # si cambió la web
node packages/senda/scripts/build-status-page.mjs  # actualiza estado.html / estado.json
```
Si añades un módulo a la app, añádelo también a la precarga de `investor-next/public/senda-sw.js` y sube `VERSION`.

## Formato de entrega
Entrada → Procesamiento → Validación → Salida, registro de cambios, siguiente paso y nota de confianza (0–100 %).

## Mapa rápido
- Núcleo: `packages/senda/src/`
- Relé: `packages/senda-relay/`
- App: `investor-next/public/senda/`
- Web: `investor-next/app/`
- Android: `apps/senda-android/`
- ESP32: `hardware/esp32-survey/`
- Película: `media/senda-film/`
- Handoff: `docs/handoff/`
