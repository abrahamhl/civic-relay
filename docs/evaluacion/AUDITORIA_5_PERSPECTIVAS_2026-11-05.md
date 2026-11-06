# SENDA · Auditoría desde 5 perspectivas (v0.12)

> **Entrada → Procesamiento → Validación → Salida.** Fecha: 2026-11-05 · Rama `ccr-357397d4-i6q247`.
> Autor: Claude (Asistente de Orquestación), por encargo del fundador, Abraham Haddioui.
>
> **Aviso:** las perspectivas son **simulaciones razonadas** de cómo evaluaría cada perfil. No son
> opiniones de la UME, la Guardia Civil, la Comisión Europea ni de ningún inversor concreto. Sirven para
> preparar reuniones y priorizar. Las cifras de SENDA salen de las pruebas automáticas del repositorio.

## 0. Veredicto en una frase

SENDA es un **prototipo técnicamente excepcional para su fase**:
- **Amplitud:** 45 módulos de núcleo y 17 pantallas.
- **Verificación poco habitual:** 146 pruebas de núcleo y relé, y 37 comprobaciones de extremo a extremo en navegadores reales, casi todas sin red.
- **Honestidad:** cada pieza declara su estado real.

**Todavía no está validado en el mundo real.** Faltan ensayos con dispositivos físicos, una auditoría de seguridad independiente y un cliente piloto. El valor del siguiente paso está en **convertir esta amplitud en 2–3 pilotos con métricas**, no en añadir más módulos.

## 1. Inventario y madurez (escala TRL de la UE)

TRL 3 = prueba de concepto experimental · TRL 4 = validado en laboratorio · TRL 5 = validado en entorno relevante.

| Capacidad | Código | TRL hoy | Evidencia | Para subir un nivel |
|---|---|---|---|---|
| Mensajes cifrados sin red (sonido, archivo, mula) | `envelope`, `acoustic-modem`, `bundle` | **4** | E2E en 3 navegadores con la red cortada | Móviles físicos en exterior y con ruido |
| Reparto k-de-n entre portadores | `erasure`, `bearers` | **4** | Prueba real con pérdida de portadores | Portadores físicos (LoRa, Iridium) |
| Llamada sin Internet y cadena de voz | `sdp-compact`, `voice-mesh` | **4** | WebRTC real; C oye el tono de A a través de B | 4 móviles en un edificio real |
| Triaje para cualquiera | `triage` | **4** | Árbol START, RCP según el Consejo Europeo de Resucitación (2021), parte ≤ 160 caracteres | Revisión por sanitarios y ensayo con voluntarios |
| Fusión de evidencias por vivienda | `occupancy` | 3 | Calibrada en simulación | Datos de un simulacro |
| Censo radio por planta y dron casa por casa | `rf-census`, `house-sweep` | 3 | 95 % de cobertura del intervalo en 720 plantas simuladas | Escáner real en un edificio con ocupación conocida |
| Riadas y maremotos | `flood-watch` | 3 | Volumen conservado; aviso ≥ 2 h en el escenario sintético | Series reales de una cuenca (SAIH) y comparación con eventos pasados |
| Posición sin cobertura | `geo-offline` | 3 | Resección dentro de su elipse de error; pasos 108/108 | Brújula real con marcas reales en monte |
| Sentidos ampliados | `senses`, `through-wall` | 3 | Golpe a < 0,5 m; respiración ~14 rpm sintética | Escombros reales; placas ESP32 montadas |
| Vigilancia ferroviaria · incendio · apagón | `rail-watch`, `wildfire`, `blackout` | 3 | Escenarios deterministas | Datos del gestor u operador (convenio) |
| App Android (baliza y barrido) · trama ESP32 | `apps/`, `hardware/` | **4** | Paridad de formatos con vectores comunes | Prueba de campo |

## 2. Las capacidades más potentes (por impacto × diferenciación × viabilidad)

1. **Malla multiportador k-de-n con transporte por mulas.** Es el corazón defendible: un mensaje llega aunque fallen varias vías, con probabilidad calculada.
2. **Llamada sin Internet con arranque por sonido y cadena de voz.** Efecto «guau» y uso diario real: en un apagón, hablar sin operador.
3. **Aviso de riada por la subida aguas arriba.** Responde a la lección de la DANA de 2024 y a una demanda pública evidente.
4. **Triaje para cualquiera con parte compacto.** Coste casi nulo, gran valor social; es el piloto más rápido de lanzar.
5. **Dron casa por casa con censo radio y fusión.** Muy valioso para equipos de rescate urbano, pero con más carga regulatoria (vuelo y datos).

