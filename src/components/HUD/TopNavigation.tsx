import { useEffect, useState } from 'react';
import { MobileGyroController } from '../../core/controllers/MobileGyroController';
import { useUniverseStore } from '../../store/useUniverseStore';

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5 13.4 13.4 8.5 15.5 10.6 10.6z" />
  </svg>
);

const PhoneMotionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="3" width="8" height="18" rx="2" />
    <path d="M4 8c-1.3 2.5-1.3 5.5 0 8M20 8c1.3 2.5 1.3 5.5 0 8" />
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" />
    <path d="M3 12h18" />
  </svg>
);

const ConstellationIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="7" r="1.5" fill="currentColor" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    <circle cx="19" cy="9" r="1.5" fill="currentColor" />
    <circle cx="15" cy="18" r="1.5" fill="currentColor" />
    <circle cx="7" cy="16" r="1.5" fill="currentColor" />
    <path d="M5 7l7-3 7 5-4 9-8-2z" strokeDasharray="2 2" opacity="0.85" />
  </svg>
);

const AudioOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>
);

const AudioMutedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

/** Top HUD bar: discovery counter, audio mute, sensor toggle (mobile), constellations, grid and recenter. */
export function TopNavigation() {
  const engine = useUniverseStore((s) => s.engine);
  const mode = useUniverseStore((s) => s.controlMode);
  const isMobile = useUniverseStore((s) => s.isMobileDevice);
  const gridVisible = useUniverseStore((s) => s.gridVisible);
  const toggleGrid = useUniverseStore((s) => s.toggleGrid);
  const iauConstellationsVisible = useUniverseStore((s) => s.iauConstellationsVisible);
  const toggleIauConstellations = useUniverseStore((s) => s.toggleIauConstellations);
  const isAudioMuted = useUniverseStore((s) => s.isAudioMuted);
  const toggleAudioMute = useUniverseStore((s) => s.toggleAudioMute);
  const discoveredCount = useUniverseStore((s) => s.discoveredStarIds.length);
  const totalCount = useUniverseStore((s) => s.registeredMemoryStarIds.length);

  const handleSensorToggle = () => {
    if (!engine) return;
    if (mode === 'MOBILE_SENSOR') {
      void engine.toggleSensorMode();
      return;
    }
    // Permission must be requested synchronously inside the tap gesture.
    void MobileGyroController.requestPermission().then((p) => engine.toggleSensorMode(p));
  };

  return (
    <nav className="top-nav">
      {totalCount > 0 ? (
        <div
          className="top-nav__counter-pill glass"
          aria-label={`${discoveredCount} of ${totalCount} messages discovered`}
        >
          <span className="top-nav__counter-star" aria-hidden="true">✦</span>
          <span className="top-nav__counter-value">
            {discoveredCount} <span className="top-nav__counter-sep">/</span> {totalCount}
          </span>
        </div>
      ) : (
        <div />
      )}
      <div className="top-nav__actions">
        <button
          className={`icon-button glass ${!isAudioMuted ? 'is-active' : ''}`}
          onClick={toggleAudioMute}
          aria-label={isAudioMuted ? 'Unmute cosmic soundscape' : 'Mute cosmic soundscape'}
          title={isAudioMuted ? 'Unmute sound' : 'Mute sound'}
        >
          {isAudioMuted ? <AudioMutedIcon /> : <AudioOnIcon />}
        </button>
        {isMobile && (
          <button
            className={`icon-button glass ${mode === 'MOBILE_SENSOR' ? 'is-active' : ''}`}
            onClick={handleSensorToggle}
            aria-label={mode === 'MOBILE_SENSOR' ? 'Switch to touch drag' : 'Switch to motion sensor'}
          >
            <PhoneMotionIcon />
          </button>
        )}
        <button
          className={`icon-button glass ${iauConstellationsVisible ? 'is-active' : ''}`}
          onClick={toggleIauConstellations}
          aria-label="Toggle real constellations"
          title="Toggle real constellations"
        >
          <ConstellationIcon />
        </button>
        <button
          className={`icon-button glass ${gridVisible ? 'is-active' : ''}`}
          onClick={toggleGrid}
          aria-label="Toggle sky grid"
        >
          <GridIcon />
        </button>
        <button className="icon-button glass" onClick={() => engine?.recenter()} aria-label="Recenter view">
          <CompassIcon />
        </button>
      </div>
    </nav>
  );
}

/** Short-lived hint explaining the active navigation method. Re-mounts on mode change. */
export function ControlHint() {
  const mode = useUniverseStore((s) => s.controlMode);
  const isMobile = useUniverseStore((s) => s.isMobileDevice);

  let text = '';
  if (mode === 'MOBILE_SENSOR') text = 'Move your phone to explore the sky';
  else if (mode === 'POINTER_DRAG')
    text = isMobile ? 'Drag to look around · pinch to zoom' : 'Drag to look around · scroll to zoom';
  if (!text) return null;

  return <FadingHint key={mode} text={text} />;
}

function FadingHint({ text }: { text: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="control-hint glass" style={{ opacity: visible ? 1 : 0 }}>
      {text}
    </div>
  );
}

/** Persistent subtle exploration prompt instructing user to aim for glowing stars & constellations */
export function ExplorationPrompt() {
  const hasEntered = useUniverseStore((s) => s.hasEntered);
  const selectedStar = useUniverseStore((s) => s.selectedStar);
  const lockedStar = useUniverseStore((s) => s.reticleLockedStar);
  const isMobile = useUniverseStore((s) => s.isMobileDevice);

  // Hide while viewing a memory card or when a star is currently locked (reticle callout handles it)
  if (!hasEntered || selectedStar || lockedStar) return null;

  return (
    <div className="exploration-prompt glass">
      <span className="exploration-prompt__sparkle">✦</span>
      <span className="exploration-prompt__text">
        Aim at glowing stars & constellations to get messages
        <span className="exploration-prompt__sub">
          {isMobile ? ' · tap anywhere to open' : ' · click to open'}
        </span>
      </span>
    </div>
  );
}
