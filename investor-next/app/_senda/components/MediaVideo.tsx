'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Subtitles } from 'lucide-react';
import type { Locale } from '../data/types';
import EvidenceBadge from './EvidenceBadge';

export interface MediaVideoProps {
  locale: Locale;
  /** Default / fallback video source */
  src: string;
  /** Optional language-specific video sources (auto-selected from browser language) */
  sources?: Partial<Record<Locale, string>>;
  /** Optional language-specific posters */
  posters?: Partial<Record<Locale, string>>;
  poster?: string;
  /** Trilingual WebVTT subtitle tracks (ES / EN / NL) */
  subtitles?: Partial<Record<Locale, string>>;
  /** Legacy single VTT fallback */
  vttSrc?: string;
  caption: string;
  title?: string;
  evidenceId?: string;
  loop?: boolean;
  controls?: boolean;
}

function detectBrowserLocale(fallback: Locale): Locale {
  if (typeof navigator === 'undefined') return fallback;
  const langs = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language || ''];
  for (const raw of langs) {
    const code = String(raw || '').toLowerCase();
    if (code.startsWith('es')) return 'es';
    if (code.startsWith('nl')) return 'nl';
    if (code.startsWith('en')) return 'en';
  }
  return fallback;
}

const SUB_LABELS: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
  nl: 'Nederlands'
};

export default function MediaVideo({
  locale,
  src,
  sources,
  posters,
  poster,
  subtitles,
  vttSrc,
  caption,
  title,
  evidenceId,
  loop = false,
  controls = true
}: MediaVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const availableAudio = (['es', 'en', 'nl'] as Locale[]).filter((l) => Boolean(sources?.[l]));
  const availableSubs: Partial<Record<Locale, string>> = subtitles
    ? subtitles
    : vttSrc
    ? { [locale]: vttSrc }
    : {};
  const subLangs = (['es', 'en', 'nl'] as Locale[]).filter((l) => Boolean(availableSubs[l]));

  const initialAudio: Locale = sources?.[locale]
    ? locale
    : availableAudio[0] ?? locale;

  const [audioLang, setAudioLang] = useState<Locale>(initialAudio);
  const [detectedLang, setDetectedLang] = useState<Locale>(locale);
  const [activeSub, setActiveSub] = useState<'off' | Locale>('off');

  // Auto-detect browser language on mount and match video audio + default subtitles
  useEffect(() => {
    const browserLang = detectBrowserLocale(locale);
    setDetectedLang(browserLang);

    if (sources && availableAudio.length > 0) {
      if (sources[browserLang]) {
        setAudioLang(browserLang);
        // If native audio matches browser language, keep subtitles optional unless user toggles
        setActiveSub('off');
      } else {
        // E.g. Dutch browser on ES/EN bilingual video -> play EN audio and auto-enable NL subtitles!
        const fallbackAudio = sources.en ? 'en' : availableAudio[0];
        setAudioLang(fallbackAudio);
        if (availableSubs[browserLang]) {
          setActiveSub(browserLang);
        }
      }
    } else if (availableSubs[browserLang] && browserLang !== 'es') {
      // Single-language clip with subtitles available in visitor's browser language
      setActiveSub(browserLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Synchronize HTMLMediaElement.textTracks reliably across all browsers
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const applyTracks = () => {
      const tracks = vid.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        track.mode = activeSub !== 'off' && track.language === activeSub ? 'showing' : 'hidden';
      }
    };
    applyTracks();
    vid.addEventListener('loadedmetadata', applyTracks);
    vid.addEventListener('play', applyTracks);
    return () => {
      vid.removeEventListener('loadedmetadata', applyTracks);
      vid.removeEventListener('play', applyTracks);
    };
  }, [activeSub, audioLang]);

  const resolvedSrc = sources?.[audioLang] ?? src;
  const resolvedPoster = posters?.[audioLang] ?? posters?.[detectedLang] ?? poster;

  const switchAudio = (nextLang: Locale) => {
    const vid = videoRef.current;
    const wasPlaying = vid ? !vid.paused : false;
    const currentTime = vid ? vid.currentTime : 0;
    setAudioLang(nextLang);
    if (vid) {
      const restore = () => {
        try {
          if (currentTime > 0 && Number.isFinite(vid.duration) && currentTime < vid.duration) {
            vid.currentTime = currentTime;
          }
          if (wasPlaying) vid.play().catch(() => {});
        } catch {
          // ignore seek restriction
        }
        vid.removeEventListener('loadedmetadata', restore);
      };
      vid.addEventListener('loadedmetadata', restore);
    }
  };

  const uiLabels = {
    en: { audio: 'Video', subs: 'Subtitles', off: 'Off', auto: 'Browser' },
    es: { audio: 'Vídeo', subs: 'Subtítulos', off: 'No', auto: 'Navegador' },
    nl: { audio: 'Video', subs: 'Ondertitels', off: 'Uit', auto: 'Browser' }
  }[locale];

  return (
    <figure className="s-media-card" data-testid="senda-video-card" data-detected-lang={detectedLang}>
      <div className="s-video-wrap">
        <video
          ref={videoRef}
          key={resolvedSrc}
          className="s-video"
          src={resolvedSrc}
          poster={resolvedPoster}
          loop={loop}
          playsInline
          controls={controls}
          preload="none"
          crossOrigin="anonymous"
          width={1280}
          height={720}
        >
          {subLangs.map((lang) => (
            <track
              key={lang}
              kind="subtitles"
              src={availableSubs[lang]}
              srcLang={lang}
              label={SUB_LABELS[lang]}
              default={activeSub === lang}
            />
          ))}
        </video>
      </div>

      {(availableAudio.length > 1 || subLangs.length > 0) && (
        <div className="s-video-bar">
          {availableAudio.length > 1 && (
            <div className="s-video-group" role="group" aria-label={uiLabels.audio}>
              <span className="s-video-label">
                <Globe size={13} aria-hidden="true" />
                <span>{uiLabels.audio}:</span>
              </span>
              {availableAudio.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className="s-video-pill"
                  aria-pressed={audioLang === lang}
                  onClick={() => switchAudio(lang)}
                  data-testid={`video-audio-${lang}`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {subLangs.length > 0 && (
            <div className="s-video-group" role="group" aria-label={uiLabels.subs}>
              <span className="s-video-label">
                <Subtitles size={13} aria-hidden="true" />
                <span>{uiLabels.subs}:</span>
              </span>
              <button
                type="button"
                className="s-video-pill"
                aria-pressed={activeSub === 'off'}
                onClick={() => setActiveSub('off')}
                data-testid="video-sub-off"
              >
                {uiLabels.off}
              </button>
              {subLangs.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className="s-video-pill"
                  aria-pressed={activeSub === lang}
                  onClick={() => setActiveSub(lang)}
                  data-testid={`video-sub-${lang}`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <figcaption>
        <div>
          {title && (
            <div style={{ fontWeight: 600, color: 'var(--s-text)', marginBottom: 2 }}>
              {title}
            </div>
          )}
          <span>{caption}</span>
        </div>
        {evidenceId && <EvidenceBadge locale={locale} evidenceId={evidenceId} compact />}
      </figcaption>
    </figure>
  );
}
