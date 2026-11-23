import { useState } from 'react';
import { MobileGyroController, type PermissionResult } from '../core/controllers/MobileGyroController';
import { useUniverseStore } from '../store/useUniverseStore';

/**
 * Entry gate (Report §10 — iOS permission & Web Audio unlock).
 * Sensor permission and AudioContext resume MUST happen synchronously inside the tap handler.
 */
export function OnboardingModal() {
  const isMobile = useUniverseStore((s) => s.isMobileDevice);
  const hasEntered = useUniverseStore((s) => s.hasEntered);
  const isAssetsReady = useUniverseStore((s) => s.isAssetsReady);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  if (gone) return null;

  const handleEnter = () => {
    if (leaving) return;
    const engine = useUniverseStore.getState().engine;

    // Unlock Web Audio synchronously inside user gesture for iOS Safari / Android Chrome
    engine?.audio.unlock();

    // Called synchronously from the gesture — required by iOS Safari.
    const permission: Promise<PermissionResult | null> = isMobile
      ? MobileGyroController.requestPermission()
      : Promise.resolve(null);

    setLeaving(true);
    void permission.then(async (result) => {
      await useUniverseStore.getState().engine?.enter(result);
      useUniverseStore.getState().setEntered();
    });
    window.setTimeout(() => setGone(true), 900);
  };

  return (
    <div className={`onboarding ${leaving || hasEntered ? 'is-leaving' : ''}`}>
      <div className="onboarding__card glass">
        <h1 className="onboarding__title">A SKY MADE FOR YOU</h1>
        <p className="onboarding__body">
          {isMobile
            ? 'Hold your phone up and move around to explore the night sky. Look for glowing stars and constellations to uncover hidden messages.'
            : 'Click and drag to explore the night sky. Look for glowing stars and constellations — aim or click on them to uncover hidden messages.'}
        </p>
        <button className="onboarding__button" onClick={handleEnter} disabled={leaving}>
          {isAssetsReady ? 'Enter the Sky' : 'Preparing the Sky…'}
        </button>
        {isMobile && (
          <p className="onboarding__note">You may be asked to allow motion sensor access.</p>
        )}
      </div>

      <p className="onboarding__credit">
        made with{' '}
        <svg
          className="onboarding__heart"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-label="love"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>{' '}
        by Anubhav
      </p>
    </div>
  );
}
