# Relé SENDA (`@senda/relay`)

Un nodo más de la red **almacenar-transportar-reenviar** de SENDA, pero con Internet. Cuando un
teléfono tiene conexión (aunque sea un minuto), sube lo que lleva y baja lo que otros dejaron para
la zona. Cuando no la tiene, SENDA sigue funcionando por sonido, archivo y mulas: el relé es un
atajo, **nunca un requisito**.

| | |
|---|---|
| Ciego al contenido | Solo ve cabeceras de enrutamiento (destino por huella, caducidad, prioridad). Mensajes cifrados extremo a extremo (ECDH P-256 + AES-256-GCM). La prueba E2E comprueba que el texto no aparece en su almacén. |
| Sin dependencias | Node 22 y el núcleo `packages/senda/src`. Nada de `npm install`. |
| Soberano | Lo opera el organismo en su propia infraestructura (contenedor, máquina virtual o servidor municipal). |
| Persistente | `DATA_DIR/store.json`, escritura atómica cada 5 s; sobrevive a reinicios. |
| Defensivo | Límite de tamaño de petición, 120 peticiones/min por IP, validación de forma, cuota de 256 MB, purga de caducados, CORS configurable. |

## API

- `GET /health` → `{ ok, items, broadcasts, bytes }`
- `POST /sync` con `{ summary, envelopes, receipts, broadcasts }` (lo que produce `createBundleStore().summary()/prepareFor()`): ingiere y responde con lo que al cliente le falta.

Las **alertas firmadas** (`SENDA_SIGNED_COMMAND`) se transportan pero **no se verifican en el relé**:
la verificación (ancla del organismo → credencial → clave → firma, consentimiento, zona, destino)
ocurre en cada teléfono, que es quien decide. Una alerta falsa ocupa cuota, no ejecuta nada.

## Ejecutar

```bash
# local
node packages/senda-relay/server.mjs            # :8787, datos en ./data
# contenedor (desde la raíz del repositorio)
docker build -f packages/senda-relay/Dockerfile -t senda-relay .
docker run -p 8787:8787 -v senda-relay-data:/data -e ALLOWED_ORIGINS=https://civic-relay-investor.vercel.app senda-relay
```

Variables: `PORT` (8787), `DATA_DIR` (`./data`), `ALLOWED_ORIGINS` (lista separada por comas; `*` por defecto),
`MAX_BODY` (2 MB). Publícalo detrás de HTTPS (proxy inverso del organismo): la web solo puede hablar
con relés `https://` desde su dominio público.

En la app: **Transferir › Relé por Internet** → dirección del relé → «Sincronizar».

## Pruebas

```bash
node --test packages/senda-relay/tests/*.test.mjs   # unidad: sincronización, persistencia, validación
node investor-next/scripts/senda-offline-e2e.mjs    # E2E: A sube con red, C baja y transporta sin red, B recibe
```
