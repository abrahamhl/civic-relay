# Deployment Checklist - Civic Relay Piloto

**Versión:** 1.0  
**Fecha:** 2026-09-09  
**Objetivo:** Garantizar despliegue exitoso del piloto institucional

---

## 📋 Pre-Deployment (Semana -1)

### Infraestructura Cloud

- [ ] **Servidor AWS EC2 provisionado**
  - Tipo: t3.medium (2 vCPU, 4 GB RAM)
  - OS: Ubuntu 22.04 LTS
  - Región: eu-west-1 (Irlanda) o eu-south-1 (Milán)
  - Storage: 50 GB SSD EBS

- [ ] **Base de datos PostgreSQL + PostGIS**
  - AWS RDS: db.t3.small (2 GB RAM)
  - Versión: PostgreSQL 16
  - Extensión PostGIS instalada
  - Backup automático diario (7 días retención)

- [ ] **DNS configurado**
  - Dominio: civic-relay-pilot.ayuntamiento.es
  - Registro A apuntando a IP pública del servidor
  - TTL: 3600s

- [ ] **Certificado SSL instalado**
  - Let's Encrypt (renovación automática)
  - Cifrado TLS 1.3
  - Verificado con ssllabs.com (grado A+)

- [ ] **Firewall configurado**
  - Puerto 22 (SSH): Solo IPs oficina + VPN
  - Puerto 80/443 (HTTP/HTTPS): Abierto
  - Puerto 3001 (API CAD): Solo desde IPs 112
  - Todo el resto: Cerrado

- [ ] **Backup automático configurado**
  - Snapshots EBS diarios (AWS)
  - Export base de datos a S3 (cada 6 horas)
  - Backups retenidos 30 días

---

## 🚀 Deployment Day 0

### Backend Deployment

- [ ] **Código desplegado**
  ```bash
  git clone https://github.com/abraham/civic-relay.git
  cd civic-relay
  git checkout tags/v1.0.0-pilot
  ```

- [ ] **Variables de entorno configuradas**
  ```bash
  cp .env.example .env
  nano .env
  ```
  Verificar:
  - `TENANT_ID=piloto_municipio`
  - `DB_CONNECTION_STRING=postgresql://...`
  - `CAD_API_URL=https://cad.112.es`
  - `JWT_SECRET=...` (generado de forma segura)
  - `ENCRYPTION_MASTER_KEY=...` (generado con libsodium)

- [ ] **Docker Compose levantado**
  ```bash
  docker-compose up -d
  ```
  Servicios corriendo:
  - `web` (puerto 3000)
  - `api` (puerto 3001)
  - `postgres` (puerto 5432)

- [ ] **Smoke tests pasados**
  ```bash
  curl http://localhost:3000/health
  # Expected: {"status":"OK"}
  
  curl http://localhost:3001/api/cad/stats
  # Expected: {"success":true,"stats":{...}}
  ```

### Frontend Deployment

- [ ] **Build producción generado**
  ```bash
  pnpm build
  ```

- [ ] **Nginx configurado**
  ```nginx
  server {
    listen 443 ssl http2;
    server_name civic-relay-pilot.ayuntamiento.es;
    
    root /var/www/civic-relay/dist;
    index index.html;
    
    location / {
      try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
      proxy_pass http://localhost:3001;
    }
  }
  ```

- [ ] **Tenant branding aplicado**
  - Logo del ayuntamiento en `/public/tenants/piloto/logo.svg`
  - Colores institucionales en `config/tenants/piloto.json`
  - Favicon actualizado

### Integración 112/CAD

- [ ] **API keys intercambiadas**
  - API key Civic Relay → 112: `CIVIC_RELAY_API_KEY`
  - API key 112 → Civic Relay: `CAD_112_API_KEY`

- [ ] **Webhook configurado**
  - URL: `https://cad.112.es/webhook/civic-relay`
  - Eventos: `ticket.created`, `ticket.updated`, `unit.dispatched`

