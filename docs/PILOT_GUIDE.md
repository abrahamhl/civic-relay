# Guía de Piloto - Civic Relay

**Versión:** 1.0  
**Fecha:** 2026-09-09  
**Autor:** Abraham Haddioui  
**Estado:** Listo para propuesta institucional

---

## 🎯 Objetivo del Piloto

Validar **Civic Relay** en un entorno real (Ayuntamiento 50,000+ habitantes) durante **6 meses**, demostrando reducción de tiempo de respuesta en emergencias, mejora en coordinación ciudadana y cumplimiento con ENS Alto.

## 📊 Alcance del Piloto

### Usuarios
- **50 coordinadores** (Protección Civil, Policía Local, Bomberos)
- **10,000 ciudadanos** voluntarios (descarga app)
- **3 centros de coordinación** (112, Policía Local, Protección Civil)

### Tipos de Incidentes
- 🔥 **FIRE** - Incendios urbanos y forestales
- 🚑 **MEDICAL** - Emergencias médicas
- 🏗️ **INFRASTRUCTURE** - Daños en infraestructura pública
- 🌊 **FLOOD** - Inundaciones (si aplica)
- ⚡ **WEATHER** - Alertas meteorológicas

### Zona Geográfica
- **Municipio:** [A definir]
- **Población:** 50,000 - 200,000 habitantes
- **Área:** [XX km²]
- **Cobertura móvil:** 4G/5G + WiFi público

---

## 🛠️ Hardware Requerido

### Centro de Coordinación (×1)
- **Servidor backend:** AWS t3.medium (2 vCPU, 4 GB RAM) o equivalente
- **Base de datos:** PostgreSQL + PostGIS
- **Monitor principal:** 40" para dashboard ejecutivo
- **Workstations:** 3 PCs con 2 monitores (coordinadores)

### Equipos de Campo (×10)
- **Tablets ruguerizadas:** Samsung Galaxy Tab Active Pro o equivalente
  - Pantalla 10.1", IP68 (resistente a agua/polvo)
  - Batería 7,600 mAh (12h autonomía)
  - 4G LTE integrado
  - GPS preciso
- **Powerbanks:** 20,000 mAh por tablet

### Respaldo
- **Router móvil 4G:** 2 unidades (failover)
- **SAI (UPS):** 1500VA para servidor

**Presupuesto Hardware:** €8,000 - €12,000

---

## 📅 Timeline del Piloto

| Mes | Actividad Principal | Hitos Clave |
|-----|---------------------|-------------|
| **1** | Setup + Formación | - Instalación servidor<br>- Formación coordinadores (2 días)<br>- App instalada en tablets<br>- Simulacro inicial |
| **2** | Operación Supervisada | - Uso en incidentes reales (bajo supervisión)<br>- Ajustes configuración<br>- Feedback semanal |
| **3** | Operación Autónoma | - Coordinadores operan de forma independiente<br>- Monitorización remota<br>- Primeros KPIs recolectados |
| **4** | Escala a Ciudadanos | - Campaña comunicación (app ciudadanos)<br>- Primera prueba masiva (10k downloads)<br>- Integración con redes sociales |
| **5** | Optimización | - Análisis datos acumulados<br>- Optimización tiempos respuesta<br>- Ajustes basados en feedback |
| **6** | Evaluación Final | - Report ejecutivo<br>- Presentación resultados<br>- Decisión continuidad |

---

## 📈 KPIs de Éxito

### Objetivo Principal
**Reducción del tiempo medio de respuesta** de **12 minutos** (actual) a **≤ 8 minutos** (con Civic Relay).

### KPIs Secundarios

| Métrica | Objetivo | Actual (estimado) |
|---------|----------|-------------------|
| **Tiempo medio respuesta** | ≤ 8 min | 12 min |
| **Mensajes verificados** | ≥ 80% | 45% |
| **Tasa entrega exitosa** | ≥ 95% | 78% |
| **Incidentes seguridad** | 0 críticos | N/A |
| **Satisfacción coordinadores** | ≥ 70% | N/A |
| **Adopción ciudadana** | 5,000+ descargas | 0 |
| **Disponibilidad sistema** | ≥ 99.5% | N/A |

### Medición
- **Diaria:** Dashboard en tiempo real (disponibilidad, mensajes, errores)
- **Semanal:** Report KPIs a coordinadores
- **Mensual:** Presentación ejecutiva a autoridades
- **Final (Mes 6):** Report completo con recomendaciones

---

## 💶 Presupuesto del Piloto

| Concepto | Coste | Notas |
|----------|-------|-------|
| **Software Civic Relay** | €0 | Gratuito durante piloto |
| **Licencias profesionales (post-piloto)** | €2,500/mes | Si continuidad confirmada |
| **Hardware (tablets)** | €8,000 | 10 tablets + accesorios |
| **Infraestructura cloud** | €300/mes × 6 = €1,800 | AWS (escalable) |
| **Formación on-site** | €2,000 | 2 días formación coordinadores |
| **Consultoría técnica** | €4,000 | Soporte mensual (6 meses) |
| **Campaña comunicación** | €1,500 | Materiales + web campaña app |
| **Contingencia (10%)** | €1,760 | Imprevistos |
| **TOTAL PILOTO** | **€19,560** | ~€3,260/mes durante 6 meses |

**Coste por ciudadano potencial:** €1.96 (sobre 10,000 usuarios)

---

## 🔒 Cumplimiento Legal

### ENS Alto
- ✅ Cifrado E2E (libsodium XSalsa20-Poly1305)
- ✅ Logs de auditoría completos
- ✅ Control de acceso basado en roles (RBAC)
- ✅ Gestión de incidentes de seguridad
- ✅ Plan de continuidad de negocio (BCP)

