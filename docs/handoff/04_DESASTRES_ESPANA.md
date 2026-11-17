# Desastres recientes en España: qué falló en las comunicaciones y qué cambia SENDA

> Columna «Fuente»: ✅ = verificada en la investigación de esta sesión o en documentos previos del
> repositorio; 🔎 = pendiente de verificar con fuente oficial (agente A10). No se publica nada 🔎
> como hecho.

| Fecha | Suceso | Qué falló en comunicación y alerta | Qué cambia SENDA | Fuente |
|---|---|---|---|---|
| 28-04-2025 | **Apagón ibérico** | La red móvil cayó al agotarse las baterías de las antenas: los usuarios con conexión estable bajaron del 90 % al 40 % hacia las 15:00. | Previsión de cuándo y dónde se queda la población sin cobertura y dónde colocar pasarelas (`blackout.mjs`); mensajes sin red por sonido, Bluetooth y vecinos; fragmentos por Iridium y satélite directo al móvil. | ✅ [laecuaciondigital](https://www.laecuaciondigital.com/actualidad/el-apagon-electrico-colapsa-redes-moviles-en-espana-y-portugal-el-28-de-abril/) · [Infobae](https://www.infobae.com/tecno/2025/04/29/el-apagon-que-desconecto-a-espana-por-que-whatsapp-dejo-de-funcionar-aunque-el-movil-mostraba-cobertura/) |
| 29-10-2024 | **DANA de Valencia** | El ES-Alert se envió a las 20:11; las causas del retraso están en disputa. | Alerta secundaria por zona firmada por el organismo, que llega por canales sin red; respuestas «estoy atrapado» y cuadro por zona. | ✅ [El Debate](https://www.eldebate.com/espana/comunidad-valenciana/20251204/principal-tecnico-emergencia-dana-sostiene-alert-retraso-diferenciar-valenciano-catalan_362211.html) |
| 18-01-2026 | **Accidente ferroviario de Adamuz** (dos trenes) | Según la cronología publicada, se tardó ≈45 min en reconocer el segundo tren. | Detección de impacto en cada móvil y fusión por tren: el segundo tren se identifica en segundos en la simulación (`rail-incident.mjs`). | ✅ (documentado en `docs/product/SENDA_VISION_2026-11-04.md`; contrastar con la investigación oficial) |
| 28-10-2026 | **Accidente ferroviario de Urda** | 🔎 | Mismo módulo ferroviario | 🔎 (citado por el fundador; verificar) |
| Verano de 2025 | **Grandes incendios forestales** (noroeste peninsular y otras zonas) | 🔎 pérdida de cobertura en zonas rurales, evacuaciones | Ojo de SENDA: focos, perímetro, cámaras con convenio; pasarelas en dron o vehículo; mensajería sin red entre efectivos | 🔎 |
| 2019 y siguientes | **Incendios del entorno de Almorox / San Martín de Valdeiglesias / El Tiemblo** | Comunicaciones entre efectivos dependientes de Internet («SITRE», según un bombero) 🔎 | § 5 de [03](03_OJO_DE_SENDA_COP_3D.md) | 🔎 |
| 19-09-2021 | **Erupción de La Palma** | 🔎 evacuaciones prolongadas, infraestructura afectada | Padrón voluntario y «desaparecido sin confirmar»; zonas por polígono | 🔎 |
| 01-2021 | **Borrasca Filomena** | 🔎 aislamiento por nieve, cortes de luz | Mulas DTN y previsión de cobertura | 🔎 |

## Patrón común

1. **La red cae después del evento**, no durante: hay una ventana de horas para preparar, que hoy nadie aprovecha.
2. **La alerta oficial depende del móvil**, que es precisamente lo que cae.
3. **Los efectivos de campo pierden los datos** cuando no hay Internet; la voz TETRA sigue, pero no la imagen operativa.
4. **El silencio se malinterpreta.** SENDA nunca convierte la falta de respuesta en «víctima».

**Tarea del agente A10:** completar las filas 🔎 con fuentes oficiales y añadir, por caso, la hora en que fallaron las comunicaciones y cuánto tiempo se habría ganado con SENDA. Para lo segundo, usar el simulador y declarar las hipótesis.
