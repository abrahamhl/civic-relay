# AUDITORÍA DE RENDERS AUDIOVISUALES Y SUITE M95 (SENDA)
**Versión:** 1.0.0-VideoAudit  
**Fecha:** 2026-11-08  
**Autor:** Multiagente OpenCode / Media Production & QA Lead  

---

## 1. RESUMEN DE LA SUITE DE VÍDEOS DE MISIÓN 95

Para respaldar la comunicación técnica e institucional sin depender de maquetas estáticas, SENDA dispone de una suite completa de **15 vídeos de alta resolución (1080p)** que demuestran la propagación física del incendio, las simulaciones de tráfico LWR, los protocolos DTN y las rutas de evacuación.

Los 15 archivos se encuentran verificados en el entorno de almacenamiento local (`investor-next/public/media/m95/`), protegidos frente a inclusión directa en Git mediante `.gitignore` para preservar la ligereza del repositorio y catalogados de forma inmutable por sus firmas SHA-256 en `evidence/video/m95/SHA256SUMS.txt` y `evidence/video/m95/ffprobe-all-15.json`.

---

## 2. TABLA MAESTRA DE VERIFICACIÓN TÉCNICA (FFPROBE & SHA-256)

| # | Nombre de Archivo | Duración (s) | Tamaño (MB) | Resolución | FPS | Códec V/A | Hash SHA-256 Verificado |
| :-: | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `senda-m95-30s-en.mp4` | 33.72 | 1.92 | 1920x1080 | 25 | H.264 / AAC | `1c28b22b3161374ab6f21a4b63be999c4f2478e8ceafd53bad7350b8a3a75e6a` |
| **2** | `senda-m95-60s-en.mp4` | 62.48 | 3.61 | 1920x1080 | 25 | H.264 / AAC | `edeaa687ab0accb3ed94fda0f226494a32b20061f623567cf0006d41333d0bf4` |
| **3** | `senda-m95-90s-en.mp4` | 92.24 | 5.78 | 1920x1080 | 25 | H.264 / AAC | `18437bdf3187102dd787a30d5d215ed292c512e201196a2483232029303d1efa` |
| **4** | `senda-m95-film-en.mp4` | 530.12 | 53.92 | 1920x1080 | 25 | H.264 / AAC | `7d53e52cd440fbee03a1639a42aef5b2569d2ade126e8505089818a426d14024` |
| **5** | `senda-m95-ruta-en.mp4` | 218.28 | 22.21 | 1920x1080 | 25 | H.264 / AAC | `3a13e6fee05ab250c191181dd69426a52e8edd41e44265c74641ef96a20d8b20` |
| **6** | `senda-m95-sim-braking-en.mp4` | 24.48 | 1.90 | 1920x1080 | 25 | H.264 / AAC | `c1f40f1d0f3c60641d24dab1307f70224af88f7172e798f9b75df9a57d935cd5` |
| **7** | `senda-m95-sim-proof-en.mp4` | 27.64 | 1.26 | 1920x1080 | 25 | H.264 / AAC | `ec1d3e8ace4c14214dc5b365f63679a4a3f51de2f683309e893b991e31c5a679` |
| **8** | `senda-m95-sim-queue-en.mp4` | 19.30 | 1.45 | 1920x1080 | 25 | H.264 / AAC | `12d82c5cc59d6cdbc9380ec3d709dd4115c94258a8bc62484bfbb2b2c827cbc2` |
| **9** | `senda-m95-sim-sos-en.mp4` | 22.16 | 1.90 | 1920x1080 | 25 | H.264 / AAC | `a7d7e0b9828bed1a918770bc0c1b62c57af923608aec26f9793e32b67163d183` |
| **10** | `senda-m95-sim-visibility-en.mp4` | 18.96 | 1.59 | 1920x1080 | 25 | H.264 / AAC | `887230dfc8a1a4d20ed72193d335484bfc26ed96da380ece627ac0ec623283fc` |
| **11** | `senda-m95-sim-wrongway-en.mp4` | 16.36 | 1.54 | 1920x1080 | 25 | H.264 / AAC | `aea07ffd8e337111eeca165b7b60f9232c94940ef63805339bef262c925e6fb9` |
| **12** | `senda-m95-vertical-45s-en.mp4` | 42.80 | 2.87 | 1080x1920 | 25 | H.264 / AAC | `eb8ac1c788e786aa71810052097e6d8ffccea6611241a56af003e07817469931` |
| **13** | `senda-m95-vertical-45s-en-sub-en.mp4`| 42.80 | 3.11 | 1080x1920 | 25 | H.264 / AAC | `82be00a526235c01dfe75b4fbad62ad927cb85ecf33b5fcf5eac8d9bca4a355a` |
| **14** | `senda-m95-vertical-45s-en-sub-es.mp4`| 42.80 | 3.11 | 1080x1920 | 25 | H.264 / AAC | `da409d9cee2884b1ceadaffb7aa97842cea8b58db28cc914fbea0d4560e88c2f` |
| **15** | `senda-m95-vertical-45s-en-sub-nl.mp4`| 42.80 | 3.14 | 1080x1920 | 25 | H.264 / AAC | `cce7cd80d1d250fc4bdb3d958fc8a85fbe7464bfe184931d5df82a95bb0a51e3` |

---

## 3. AUDITORÍA DE PISTAS DE SUBTÍTULOS (.VTT) Y PÓSTERES

El subdirectorio `investor-next/public/media/m95/` contiene 36 pistas de subtítulos en formato WebVTT estándar (`.vtt`) y los pósteres visuales asociados en alta resolución:
- **Subtítulos:** Cobertura trilingüe completa (Inglés `.en.vtt`, Español `.es.vtt`, Neerlandés `.nl.vtt`) sincronizados código temporal a código temporal con las locuciones de los vídeos.
- **Pósteres:**
  - `senda-m95-film-poster.jpg` (SHA-256: `3b89b4e723326d6df38520bfd6484eef036efcbf5950d2bb2d9f740a6bdafaeb`)
  - `senda-m95-ruta-poster.jpg` (SHA-256: `a91f584bfb6fc917e3fe8b41ea87d191147a40dfcba6d7d519be79796ff1b831`)

---

## 4. ESTRATEGIA DE PUBLICACIÓN Y DISTRIBUCIÓN
1. **Almacenamiento Perimetral / CDN:** Para el despliegue en producción sin saturar los límites de tamaño de repositorio de Git, los 15 vídeos se publican en un bucket compatible S3 / Cloudflare R2 con enlace firmado o dominio de CDN de baja latencia (`https://media.civicrelay.net/m95/`).
2. **Fallback Local:** En entornos de desarrollo o demostración aislada de red (offline), la aplicación Next.js y el reproductor de SENDA sirven los vídeos directamente desde el directorio estático local.