Ver documento completo: [`docs/ENS_COMPLIANCE.md`](./ENS_COMPLIANCE.md)

### GDPR (RGPD)
- Consentimiento explícito ciudadanos
- Anonimización datos geolocalización
- Derecho al olvido implementado
- DPO (Data Protection Officer) del Ayuntamiento informado

### LSSI
- Aviso legal y política privacidad publicados
- Cookies solo funcionales (no tracking)
- Accesibilidad WCAG 2.1 AA

---

## 🚀 Setup Técnico (Semana 1)

### Paso 1: Servidor Backend

```bash
# AWS EC2 t3.medium (Ubuntu 22.04 LTS)
ssh ubuntu@civic-relay-pilot.ayuntamiento.es

# Instalar Docker
sudo apt update && sudo apt install -y docker.io docker-compose

# Clonar repo
git clone https://github.com/abraham/civic-relay.git
cd civic-relay

# Configurar variables entorno
cp .env.example .env
nano .env
# TENANT_ID=nombre_municipio
# DB_HOST=postgres.rds.amazonaws.com
# CAD_API_URL=https://cad.112.es

# Desplegar
docker-compose up -d

# Verificar
curl http://localhost:3000/health
```

### Paso 2: Base de Datos

```bash
# PostgreSQL 16 + PostGIS
# En AWS RDS o servidor dedicado

CREATE DATABASE civic_relay_pilot;
\c civic_relay_pilot
CREATE EXTENSION postgis;
```

### Paso 3: DNS + SSL

```bash
# Nginx + Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx

sudo certbot --nginx -d civic-relay-pilot.ayuntamiento.es
```

### Paso 4: Configurar Tenant

Editar `config/tenants/piloto.json`:

```json
{
  "id": "piloto_municipio",
  "name": "Municipio - Civic Relay Piloto",
  "branding": {
    "primaryColor": "#003d7a",
    "secondaryColor": "#e95420",
    "logo": "/tenants/piloto/logo.svg"
  },
  "contact": {
    "phone": "+34 XXX XXX XXX",
    "email": "emergencias@ayuntamiento.es",
    "emergencyNumber": "112"
  }
}
```

---

## 📚 Formación Coordinadores (Día 1-2)

### Día 1: Fundamentos (4 horas)

**Mañana (9:00 - 11:00)**
- ¿Qué es Civic Relay? (30 min)
- Demo en vivo: flujo completo (45 min)
- Seguridad y cifrado E2E (15 min)
- Preguntas (30 min)

**Tarde (12:00 - 14:00)**
- Hands-on: tablets (coordinadores)
- Enviar/recibir mensajes
- Verificar alertas
- Despachar unidades

### Día 2: Avanzado (4 horas)

**Mañana (9:00 - 11:00)**
- Dashboard ejecutivo
- Análisis KPIs en tiempo real
- Exportar reports

**Tarde (12:00 - 14:00)**
- Simulacro completo: incendio forestal
- 3 coordinadores + 20 voluntarios (app móvil)
- Debriefing

**Material entregado:**
- Manual operativo (PDF)
- Video tutoriales (3 × 5 min)
- Tarjeta emergencias (contacto soporte 24/7)

---

## 🔥 Caso de Uso: Incendio Forestal

### Escenario
Incendio forestal detectado en Sierra de [Municipio], 14:32h, julio (alto riesgo).

### Flujo con Civic Relay

**T+0 min (14:32h):** Ciudadano en zona detecta fuego
- Abre app Civic Relay
- Selecciona "🔥 Incendio"
- Toma foto + añade ubicación GPS
- Envía alerta → **3 vías simultáneas** (HTTP, WebSocket, SMS)

**T+2 min (14:34h):** Coordinador 112 recibe alerta
- Dashboard CAD muestra incidente
- Mapa con ubicación exacta
- Foto del fuego
- Despacha unidad FIRE-01

**T+5 min (14:37h):** Unidad FIRE-01 confirma llegada
- Envía update desde tablet: "En camino, ETA 8 min"
- Ciudadanos en zona reciben notificación: "Evacuación recomendada"

**T+12 min (14:44h):** Unidad en escena
- Bomberos confirman: "Incendio controlado, no requiere evacuación"
- Civic Relay notifica automáticamente a ciudadanos en radio 5km

**Resultado:**
- **Tiempo total:** 12 minutos (detección → control)
- **Sin Civic Relay:** Estimado 20-25 min (llamada telefónica → confirmación → despacho)
- **Mejora:** 40% reducción tiempo

---

## 📞 Contacto y Soporte

### Durante el Piloto
- **Soporte técnico 24/7:** support@civic-relay.com
- **Teléfono emergencias:** +34 XXX XXX XXX
- **Slack workspace:** civic-relay-pilot.slack.com
- **Dashboard monitorización:** https://status.civic-relay-pilot.ayuntamiento.es

### Equipo Abraham Haddioui
- **Abraham Haddioui** - CTO & Founder
- **Email:** abraham@civic-relay.com
- **LinkedIn:** [abraham-haddioui](#)

---

## 📄 Anexos

- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Checklist técnico completo
- [ENS_COMPLIANCE.md](./ENS_COMPLIANCE.md) - Cumplimiento ENS Alto
- [RISK_ANALYSIS.md](./RISK_ANALYSIS.md) - Análisis de riesgos
- [SECURITY_PROCEDURES.md](./SECURITY_PROCEDURES.md) - Procedimientos seguridad

---

**Preparado por:** Abraham Haddioui - Civic Relay  
**Para:** Ayuntamientos y autoridades regionales (España)  
**Última actualización:** 2026-09-09
