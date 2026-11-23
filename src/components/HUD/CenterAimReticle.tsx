import React from 'react';
import { useUniverseStore } from '../../store/useUniverseStore';

/**
 * Task 4: Starlight Resonance Center Aim Reticle (Bugfixes §4).
 * Acts as an attuned celestial instrument guiding the user toward undiscovered
 * personal stars. Its resonance variables (`--resonance`: 0.0 to 1.0) and lock state
 * (`data-locked="true"`) are mutated directly on the DOM by InteractionManager
 * with zero 60fps React overhead.
 */
export const CenterAimReticle: React.FC = () => {
  const hasEntered = useUniverseStore((s) => s.hasEntered);
  const selectedStar = useUniverseStore((s) => s.selectedStar);
  const lockedStar = useUniverseStore((s) => s.reticleLockedStar);
  const isMobile = useUniverseStore((s) => s.isMobileDevice);

  // Hidden before entering the universe
  if (!hasEntered) return null;

  const isLocked = Boolean(lockedStar);
  const hasHiddenMessage = Boolean(lockedStar?.personalMemory);

  return (
    <div
      id="celestial-reticle"
      aria-hidden="true"
      className={`celestial-reticle ${selectedStar ? 'is-modal-open' : ''}`}
      style={{
        // Default initial CSS custom variables
        ['--resonance' as any]: 0,
      }}
    >
      <div className="celestial-reticle__sight">
        {/* Outer Halo (Resonance Pulse - warms from slate to golden amber) */}
        <div className="celestial-reticle__halo" />

        {/* Center Crosshair Point */}
        <div className="celestial-reticle__center" />

        {/* Target Lock 4-Point Diffraction Ticks */}
        <div className="celestial-reticle__ticks">
          <span className="tick tick--top" />
          <span className="tick tick--bottom" />
          <span className="tick tick--left" />
          <span className="tick tick--right" />
        </div>
      </div>

      {/* Target Callout Prompt when Locked onto a Star (hidden while inspecting a modal) */}
      {isLocked && lockedStar && !selectedStar && (
        <div className="reticle-callout glass">
          <span className="reticle-callout__catalog">
            ✦ {lockedStar.astronomy.constellation}
            {lockedStar.astronomy.bayerDesignation
              ? ` • ${lockedStar.astronomy.bayerDesignation}`
              : ''}
          </span>
          <span className="reticle-callout__title">{lockedStar.astronomy.name}</span>
          <span className="reticle-callout__prompt">
            {hasHiddenMessage
              ? isMobile
                ? 'Tap anywhere to read the hidden message'
                : 'Click to read the hidden message'
              : isMobile
                ? 'Tap anywhere to inspect'
                : 'Click to inspect'}
          </span>
        </div>
      )}
    </div>
  );
};