- [ ] **Test de integración**
  ```bash
  curl -X POST https://civic-relay-pilot.ayuntamiento.es/api/cad/dispatch \
    -H "Content-Type: application/json" \
    -d '{"type":"FIRE","location":{"lat":40.4,"lon":-3.7}}'
  ```

---

## 🧪 Post-Deployment (Día 1-7)

### Formación Coordinadores

- [ ] **Día 1: Formación básica**
  - Presentación sistema (30 min)
  - Demo en vivo (45 min)
  - Hands-on tablets (1 hora)

- [ ] **Día 2: Formación avanzada**
  - Dashboard ejecutivo (45 min)
  - Simulacro completo (2 horas)
  - Debriefing (30 min)

- [ ] **Material entregado**
  - Manual operativo (PDF)
  - Videos tutoriales (3 × 5 min)
  - Tarjeta contacto soporte 24/7

### Pruebas End-to-End

- [ ] **Simulacro Incendio**
  - Ciudadano envía alerta 🔥
  - Coordinador recibe en dashboard
  - Unidad despachada
  - Confirmación en tiempo real
  - **Tiempo total:** < 5 min

- [ ] **Simulacro Emergencia Médica**
  - Alerta 🚑 con ubicación GPS
  - Foto adjunta verificada
  - Ambulancia despachada
  - Actualización estado paciente
  - **Tiempo total:** < 3 min

- [ ] **Simulacro Infraestructura**
  - Daño en carretera 🏗️
  - Múltiples ciudadanos reportan
  - Sistema detecta duplicados
  - Una sola alerta consolidada
  - Brigada municipal despachada

### Monitorización Activa

- [ ] **Grafana configurado**
  - Dashboard: CPU, RAM, disco, red
  - Alertas: CPU > 80%, RAM > 90%, disco > 85%
  - Notificaciones: Slack + Email

- [ ] **Logs centralizados**
  - CloudWatch Logs (AWS)
  - Retención: 30 días
  - Filtros de errores críticos

- [ ] **Uptime monitoring**
  - UptimeRobot o Pingdom
  - Checks cada 1 minuto
  - Alertas a team si downtime > 3 min

### Soporte 24/7 Activado

- [ ] **Slack workspace creado**
  - `#soporte-tecnico`
  - `#incidentes`
  - `#coordinadores-piloto`

- [ ] **On-call rotation configurada**
  - Semana 1-2: Abraham Haddioui (24/7)
  - Semana 3+: Rotación con equipo
  - PagerDuty o equivalente

- [ ] **Playbooks preparados**
  - **P0:** Sistema caído → escalar inmediatamente
  - **P1:** Funcionalidad crítica rota → fix en < 1h
  - **P2:** Bug no bloqueante → fix en < 24h
  - **P3:** Mejora sugerida → backlog

---

## 📊 Operación (Mes 1-6)

### Weekly Health Checks

**Cada lunes 9:00h:**

- [ ] Revisar dashboard Grafana (última semana)
- [ ] Verificar backups completados (7 días)
- [ ] Comprobar logs de errores
- [ ] Test smoke manual (enviar alerta test)
- [ ] Actualizar notas de operación

### Monthly KPI Reports

**Último viernes de cada mes:**

- [ ] Generar report KPIs desde dashboard político
- [ ] Exportar a PDF ejecutivo
- [ ] Enviar a:
  - Alcalde/Concejal Seguridad
  - Jefe Protección Civil
  - Coordinador 112
  - DPO (Data Protection Officer)

**KPIs incluidos:**
- Total incidentes gestionados
- Tiempo medio respuesta
- Tasa verificación
- Tasa entrega exitosa
- Incidentes seguridad
- Satisfacción coordinadores
- Adopción ciudadana (descargas app)

### Incident Response Plan Tested

**Cada trimestre:**

- [ ] **Simulacro caída completa sistema**
  - Apagar servidor intencionadamente
  - Activar plan contingencia
  - Restaurar desde backup
  - **Meta:** Sistema operativo en < 30 min

