'use client';

import { useEffect, useRef } from 'react';

/**
 * Native CSS Scroll-Driven top telemetry bar (`animation-timeline: scroll(root)`),
 * with a lightweight passive scroll fallback ONLY when scroll-driven animations
 * are unsupported and `prefers-reduced-motion: no-preference` matches.
 */
export default function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline', 'scroll()')) {
      return;
    }

    el.classList.add('is-js-fallback');
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.max(0, Math.min(1, window.scrollY / max));
      el.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={barRef} className="s-scroll-progress" aria-hidden="true" />;
}