## 3. Cinco perspectivas

### 3.1 Inversor institucional (fondo de capital riesgo deep-tech o vehículo público)
- **Le convence:**
  - Tesis clara: una capa de resiliencia de las comunicaciones de emergencia.
  - Calidad de ingeniería verificable.
  - Momento de mercado tras la DANA y el apagón.
  - Potencial de exportación a la UE.
- **Le preocupa:**
  - Riesgo de **persona clave**: un fundador apoyado por IA.
  - **Ningún cliente ni piloto firmado.**
  - La compra pública tiene ciclos de 12–24 meses.
  - Dispersión: demasiadas líneas de producto.
  - Competencia: Meshtastic, goTenna, Garmin, el SOS por satélite de los fabricantes de móviles y las apps oficiales.
  - Modelo de ingresos y licencia sin cerrar.
- **Pediría:**
  - 1 o 2 cartas de intención (un ayuntamiento o una protección civil autonómica).
  - Métricas de un piloto.
  - Incorporar un perfil técnico y uno regulatorio.
  - Foco en 2 productos y un modelo de ingresos.
- **Nota:** 5/10 hoy (pre-semilla técnica sólida) → 8/10 con pilotos.

### 3.2 General jefe de una unidad militar de emergencias (perspectiva UME)
- **Le convence:**
  - Funciona sin infraestructura.
  - Censo por planta, barrido casa por casa y triaje.
  - Interoperabilidad por formatos abiertos (CAP).
  - Estados honestos de cada pieza.
  - No pretende sustituir su cadena de mando.
- **Le preocupa:**
  - Seguridad de la información: Esquema Nacional de Seguridad.
  - Integración con sus sistemas y su cadena de mando.
  - Robustez en campo: energía, interferencias, polvo y agua.
  - Dependencia de móviles civiles.
  - Exceso de información: más datos no es mejor decisión.
  - Formación y responsabilidad legal.
- **Pediría:**
  - Un **simulacro conjunto con métricas**: tiempo hasta localizar, falsos positivos.
  - Modo de despliegue con sus propios drones y vehículos.
  - Una ruta de acreditación de seguridad.
  - Integración por estándares y operación con su red, por convenio.
- **Nota:** 5/10 hoy → 8/10 tras un ejercicio bien medido.

### 3.3 General de la Guardia Civil (rescate de montaña, seguridad ciudadana, tráfico)
- **Le convence:**
  - Posición sin cobertura por marcas conocidas más SOS por satélite.
  - Triaje con aviso al servicio correcto (112 primero; 062 para montaña).
  - «Desaparecido sin confirmar» en lugar de víctima.
  - Registro de auditoría a prueba de manipulación.
  - Nunca intercepta comunicaciones.
- **Le preocupa:**
  - Falsas alarmas y bromas.
  - Protección de datos: RGPD y, para tratamientos policiales, la Directiva (UE) 2016/680.
  - Autenticidad de los mensajes.
  - Posible uso indebido del censo radio como vigilancia.
  - Encaje con las apps y líneas oficiales existentes.
- **Pediría:**
  - Medidas antiabuso: limitación de envíos y verificación.
  - Evaluación de impacto en protección de datos.
  - Convenio para encajar con el 112 y las apps oficiales.
  - Piloto con un grupo de rescate de montaña en una sierra concreta.
- **Nota:** 5/10 hoy → 8/10 con piloto en montaña.

### 3.4 Auditor técnico y de seguridad (compra pública)
- **Le convence:**
  - Núcleo sin dependencias, determinista y probado.
  - Cifrado con WebCrypto estándar.
  - Paridad entre web, Android y ESP32.
  - Evidencias regenerables.
- **Le preocupa:**
  - **Sin auditoría independiente ni prueba de intrusión.**
  - Modelo de amenazas no formalizado.
  - Cadena de suministro web (política de seguridad de contenidos, integridad de lo publicado).
  - Gestión y recuperación de claves.
  - Metadatos: en la cadena de voz, quien repite oye.
  - Límites de iOS y de las APIs del navegador.
  - Sin banco de pruebas con dispositivos físicos.
