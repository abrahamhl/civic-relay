# 🚀 Guía de Despliegue en Vercel: Civic Relay hyper-boost

He implementado y preparado todos los assets 3D de alta gama y ajustado la configuración (resolviendo los errores de tipos introducidos por Claude y las dependencias de Vite/Tailwind) para que la página sea un espectáculo tecnológico para inversores. 

Dado que la sesión de `Vercel CLI` actualmente carece de autenticación en la máquina local, aquí tienes los 3 sencillos comandos para poner la demo 3D táctica online:

### 1. Inicia sesión en Vercel
En la terminal, corre:
```bash
cd C:\Users\2fabr\civic-relay
npx vercel login
```
*Sigue las instrucciones en el navegador para conectar tu cuenta (puedes usar GitHub).*

### 2. Despliegue en Preview (Opcional, para testear)
```bash
npx vercel
```
*Te preguntará cómo configurar el proyecto. Acepta los valores por defecto:*
* Set up and deploy? **Y**
* Which scope? **[Tu usuario]**
* Link to existing project? **N**
* What's your project's name? **civic-relay**
* In which directory is your code located? **.**
* Want to modify these settings? **N**

### 3. Despliegue en Producción
Una vez comprobado, pásalo a producción para enviar el enlace a los inversores:
```bash
npx vercel --prod
```

### ✅ ¡Listo!
Ya tienes una demo de primer nivel para reventar las expectativas de los inversores. He actualizado la copia y añadido un informe de Due Diligence que los posicionará para reemplazar a Motorola y Airbus.
