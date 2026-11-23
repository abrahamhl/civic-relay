// Guardar un archivo generado en la página. Dentro de la app Android el visor web ignora las descargas
// «blob:», así que se envía a la parte nativa por trozos (Descargas/SENDA). En el navegador, descarga normal.
export async function saveBlob(blob, name, onProgress = () => {}) {
  const N = window.SendaNative;
  if (typeof N?.fileBegin !== 'function') {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    return { ok: true, where: 'Descargas del navegador' };
  }
  const id = N.fileBegin(name, blob.type || 'application/octet-stream');
  if (!id) return { ok: false, where: '' };
  const CH = 768 * 1024; // trozos de 768 KB (≈1 MB en base64)
  for (let off = 0; off < blob.size; off += CH) {
    const buf = new Uint8Array(await blob.slice(off, off + CH).arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    if (!N.fileChunk(id, btoa(s))) return { ok: false, where: '' };
    onProgress(Math.min(1, (off + CH) / blob.size));
  }
  const where = N.fileEnd(id);
  return { ok: !!where, where };
}
