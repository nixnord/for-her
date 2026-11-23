import React, { useEffect, useState } from 'react';
import type { UnifiedCelestialObject } from '../../types/universe.types';
import { useUniverseStore } from '../../store/useUniverseStore';
import { Sparkles, Compass, Radio, X } from 'lucide-react';

interface MemoryCardModalProps {
  star?: UnifiedCelestialObject | null;
  onClose?: () => void;
}

type ModalTab = 'message' | 'astronomy';

/**
 * Task 3 + Two-Tab Celestial Card Modal:
 * - For stars carrying a hidden message: displays a two-tab popup with
 *   Tab 1 = "Message" (default) and Tab 2 = "Star Info" (astronomical telemetry).
 * - For ordinary catalog stars: directly displays authentic astronomical data.
 */
export const MemoryCardModal: React.FC<MemoryCardModalProps> = ({
  star: propStar,
  onClose: propOnClose,
}) => {
  const storeStar = useUniverseStore((s) => s.selectedStar);
  const storeClose = useUniverseStore((s) => s.closeStarModal);
  const totalMessages = useUniverseStore((s) => s.registeredMemoryStarIds.length);

  const star = propStar !== undefined ? propStar : storeStar;
  const onClose = propOnClose || storeClose;

  // Close on Escape key
  useEffect(() => {
    if (!star) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [star, onClose]);

  if (!star) return null;

  return (
    <MemoryCardModalContent
      key={star.id}
      star={star}
      totalMessages={totalMessages}
      onClose={onClose}
    />
  );
};

interface MemoryCardModalContentProps {
  star: UnifiedCelestialObject;
  totalMessages: number;
  onClose: () => void;
}

const MemoryCardModalContent: React.FC<MemoryCardModalContentProps> = ({
  star,
  totalMessages,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('message');
  const { astronomy, personalMemory } = star;
  const hasMessage = Boolean(personalMemory);
  const showAstronomyContent = !hasMessage || activeTab === 'astronomy';

  return (
    <div
      className="modal-backdrop memory-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celestial-card-title"
      onClick={onClose}
    >
      <div
        className="memory-card celestial-modal glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="celestial-modal__close-btn"
          onClick={onClose}
          aria-label="Close celestial card"
        >
          <X size={18} />
        </button>

        {/* Header: Object Identity */}
        <div className="celestial-modal__header">
          <div className="celestial-telemetry__constellation">
            <Compass size={13} className="celestial-telemetry__compass-icon" />
            <span>{astronomy.constellation}</span>
            {astronomy.bayerDesignation && <span>• {astronomy.bayerDesignation}</span>}
          </div>

          <h2 id="celestial-card-title" className="celestial-telemetry__title">
            {astronomy.name}
          </h2>
        </div>

        {/* Two-Tab Switcher (First tab: Message, Second tab: Star Info) */}
        {hasMessage && (
          <div className="celestial-tabs" role="tablist" aria-label="Star details">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'message'}
              className={`celestial-tab ${activeTab === 'message' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('message')}
            >
              <Sparkles size={13} />
              <span>Message</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'astronomy'}
              className={`celestial-tab ${activeTab === 'astronomy' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('astronomy')}
            >
              <Compass size={13} />
              <span>Star Info</span>
            </button>
          </div>
        )}

        {/* Tab 1: Hidden Message */}
        {hasMessage && personalMemory && activeTab === 'message' && (
          <div className="celestial-memory-section" role="tabpanel">
            <div className="celestial-memory-section__meta">
              <span className="celestial-memory-section__badge">
                <Sparkles size={12} />
                <span>
                  {personalMemory.memoryIndex > 0
                    ? `Message ${personalMemory.memoryIndex} of ${totalMessages}`
                    : 'Secret Message'}
                </span>
              </span>
              {personalMemory.dateContext && (
                <span className="celestial-memory-section__date">
                  {personalMemory.dateContext}
                </span>
              )}
            </div>

            {personalMemory.title && (
              <h3 className="celestial-memory-section__title">
                {personalMemory.title}
              </h3>
            )}

            {personalMemory.mediaUrl && (
              <figure className="celestial-memory-section__figure">
                <img
                  src={personalMemory.mediaUrl}
                  alt={personalMemory.title || astronomy.name}
                  className="celestial-memory-section__image"
                  loading="lazy"
                />
                {personalMemory.mediaCaption && (
                  <figcaption className="celestial-memory-section__caption">
                    {personalMemory.mediaCaption}
                  </figcaption>
                )}
              </figure>
            )}

            <div className="celestial-memory-section__narrative">
              <p>{personalMemory.narrativeText}</p>
            </div>

            {personalMemory.audioVoiceNoteUrl && (
              <div className="celestial-memory-section__audio">
                <Radio size={16} className="audio-pulse-icon" />
                <audio
                  controls
                  src={personalMemory.audioVoiceNoteUrl}
                  className="celestial-audio-player"
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2 (or default for non-message catalog stars): Astronomical Star Info */}
        {showAstronomyContent && (
          <div className="celestial-astronomy-panel" role={hasMessage ? 'tabpanel' : undefined}>
            <div className="celestial-telemetry__grid">
              <div className="celestial-telemetry__metric">
                <span className="metric-label">Distance</span>
                <span className="metric-value">
                  {astronomy.distanceLightYears.toLocaleString()} ly
                </span>
              </div>
              <div className="celestial-telemetry__metric">
                <span className="metric-label">Magnitude</span>
                <span className="metric-value">
                  {astronomy.apparentMagnitude > 0
                    ? `+${astronomy.apparentMagnitude}`
                    : astronomy.apparentMagnitude}m
                </span>
              </div>
              <div className="celestial-telemetry__metric">
                <span className="metric-label">Spectral</span>
                <span className="metric-value" title={astronomy.spectralType}>
                  {astronomy.spectralType.split(' ')[0]}
                </span>
              </div>
              <div className="celestial-telemetry__metric">
                <span className="metric-label">Temperature</span>
                <span className="metric-value">
                  {astronomy.colorTemperatureK.toLocaleString()} K
                </span>
              </div>
              <div className="celestial-telemetry__metric col-span-2">
                <span className="metric-label">Coordinates (RA / Dec)</span>
                <span className="metric-value">
                  {astronomy.rightAscension}h ·{' '}
                  {astronomy.declination > 0
                    ? `+${astronomy.declination}`
                    : astronomy.declination}
                  °
                </span>
              </div>
            </div>

            <div className="celestial-pure-astronomy">
              <p className="celestial-pure-astronomy__lead">
                Situated within {astronomy.constellation}. Its light travels across{' '}
                {astronomy.distanceLightYears.toLocaleString()} light-years through interstellar
                space before meeting your gaze.
              </p>
              <div className="celestial-pure-astronomy__details">
                <p>
                  <strong>Classification:</strong> {astronomy.catalogId} · {astronomy.spectralType}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Return to Sky button */}
        <div className="celestial-modal__actions">
          <button className="onboarding__button" onClick={onClose} autoFocus>
            Return to Sky
          </button>
        </div>
      </div>
    </div>
  );
};
