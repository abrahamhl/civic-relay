# 🚀 DEPLOY AHORA - Guía Rápida Vercel

**Tiempo total:** 15 minutos  
**Objetivo:** Tener Civic Relay live en https://civic-relay.vercel.app

---

## ⚡ OPCIÓN 1: DEPLOY RÁPIDO (5 MIN)

### Paso 1: Instalar Vercel CLI (1 min)

```powershell
npm install -g vercel
```

### Paso 2: Login en Vercel (1 min)

```powershell
vercel login
```

Esto abre browser → Login con GitHub/GitLab/Email

### Paso 3: Deploy Preview (2 min)

```powershell
cd C:\Users\2fabr\civic-relay
vercel
```

**Preguntas que aparecerán:**
```
? Set up and deploy "~\civic-relay"? [Y/n] Y
? Which scope do you want to deploy to? [Tu usuario]
? Link to existing project? [y/N] N
? What's your project's name? civic-relay
? In which directory is your code located? ./
```

**Configuración automática detectada:**
```
Auto-detected Project Settings:
- Build Command: pnpm build
- Output Directory: apps/web/dist
- Development Command: pnpm dev
```

¿Todo correcto? **Y**

### Paso 4: ¡Listo! (1 min)

Vercel te dará una URL:
```
✅  Production: https://civic-relay-abc123.vercel.app
```

**Abre esa URL en browser → Tu app está LIVE** 🎉

---

## 🔄 OPCIÓN 2: GITHUB INTEGRATION (AUTO-DEPLOY)

### Paso 1: Conectar GitHub (3 min)

1. Ve a: https://vercel.com/new
2. Click **Import Git Repository**
3. Autoriza Vercel en GitHub
4. Selecciona: `abrahamhl/civic-relay`

### Paso 2: Configurar Proyecto (2 min)

**Framework Preset:** Other  
**Root Directory:** `./`  
**Build Command:** `pnpm build`  
**Output Directory:** `apps/web/dist`  
**Install Command:** `pnpm install --frozen-lockfile`

### Paso 3: Deploy (1 min)

Click **Deploy** → Espera 2-3 min

### Paso 4: ¡Auto-deploy configurado! (1 min)

Ahora cada push a `master`:
- ✅ Deploy automático a producción
- ✅ GitHub status check
- ✅ Preview deployments en PRs

---

## 🔒 CONFIGURAR VARIABLES DE ENTORNO

### En Vercel Dashboard

1. Ve a: https://vercel.com/civic-relay/settings/environment-variables

2. Añade:

| Key | Value | Environment |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Production |
| `VITE_APP_NAME` | `Civic Relay` | All |
| `VITE_APP_VERSION` | `0.1.0` | All |
| `VITE_API_URL` | `https://api.civic-relay.com` | Production |
| `VITE_ENABLE_ANALYTICS` | `true` | Production |

3. Click **Save**

4. **Redeploy** para aplicar variables

---

## 🌍 DOMINIO CUSTOM (OPCIONAL)

### Si quieres civic-relay.com en lugar de .vercel.app

1. Compra dominio:
   - **Namecheap:** ~€10/año
   - **Cloudflare:** ~€8/año (recomendado)
   - **GoDaddy:** ~€12/año

2. En Vercel Dashboard → Domains → Add Domain

3. Añade: `civic-relay.com`

4. Configura DNS (Vercel te da instrucciones exactas):
   ```
   Type  Name  Value
   A     @     76.76.21.21
   CNAME www   cname.vercel-dns.com
   ```

5. Espera 24-48h propagación DNS

