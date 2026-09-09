# Criptografia experimental de la demo

Estas primitivas no activan cifrado extremo a extremo en el flujo de la aplicacion.
La demo publica solo admite datos ficticios; no es un servicio de emergencias.
No se afirma conformidad ENS, certificacion CCN-CERT ni aptitud operativa.

## API y primitivas

- `generateKeyPair(): Promise<SigningKeyPair>` genera exclusivamente Ed25519.
- `generateEncryptionKeyPair(): Promise<EncryptionKeyPair>` genera X25519 con `crypto_box_keypair`.
- Ambos tipos exportados contienen `{ algorithm, publicKey, secretKey }`; `algorithm` es respectivamente `'Ed25519'` o `'X25519'`. Nunca compartir `secretKey`.
- Claves, firmas, ciphertext, salt e IV usan explicitamente libsodium Base64 `ORIGINAL`: alfabeto estandar con padding. No hay formatos anteriores compatibles.
- `encryptMessage(message, recipientPublicKey: string)` conserva el contrato del almacen, pero exige la publica X25519 del destinatario. Una cadena de 32 bytes no identifica su curva: el llamante debe elegir el par correcto; nunca usar la publica Ed25519.
- `decryptMessage(message, recipientKeys: EncryptionKeyPair)` devuelve un sobre con el payload descifrado o lanza error. Rechaza algoritmo incorrecto, destinatario equivocado, ciphertext alterado y contenido que no sea objeto JSON.
- Sealed boxes de libsodium: X25519 efimero, XSalsa20-Poly1305 y nonce derivado con BLAKE2b. El identificador del payload es `X25519-XSalsa20-Poly1305-SealedBox`. No autentican al remitente.
- `signMessage(message, secretKey: string)` y `verifySignature(message, signature: string, publicKey: string)` usan Ed25519. La verificacion devuelve `false` ante firma/clave malformada.
- `CryptoManager` expone esas seis funciones y `storeKeyPair`. Se elimina `generateMnemonic`; no hay frase ni API de recuperacion.

## Firma y metadatos

Se firman `id`, `incidentId`, `createdAt`, `origin`, `payloadType`, `payload`,
`priority`, `approximateLocation` completa, `ttl` y `verificationState`.
Se excluyen firma y todo historial mutable de entrega/enrutamiento. El formato es
UTF-8 de `civic-relay:message:v1\n` seguido de JSON de esos campos: claves de objetos
ordenadas recursivamente mediante `sort()` de JavaScript, orden de arrays conservado.
No es una implementacion de un estandar universal de JSON canonico. Se presupone
un sobre validado y contenido JSON; la validacion de entrada pertenece al llamante.

Solo `payload` se cifra. Ubicacion, origen, prioridad, estado, tiempos e identificadores
siguen visibles. El descifrado por si solo NO detecta cambios en esos metadatos.
Orden recomendado de uso de primitivas: cifrar, firmar el sobre cifrado, verificar
ese mismo sobre con una clave confiable y despues descifrar. La firma deja de
corresponder al sustituir el payload por texto claro. Una firma valida acredita
posesion de clave, no identidad, autoridad `OFFICIAL` ni veracidad del incidente.
Faltan distribucion/autenticacion de claves, revocacion, autorizacion y anti-replay.

## Claves locales y limites

`KeySetup` es solo un aviso experimental desactivado: no genera, lee ni persiste
claves y no se conecta al despacho. No promete E2E ni recuperacion de cuentas.

El helper opcional `storeKeyPair(keys, passphrase)` no se usa desde la interfaz.
Rechaza frases vacias; usa PBKDF2-HMAC-SHA256 (100000 iteraciones, salt aleatorio de
16 bytes) y AES-GCM-256 (IV aleatorio de 12 bytes). Autentica como datos adicionales
el JSON `{ algorithm, publicKey }`. Solo persiste la privada cifrada, en slots
`civic-relay-keypair:Ed25519` y `civic-relay-keypair:X25519`; la publica es visible.
No hay restauracion implementada, politica suficiente de contrasenas, proteccion
contra scripts del mismo origen ni garantia de borrado de secretos de memoria.
Este helper no convierte localStorage en una custodia apta para produccion.

## Pruebas y autorizacion humana

`packages/core/tests/crypto.test.mjs` usa `node:test` e importa `../dist/crypto.js`.
Con core previamente compilado: `pnpm --filter @civic-relay/core exec node --test tests/crypto.test.mjs`.
Cubre ida/vuelta, destinatario incorrecto, ciphertext alterado, metadatos falsificados
(incluidos origen y `OFFICIAL`), exclusiones de firma y almacenamiento sin privada
en claro. Son pruebas de primitivas, no evidencia de E2E en la aplicacion.

Responsables humanos de seguridad y tratamiento de datos: por designar. Antes de
datos reales o fondos operativos deben aprobar arquitectura integrada, modelo de
amenazas, gestion de claves, politica de datos y pruebas negativas del flujo real.
Publicar esta demo estatica no autoriza exponer la API ni tratar datos reales.
