'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, Play, Subtitles, Volume2, VolumeX } from 'lucide-react';
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
  /** Enables muted inline auto-preview once the visitor scrolls/interacts, pausing off-screen */
  ambientAutoplay?: boolean;
  /** Visual presentation frame */
  variant?: 'card' | 'cinema';
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
  controls = true,
  ambientAutoplay = false,
  variant = 'card'
}: MediaVideoProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(ambientAutoplay);
  const [userInteracted, setUserInteracted] = useState(false);

  // Auto-detect browser language on mount and match video audio + default subtitles
  useEffect(() => {
    const browserLang = detectBrowserLocale(locale);
    setDetectedLang(browserLang);

    if (sources && availableAudio.length > 0) {
      if (sources[browserLang]) {
        setAudioLang(browserLang);
        setActiveSub('off');
      } else {
        const fallbackAudio = sources.en ? 'en' : availableAudio[0];
        setAudioLang(fallbackAudio);
        if (availableSubs[browserLang]) {
          setActiveSub(browserLang);
        }
      }
    } else if (availableSubs[browserLang] && browserLang !== 'es') {
      setActiveSub(browserLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  // Unlock ambient inline preview on first real visitor scroll/pointer/touch (zero cold-load byte penalty)
  useEffect(() => {
    if (!ambientAutoplay) return;
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const unlock = () => setUserInteracted(true);
    window.addEventListener('scroll', unlock, { passive: true, once: true });
    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    return () => {
      window.removeEventListener('scroll', unlock);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [ambientAutoplay]);

  // Pause off-screen & auto-play muted inline when visible after visitor gesture
  useEffect(() => {
    const el = wrapRef.current;
    const vid = videoRef.current;
    if (!el || !vid) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = Boolean(entries[0]?.isIntersecting);
        if (!visible && !vid.paused) {
          vid.pause();
        } else if (visible && ambientAutoplay && userInteracted && isMuted && vid.paused) {
          vid.muted = true;
          vid.play().catch(() => {});
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ambientAutoplay, userInteracted, isMuted]);

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

  const playWithSound = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = false;
    setIsMuted(false);
    setUserInteracted(true);
    vid.play().catch(() => {});
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const next = !vid.muted;
    vid.muted = next;
    setIsMuted(next);
  };

  const uiLabels = {
    en: {
      audio: 'Video',
      subs: 'Subtitles',
      off: 'Off',
      auto: 'Browser',
      playFilm: 'Play with sound',
      unmute: 'Enable sound',
      mute: 'Mute'
    },
    es: {
      audio: 'Vídeo',
      subs: 'Subtítulos',
      off: 'No',
      auto: 'Navegador',
      playFilm: 'Reproducir con sonido',
      unmute: 'Activar sonido',
      mute: 'Silenciar'
    },
    nl: {
      audio: 'Video',
      subs: 'Ondertitels',
      off: 'Uit',
      auto: 'Browser',
      playFilm: 'Afspelen met geluid',
      unmute: 'Geluid aan',
      mute: 'Dempen'
    }
  }[locale];

  return (
    <figure
      className={`s-media-card${variant === 'cinema' ? ' s-media-cinema' : ''}`}
      data-testid="senda-video-card"
      data-detected-lang={detectedLang}
    >
      <div className="s-video-wrap" ref={wrapRef}>
        <video
          ref={videoRef}
          key={resolvedSrc}
          className="s-video"
          src={resolvedSrc}
          poster={resolvedPoster}
          loop={loop || (ambientAutoplay && isMuted)}
          muted={isMuted}
          playsInline
          controls={controls}
          preload="none"
          crossOrigin="anonymous"
          width={1280}
          height={720}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
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

        {!isPlaying && variant === 'cinema' && (
          <button
            type="button"
            className="s-video-cinema-play"
            onClick={playWithSound}
          >
            <span className="s-video-cinema-play-icon">
              <Play size={22} fill="currentColor" aria-hidden="true" />
            </span>
            <span>{uiLabels.playFilm} · {audioLang.toUpperCase()}</span>
          </button>
        )}

        {isPlaying && ambientAutoplay && (
          <button
            type="button"
            className="s-video-mute-chip"
            onClick={toggleMute}
            aria-label={isMuted ? uiLabels.unmute : uiLabels.mute}
          >
            {isMuted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
            <span>{isMuted ? uiLabels.unmute : uiLabels.mute}</span>
          </button>
        )}
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
              <span className="s-video-auto-tag">
                {uiLabels.auto}: {detectedLang.toUpperCase()}
              </span>
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