6. SSL automático (Let's Encrypt)

---

## ✅ VERIFICAR DEPLOYMENT

### Checklist Post-Deploy

- [ ] URL funciona: https://civic-relay.vercel.app
- [ ] Modo offline funciona (activar modo avión, refresh)
- [ ] Headers seguridad: https://securityheaders.com/?q=https://civic-relay.vercel.app
- [ ] Performance >90: https://pagespeed.web.dev/
- [ ] SSL A+: https://www.ssllabs.com/ssltest/analyze.html?d=civic-relay.vercel.app

---

## 🐛 TROUBLESHOOTING

### Error: "pnpm: command not found"

**Solución:**
```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

### Error: "Build failed - TypeScript error"

**Solución local primero:**
```powershell
cd C:\Users\2fabr\civic-relay
pnpm type-check  # Ver errores
pnpm build       # Verificar build local
```

Si build local funciona pero Vercel falla → Revisar Node.js version (debe ser 20.x)

### Error: "404 on page refresh"

**Solución:** Ya configurado en `vercel.json` (rewrites)

Si persiste:
1. Vercel Dashboard → Settings → General
2. **Framework Preset:** Other
3. Redeploy

---

## 📊 MONITOREAR DEPLOYMENT

### Analytics (Gratis en Vercel)

1. Dashboard → Analytics → Enable
2. Métricas automáticas:
   - Visitas
   - Performance (Core Web Vitals)
   - Top pages
   - Devices/Browsers

### Logs en Tiempo Real

1. Dashboard → Deployments → [Tu deployment] → Logs
2. Ver errores runtime, warnings, etc.

---

## 🔄 ACTUALIZAR DEPLOYMENT

### Desde CLI

```powershell
cd C:\Users\2fabr\civic-relay
git pull  # Si trabajas en equipo
pnpm build  # Verificar local
vercel --prod  # Deploy a producción
```

### Desde Git (Auto-deploy)

```powershell
git add .
git commit -m "feat: nueva feature"
git push origin master
# Vercel auto-deploys en 2-3 min
```

### Rollback si algo falla

**Dashboard:**
1. Deployments → Ver deployment anterior → Promote to Production

**CLI:**
```powershell
vercel rollback
```

---

## 💡 TIPS PRO

### 1. Preview Deployments

Cada branch/PR crea URL preview automática:
```
https://civic-relay-git-feature-abc.vercel.app
```

Úsala para testing antes de merge a master

### 2. Deployment Protection

Dashboard → Settings → Deployment Protection → Enable

Opciones:
- Password protection (solo Pro plan)
- Vercel Authentication (gratis)

### 3. Analytics Avanzado

Integrar Google Analytics:
```typescript
// apps/web/src/main.tsx
import ReactGA from "react-ga4";

if (import.meta.env.PROD) {
  ReactGA.initialize("G-XXXXXXXXXX");
}
```

### 4. Error Tracking (Sentry)

```bash
pnpm add @sentry/react
```

```typescript
// apps/web/src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: "production",
});
```

---

## 🎯 SIGUIENTE PASO

Una vez deployed:

1. **Actualiza documentación:**
   ```markdown
   # En README.md, PITCH_DECK, etc.
   Demo: https://civic-relay.vercel.app
   ```

2. **Comparte URL:**
   - LinkedIn post
   - Emails a municipios
   - Pitch deck actualizado

3. **Monitorea:**
   - Analytics diario (primeras 2 semanas)
   - Errores en Sentry/Vercel logs
   - Performance degradation

---

## 📞 SOPORTE

**Vercel Issues:**
- https://vercel.com/docs
- https://vercel.com/support

**Civic Relay Issues:**
- GitHub: abrahamhl/civic-relay/issues
- Email: abraham@civic-relay.com

---

## ✅ CHECKLIST FINAL

- [ ] Vercel CLI instalado
- [ ] Login en Vercel exitoso
- [ ] Deploy preview funciona
- [ ] Deploy producción funciona
- [ ] Variables de entorno configuradas
- [ ] Headers seguridad OK (A+ en securityheaders.com)
- [ ] Performance >90 (PageSpeed)
- [ ] URL actualizada en README.md
- [ ] URL actualizada en pitch deck
- [ ] Analytics habilitado

---

**🚀 TODO LISTO. Ejecuta `vercel` ahora para deploy.**

**Tiempo estimado:** 5 min CLI, 15 min GitHub integration

**Costo:** €0/mes (Hobby plan)

**URL final:** https://civic-relay.vercel.app
