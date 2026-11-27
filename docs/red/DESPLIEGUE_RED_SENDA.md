# Desplegar un servidor de la red SENDA (paso a paso)

Estado a 27-11-2026. El código está probado con pruebas automáticas (`packages/senda-relay/tests`). **El despliegue en un servidor real aún no
se ha hecho:** los pasos 3–5 están sin probar en una máquina de verdad.

## Qué es y qué no es
- **Es** nuestro servidor, programado desde cero y sin dependencias (`packages/senda-relay`). Hace dos cosas:
  - es relé Nostr en `wss://dominio/nostr`, y solo acepta buzones cifrados SENDA;
  - sincroniza sobres en `/sync` y se pasa buzones con los demás servidores SENDA (`PEERS`).
- **No ve** quién escribe, a quién, ni qué (`docs/red/PASARELAS_SENDA.md` §5).
- **No guarda IPs en disco.** Ni el relé ni Caddy escriben registros de acceso. La IP solo se usa en memoria para
  limitar peticiones.
- **Lo único externo** es software libre que corre en nuestra máquina: Node 22, Docker y Caddy (HTTPS automático con
  certificados gratuitos de Let's Encrypt). No hay ningún servicio de terceros en el camino de los mensajes.

## 1. Máquina (decisión y pago del fundador)
Precios leídos el 27-11-2026 en las páginas oficiales:

| Opción | Precio | Condiciones |
|---|---|---|
| netcup VPS pico G11.5s (1 vCore, 1 GB, 30 GB) | 2,21 €/mes **con IVA** | 12 meses de permanencia, 1 por cliente, solo en Núremberg |
| OVHcloud VPS-1 (2 vCores, 4 GB, 40 GB) | desde 3,81 €/mes **sin IVA** | Permanencia y país no verificados |

Para la red: **2 servidores en países distintos** (por ejemplo, Alemania y otro de la UE) federados entre sí. Si uno
cae, el otro sigue.

## 2. Dominio
Un nombre, por ejemplo `senda-nl.tudominio.eu`, con un registro **A** que apunte a la IP del servidor. El precio
del dominio no está verificado.

## 3. Instalar (en el servidor, como administrador)
1. Instala Docker Engine con el plugin compose, siguiendo la guía oficial (docs.docker.com/engine/install).
2. Abre en el cortafuegos solo los puertos 22, 80 y 443.
3. Despliega:
```bash
git clone https://github.com/abrahamhl/civic-relay.git && cd civic-relay
SENDA_DOMAIN=senda-nl.tudominio.eu PEERS=https://senda-es.tudominio.eu \
  docker compose -f packages/senda-relay/deploy/compose.yaml up -d --build
```
En el segundo servidor, lo mismo, con su dominio y `PEERS` apuntando al primero.

## 4. Comprobar
```bash
curl https://senda-nl.tudominio.eu/health        # {"ok":true,…,"nostrEvents":0,"peers":1,…}
curl -H 'Accept: application/nostr+json' https://senda-nl.tudominio.eu/nostr   # ficha NIP-11 «Relé SENDA»
```

## 5. Conectar la app
Dile a Claude los dominios y hará tres cosas:
- añadirlos a `SENDA_SERVERS` en `investor-next/public/senda/nostr-link.mjs`, como servidores por defecto;
- abrir su `wss://` en `connect-src` de `investor-next/vercel.json`;
- comprobar la entrega entre los dos servidores con dos móviles.

Mientras tanto, cada persona puede escribirlos a mano en **Transferir → 🌍 Red SENDA**.

## 6. Mantenimiento
- Para actualizar: `git pull` y el mismo comando `docker compose … up -d --build`.
- Los datos viven en el volumen `senda-data`, que guarda sobres en tránsito y buzones hasta que caducan
  (máximo 90 días).
- La salud se consulta en `/health`, que muestra la fecha de la última federación con cada par.

---
*Registro de cambios* · 27-11-2026 · Primera versión del kit (`packages/senda-relay/deploy`). Firma: Claude (sesión de orquestación SENDA).
