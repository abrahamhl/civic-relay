// Marco común de la app SENDA: solo se activa DENTRO de la app (Android/WebView, app instalada o ?app=1).
// En la web pública cada página conserva su diseño. Dentro de la app añade una barra superior al estilo
// de las guías de Apple («‹ Inicio» + título) y oculta las navegaciones antiguas marcadas con data-legacy-nav.
const params = new URLSearchParams(location.search);
const inApp = !!window.SendaNative || params.has('app') || matchMedia('(display-mode: standalone)').matches
  || sessionStorage.getItem('senda.inApp') === '1';

if (inApp && !location.pathname.endsWith('/senda/app') && !location.pathname.endsWith('/senda/app.html')) {
  try { sessionStorage.setItem('senda.inApp', '1'); } catch { /* sin almacenamiento */ }
  const title = (document.title || 'SENDA').replace(/^SENDA(-3D)?\s*[·—:-]?\s*/i, '').replace(/\s*—.*$/, '').trim() || 'SENDA';
  const css = `
  .senda-chrome{position:sticky;top:0;z-index:2147483000;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
    height:48px;padding:0 8px;background:rgba(0,0,0,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    border-bottom:.5px solid rgba(84,84,88,.6);font:17px/1 Inter,-apple-system,system-ui,sans-serif;letter-spacing:-.01em}
  .senda-chrome a{display:inline-flex;align-items:center;gap:2px;color:#ff7756;text-decoration:none;padding:10px 8px;font-size:17px}
  .senda-chrome a svg{width:20px;height:20px}
  .senda-chrome b{font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62vw;text-align:center}
  html.in-app [data-legacy-nav]>a{display:none!important}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  document.documentElement.classList.add('in-app');
  const bar = document.createElement('div');
  bar.className = 'senda-chrome';
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Navegación de la app');
  const back = document.createElement('a');
  back.href = '/senda/app';
  back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>Inicio';
  const name = document.createElement('b');
  name.textContent = title;
  bar.append(back, name, document.createElement('span'));
  const mount = () => document.body.prepend(bar);
  if (document.body) mount(); else addEventListener('DOMContentLoaded', mount, { once: true });
}