- **Pediría:**
  - Modelo de amenazas (STRIDE).
  - Auditoría externa.
  - Lista de componentes de software.
  - Política de seguridad de contenidos estricta y versiones firmadas.
  - Laboratorio con 20 móviles reales.
  - Plan de adecuación al Esquema Nacional de Seguridad.
- **Nota:** calidad de prototipo 7/10; preparación para compra pública 3/10.

### 3.5 Comprador europeo y exportación (Mecanismo de Protección Civil de la Unión y protecciones civiles nacionales)
- **Le convence:**
  - Diseño a partir de lecciones europeas: Ahr 2021, Tempi 2023, Turquía 2023, Valencia 2024.
  - Formatos abiertos e interfaz en tres idiomas.
  - Hardware barato.
  - Algoritmos deterministas y explicables.
- **Le preocupa:**
  - Adaptación a cada país: idioma, normas, sistemas de alerta pública.
  - Marcado CE y Directiva de Equipos Radioeléctricos para el hardware.
  - Coherencia con el RGPD.
  - Necesidad de un consorcio con socios de otros Estados miembros.
- **Pediría:**
  - Socios: universidad, protección civil y fabricante.
  - Pilotos en 2 Estados miembros.
  - Una propuesta a convocatorias europeas de seguridad civil (Horizonte Europa) y presencia en la red de conocimiento de protección civil de la UE.
- **Nota:** 5/10 hoy → 8/10 con consorcio y piloto.

## 4. Lo que se nos escapa hoy (y casi nadie resuelve)

| Hueco | Por qué importa | Cómo encaja en SENDA | Dificultad |
|---|---|---|---|
| **Seguimiento de heridos y reunificación familiar sin red** | Tras el triaje, nadie sabe a qué hospital fue cada persona | Tarjeta de triaje digital con un identificador anónimo que viaja por la malla; la familia consulta con un secreto compartido | Media |
| **Reenviar las alertas oficiales a quien no tiene cobertura** | La alerta a móviles no llega a quien está sin red | Re-difundir por la malla el aviso oficial **firmado**, sin modificarlo | Media (convenio para la firma) |
| **Personas vulnerables registradas voluntariamente** | En las riadas mueren sobre todo personas mayores en plantas bajas | Registro con consentimiento, cruzado con zonas inundables para avisos dirigidos | Alta (datos sensibles) |
| **Avisos que despiertan de noche** | Lección del Ahr: riada nocturna | App nativa con permiso para saltarse el «no molestar», con consentimiento | Baja |
| **Voluntarios espontáneos** | En la DANA miles de voluntarios sin coordinación | Tablero de tareas que se sincroniza por la malla | Media |
| **Bulos** | Desinformación en plena emergencia | Ya existe la firma de organismos: distinguir de forma visible lo oficial de lo no verificado | Baja |
| **Batería extrema** | Sin luz durante días | Planificador de energía: qué funciones mantener con un 5 % | Baja |
| **Turistas y personas sordas o ciegas** | Alertas que no se entienden | Varios idiomas, vibración y avisos visuales | Baja |

## 5. Más «sentidos» (la idea de sinestesia, aterrizada)

| Sentido | Qué detecta | Hardware | Estado |
|---|---|---|---|
| Ver los sonidos | Golpes bajo escombros | Móviles | Hecho (simulación) |
| Oír la radio | Baliza de una persona atrapada | Móvil Android | Algoritmo hecho |
| Ver la respiración | Pecho que se mueve tras un tabique | 2 ESP32 | Análisis hecho; ensayo pendiente |
| Ver el calor | Cuerpos y focos | Cámara térmica para móvil | Hoja de ruta |
| **«Oler» el peligro** | Fugas de gas tras un sismo; CO en incendios | Sensores de gas en un accesorio | Idea nueva: **pendiente de diseñar** |
| **Sentir el suelo** | Golpes por la estructura y réplicas | Acelerómetro del móvil apoyado | Hoja de ruta |
| **Ver el agua** | Nivel del río en un puente | Sensor ultrasónico barato o la cámara con una regla | Idea nueva: aforos ciudadanos para `flood-watch` |
| Oír el cielo | Helicópteros, barcos y satélites del tiempo | Receptor de radio por USB | Hoja de ruta (NOAA APT terminó en 2025) |

