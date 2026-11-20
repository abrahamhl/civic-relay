'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Defers mounting heavy dynamic interactive engines (Three.js 3D Globe, Palantir Labs)
 * until the container is within rootMargin of the viewport or explicitly activated.
 * Keeps Home initial JS < 170 kB gz and Lighthouse >= 95 while delivering full live WebGL/simulators.
 */
export default function LazySection({
  children,
  placeholderHeight = 520,
  rootMargin = '320px 0px',
  id
}: {
  children: ReactNode;
  placeholderHeight?: number;
  rootMargin?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;

    // If URL hash targets this section, mount immediately
    if (id && typeof window !== 'undefined' && window.location.hash === `#${id}`) {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, mounted, rootMargin]);

  return (
    <div
      ref={ref}
      id={id}
      className="s-lazy-band"
      style={mounted ? undefined : { minHeight: placeholderHeight }}
    >
      {mounted ? children : null}
    </div>
  );
}
