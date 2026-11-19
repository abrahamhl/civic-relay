# SENDA: evaluación para empezar a usarla y camino a la financiación (19-11-2026)

Este documento resume qué funciona hoy, qué no y cómo financiar el proyecto.

**Base:** el commit de la cabeza de `claude/modest-gauss-4qkcps` (PR #53 → `master`), que contiene las 62 ramas del repositorio.

**Cómo leer las etiquetas:**
- **medido**: lo comprobé ejecutándolo;
- **fuente**: dato con documento citado;
- **no verificado**: no se ha comprobado y se dice qué falta.

## 1. Qué puedes usar ya

| Superficie | Cómo se usa | Estado (medido) | Qué esperar |
|---|---|---|---|
| **App web SENDA** (`investor-next/public/senda/*.html`, 43 pantallas; carretera en `roadsafe.html`) | En local: `cd investor-next && npm ci && npm run build`, y servir la carpeta `out/` | Build de producción OK; Chromium: RoadSafe 82/82, pantallas 39/39, sin conexión 49/49 | Funciona en el navegador y sin conexión. Avisos por voz y bus de avisos, solo con la app en primer plano |
| **Despliegue público** | `civic-relay-investor.vercel.app` | **Medido hoy:** la portada responde (200), pero `/senda/roadsafe` da **404** | La web pública es una versión antigua, sin SENDA. Hay que comprobar qué proyecto de Vercel publica `investor-next` tras la fusión |
| **Android** (APK de depuración, versiones *base* y *play*) | Artefacto `senda-android-debug-apk` de la CI. Se instala a mano (orígenes desconocidos) | La CI compila los dos APK. La versión base no lleva Google Play Services ni Internet | Se puede instalar para probarlo. **El arranque automático no se ha probado en un móvil real** |
| **iOS** | Proyecto XcodeGen `apps/senda-ios`. Hace falta Xcode y una cuenta de desarrollador para instalarla | Medido: la CI compila en el simulador y pasa las pruebas de conformidad | No hay TestFlight. Instalarla en un iPhone requiere firmarla |
| **Escáner de cámaras** (Python) | `packages/senda-vision/vehicle_camera_scan.py` sobre una memoria TeslaCam o un vídeo con posición y hora declaradas | 11 pruebas y una prueba de humo con 1 vídeo real | Diferido, no en tiempo real. Las heurísticas no están validadas |
| **Android Auto** | Versión *play* (Car App Library 1.7.0) | Compila | Categoría POI **provisional**; Google podría no aprobarla |

## 2. Qué esperar de verdad (y qué no)

- **Sí:**
  - motor de decisión determinista y probado: 1 592 comprobaciones automáticas, suma de las suites validadas en el PR #53;
  - avisos de peligro con sentido de la marcha fiable (el caso del trompo está corregido);
  - guion para el 112 sin datos inventados;
  - funcionamiento sin conexión;
  - privacidad por diseño en las cámaras;
  - todas las simulaciones declaradas como tales.
- **Todavía no:**
  - **ninguna prueba de campo**;
  - las razones de verosimilitud del detector de choques y de las cámaras valen `null` hasta calibrarlas (VZCrash espera una decisión de licencia);
  - arranque automático sin validar en dispositivos reales;
  - sin integración con la DGT 3.0 ni con el 112 real.
- **Uso recomendado ahora:** **piloto personal o demostración**. No sirve todavía como sistema de seguridad en el que confiar. El aviso que funciona en carretera sigue siendo la V16 homologada; SENDA la complementa, no la sustituye.

## 3. Primeros 30 días de uso (orden propuesto)

1. **Publicar la web SENDA.** Decidir el proyecto de Vercel para `investor-next` y verificar que `/senda/roadsafe` responde 200.
2. **Instalar el APK base en 2 móviles** y registrar cada trayecto con hora, modelo y versión:
   - ¿arranca solo con el Bluetooth del coche?
   - ¿se detiene al bajar?
   - batería consumida.

   Es el primer dato real del proyecto.
3. **Pasar el escáner por clips propios** (dashcam o TeslaCam) y anotar los falsos positivos.
4. Todo resultado entra por `calibration-gates.mjs` con procedencia y hash.

## 4. Financiación: camino verificado

Fuentes: `docs/financiacion/RUTAS_FINANCIACION_ES_NL_UE_2026-11.md` y `docs/OEP_VALIDATION_CERTIFICATION_AND_FUNDING_2026.md`. No se han reverificado hoy, salvo donde se indica.

| Cuándo | Vía | Requisito clave | Estado |
|---|---|---|---|
| **Ya** | Decidir la **forma jurídica** (España o Países Bajos) | Sin sociedad no hay Neotec, ENISA, WBSO ni consorcio | Decisión del fundador |
| Antes del **1-12-2026** | INNOWWIDE (RVO): 60 000 € fijos | Pyme constituida y socio **fuera de la UE** | Encaje condicional; probablemente no llega a tiempo |
| Antes del **20-12-2026** | WBSO 2027 (Países Bajos) | Entidad holandesa con personal en nómina | Solo si se constituye en Países Bajos |
| **17-12-2026 → 4-3-2027** | Eurostars-3, convocatoria 12 | Pyme líder y ≥ 2 organizaciones independientes | **La mejor ventana a corto plazo**: reconfirmar con RVO |
| **5-5-2027 → 4-11-2027** | Horizon CL3-2027-01-DRS-03 (apoyo a la decisión en crisis) | Consorcio | Encaje alto; buscar coordinador |
| 2027 (sin fecha publicada) | Neotec (CDTI) | Sociedad de ≤ 3 años y capital de 20 000 € | Esperar a la convocatoria |
| Permanente (fuentes discrepan) | ENISA, préstamo participativo | Sociedad constituida | **No verificado**: comprobar en enisa.es |
| — | NLnet / NGI | Su política sobre IA generativa lo impide | **Bloqueada** salvo candidatura 100 % humana |

### Qué piden quienes financian y qué tenemos

- **Prueba de campo medida:** **falta**. Es el punto 2 de la sección 3, y lo que más sube el valor del proyecto.
- **Socio o usuario final** (protección civil, aseguradora o flota): **falta**. No se ha enviado ningún contacto.
- **Código auditable, pruebas y CI:** **sí**. Es el punto fuerte. Las afirmaciones se comprueban con `node scripts/prove.mjs`.
- **Material para inversores:** existe, pero los documentos de `scientific-mission-10` llevan aviso de reverificación (cifras de simulación). Hay que repasarlos antes de enviarlos.

## 5. Decisiones pendientes del fundador

1. Forma jurídica y país.
2. Proyecto de Vercel para la web SENDA, y si el `vercel.json` raíz pasa a `command-center`.
3. Licencia NC de VZCrash.
4. Categoría de Android Auto.
5. Alta en Tesla Fleet API.
6. Licencia de las imágenes de la DGT.
7. Bus canónico entre módulos paralelos.
8. Valores cero por defecto en `encodeHazard`.

---
Redactado por Claude (sesión de consolidación) el 19-11-2026.