Juntos forman un **mapa sensorial**: una capa por sentido sobre el mismo plano. Es un concepto fuerte para presentar a inversores.

## 6. Multiplataforma sin depender de terceros

**Principio:**
- Un **núcleo de referencia** (JavaScript estándar).
- Formatos especificados y vectores de prueba comunes, ya en uso en web, Android y ESP32.
- **Modos de acceso:** pasivo (legal hoy), convenio o nunca.

Así cualquier plataforma se integra sin pedir permiso para lo pasivo y queda lista para el convenio. Detalle en `packages/senda/src/platforms.mjs` y en `/senda/arquitectura`.

**Decisión técnica que corresponde al fundador:**
- Mantener JavaScript como única referencia.
- O además portar la parte crítica a un lenguaje compilable para microcontroladores y certificación (por ejemplo, Rust con WebAssembly).
- Ventaja de portar: rendimiento y certificación. Coste: más mantenimiento.

## 7. Infraestructura de servidor (para la ronda)
- **Relés federados por organismo** (soberanía), con almacenamiento y reenvío entre ellos.
- **Tableros de incidente que se sincronizan sin conexión**, con estructuras de datos sin conflictos (CRDT).
- **Registro de auditoría encadenado**, que ya existe.
- **Opción local** (en las instalaciones del organismo) y opción en la nube, ambas con adecuación al Esquema Nacional de Seguridad.
- **«SENDA Simulacros»:** el mismo motor determinista para entrenar a ayuntamientos y equipos. **Es la vía de ingresos más rápida**, porque no exige certificación de campo.

## 8. Ideas de inversión y modelo de negocio

1. **SENDA Campo, gratis para la ciudadanía.** Su papel es la adopción.
2. **SENDA Coordinación para organismos.** Suscripción por población cubierta.
3. **SENDA Simulacros.** Formación y ejercicios.
4. **Kits de hardware:** sensor Wi-Fi para respiración, pasarela LoRa y carga útil para dron. Requiere marcado CE.
5. **Aviso de riada para municipios en zona inundable.** Integración con los sistemas de cuenca, por convenio.
6. **Licencias y OEM** para operadores de drones y fabricantes.

**Financiación posible:** CDTI, préstamos participativos públicos, Horizonte Europa (seguridad civil), el acelerador del Consejo Europeo de Innovación y capital riesgo privado. **Pendiente de verificar** qué convocatorias están abiertas y sus requisitos.

## 9. Hoja de ruta de 90 días

| Días | Qué | Resultado medible |
|---|---|---|
| 0–30 | 4 móviles físicos: llamada, cadena de voz y sonido en un edificio. 2 placas ESP32 en una casa con consentimiento. Brújula real con aerogeneradores reales | TRL 5 en llamadas y mensajes; primeros datos reales de respiración y resección |
| 30–60 | Carta de intención con un ayuntamiento (zona inundable o afectado por la DANA) y un simulacro | Primer cliente piloto y métricas del simulacro |
| 60–90 | Modelo de amenazas y auditoría básica; decisión de licencia; propuesta a CDTI o Horizonte Europa | Paquete listo para la ronda |

## 10. Fuentes de los hechos citados
- **DANA de Valencia:** 224 fallecidos según el último recuento publicado del Centro de Integración de Datos, recogido por la prensa (pendiente de cierre oficial).
- **Tempi (Grecia, 2023):** 57 fallecidos (Wikipedia, «Tempi train crash»).
- **Ahr (2021):** 190 fallecidos en Alemania y 134 en el valle (*Natural Hazards and Earth System Sciences*, 2025).
- **Satélites NOAA:** baja del NOAA-18 en junio de 2025 y del NOAA-19 y el NOAA-15 en agosto de 2025 (NOAA OSPO).
- **Respiración con ESP32:** validada en condiciones controladas (*Applied Sciences*, 2024); a través de muros, sin validación independiente.
- **AEMET OpenData:** clave gratuita con límite de peticiones.

**Nota de confianza: 80 %.** Las cifras de SENDA se pueden reproducir con las pruebas del repositorio. Los hechos externos están verificados en las fuentes citadas. Las perspectivas institucionales son razonadas, no consultadas: su valor es preparar las conversaciones, no sustituirlas.
