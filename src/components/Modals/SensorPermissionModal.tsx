import { useUniverseStore } from '../../store/useUniverseStore';

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Popup shown on phones whenever motion sensors fail to start
 * (permission denied / blocked, or no data). Dismissed with "OK".
 */
export function SensorPermissionModal() {
  const isMobile = useUniverseStore((s) => s.isMobileDevice);
  const status = useUniverseStore((s) => s.sensorStatus);
  const failureCount = useUniverseStore((s) => s.sensorFailureCount);
  const dismissedCount = useUniverseStore((s) => s.sensorFailureDismissed);
  const dismiss = useUniverseStore((s) => s.dismissSensorFailure);

  if (!isMobile || failureCount === 0 || failureCount === dismissedCount) return null;

  const unsupported = status === 'unsupported';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="sensor-modal-title">
      <div className="modal-card glass">
        <h2 id="sensor-modal-title" className="modal-card__title">
          {unsupported ? 'Motion sensors unavailable' : 'Motion sensors needed'}
        </h2>
        {unsupported ? (
          <p className="modal-card__body">
            This browser doesn't give access to your phone's motion sensors, so the sky can't move with
            your phone. You can still explore by dragging with your finger.
          </p>
        ) : (
          <>
            <p className="modal-card__body">
              This website needs permission to use your phone's <strong>motion sensors</strong> so the
              sky can move as you move your phone.
            </p>
            {isIOS() ? (
              <ol className="modal-card__steps">
                <li>Close this tab and open the site again.</li>
                <li>Tap <strong>Enter the Sky</strong>, then tap <strong>Allow</strong> when asked.</li>
              </ol>
            ) : (
              <ol className="modal-card__steps">
                <li>Tap the icon left of the address bar (🔒 / ⓘ).</li>
                <li>Open <strong>Permissions</strong> or <strong>Site settings</strong>.</li>
                <li>Set <strong>Motion sensors</strong> to <strong>Allow</strong>, then reload.</li>
              </ol>
            )}
            <p className="modal-card__note">Until then, you can drag with your finger to look around.</p>
          </>
        )}
        <button className="onboarding__button" onClick={dismiss} autoFocus>
          OK
        </button>
      </div>
    </div>
  );
}