- [ ] **Simulacro brecha seguridad**
  - Detectar intrusión simulada
  - Aislar servidor comprometido
  - Notificar a autoridades (CCN-CERT)
  - Análisis forense
  - Report post-mortem

### User Feedback Collected

**Encuestas trimestrales:**

- [ ] **Coordinadores** (10 min)
  - Facilidad de uso: 1-5
  - Utilidad percibida: 1-5
  - Problemas encontrados: texto libre
  - Sugerencias mejora: texto libre

- [ ] **Ciudadanos** (5 min)
  - ¿Has usado la app? Sí/No
  - ¿Funcionó correctamente? Sí/No
  - ¿La recomendarías? 1-10 (NPS)
  - Comentarios: texto libre

---

## ✅ Mes 6: Evaluación Final

### Report Ejecutivo

- [ ] **Documento preparado** (20-30 páginas)
  - Executive summary (2 páginas)
  - KPIs alcanzados vs. objetivos
  - Casos de uso destacados (3-5)
  - Comparativa antes/después
  - Análisis coste-beneficio
  - Recomendaciones

- [ ] **Presentación PowerPoint** (15 slides)
  - Para rueda de prensa / pleno
  - Gráficos impactantes
  - Testimonios coordinadores
  - Videos simulacros

### Decisión Continuidad

**Opciones:**

1. **Continuación (éxito):**
   - Extender a todo el municipio
   - Licencia profesional: €2,500/mes
   - Soporte continuo

2. **Extensión temporal:**
   - 3 meses adicionales
   - Resolver issues pendientes
   - Re-evaluar

3. **Finalización (no cumple KPIs):**
   - Export datos históricos
   - Desmantelar infraestructura
   - Lecciones aprendidas (post-mortem)

---

## 🚨 Rollback Plan

**Si algo va mal en producción:**

### Severidad P0 (Sistema caído, no recuperable en < 1h)

1. **Activar plan contingencia:**
   - Notificar coordinadores: "Sistema temporalmente fuera de servicio"
   - Revertir a sistema legacy (llamadas telefónicas)

2. **Rollback a versión anterior:**
   ```bash
   cd /opt/civic-relay
   git checkout tags/v0.9.0-stable
   docker-compose up -d --force-recreate
   ```

3. **Restaurar desde backup:**
   ```bash
   # Snapshot EBS más reciente
   aws ec2 create-volume --snapshot-id snap-xxxxx
   ```

4. **Comunicar ETA:**
   - Slack `#coordinadores-piloto`
   - Email a lista coordinadores
   - Update cada 30 min

### Severidad P1 (Funcionalidad crítica rota)

1. **Hotfix inmediato:**
   ```bash
   git cherry-pick <commit-hash-fix>
   docker-compose restart web
   ```

2. **Test smoke:**
   ```bash
   curl https://civic-relay-pilot.ayuntamiento.es/health
   ```

3. **Notificar resolución:**
   - Slack con detalles técnicos
   - No requiere comunicación masiva

---

## 📞 Contactos Clave

### Técnico
- **Abraham Haddioui (CTO):** +34 XXX XXX XXX, abraham@civic-relay.com
- **Equipo DevOps:** devops@civic-relay.com
- **Soporte 24/7:** support@civic-relay.com

### Institucional
- **Alcalde/Concejal Seguridad:** [Nombre], [Email], [Teléfono]
- **Jefe Protección Civil:** [Nombre], [Email], [Teléfono]
- **Coordinador 112:** [Nombre], [Email], [Teléfono]
- **DPO:** [Nombre], [Email], [Teléfono]

### Emergencias
- **PagerDuty:** https://civic-relay.pagerduty.com
- **AWS Support (Business):** +44 800 XXX XXXX
- **CCN-CERT (seguridad):** certsi@ccn.cni.es, +34 91 XXX XXXX

---

**Preparado por:** Abraham Haddioui - Civic Relay  
**Revisado por:** [CTO Ayuntamiento / Responsable IT]  
**Aprobado por:** [Concejal Seguridad / Alcalde]  
**Última actualización:** 2026-09-09
