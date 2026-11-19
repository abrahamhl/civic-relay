'use client';

import type { Locale } from '../data/types';
import EvidenceBadge from './EvidenceBadge';

export interface MediaVideoProps {
  locale: Locale;
  src: string;
  poster?: string;
  caption: string;
  evidenceId: string;
  vttSrc?: string;
  loop?: boolean;
  controls?: boolean;
}

export default function MediaVideo({
  locale,
  src,
  poster,
  caption,
  evidenceId,
  vttSrc,
  loop = true,
  controls = true
}: MediaVideoProps) {
  return (
    <figure className="s-media-card">
      <div className="s-video-wrap">
        <video
          className="s-video"
          src={src}
          poster={poster}
          muted
          loop={loop}
          playsInline
          controls={controls}
          preload="metadata"
          width={1280}
          height={720}
        >
          {vttSrc ? (
            <track
              kind="captions"
              src={vttSrc}
              srcLang={locale}
              label={locale.toUpperCase()}
              default
            />
          ) : null}
        </video>
      </div>
      <figcaption>
        <span>{caption}</span>
        <EvidenceBadge locale={locale} evidenceId={evidenceId} />
      </figcaption>
    </figure>
  );
}
