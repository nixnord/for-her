import { useEffect, useRef } from 'react';
import { CelestialUniverse } from '../core/CelestialUniverse';
import { useUniverseStore } from '../store/useUniverseStore';

/** Mounts the WebGL engine once and wires its callbacks into the Zustand store. */
export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const {
      setEngine,
      setControlMode,
      setSensorStatus,
      setReticleLockedStar,
      openStarModal,
      setAssetsReady,
    } = useUniverseStore.getState();

    const engine = new CelestialUniverse(container, {
      onModeChange: setControlMode,
      onSensorStatus: setSensorStatus,
      onReticleLock: setReticleLockedStar,
      onSelectStar: openStarModal,
      onAssetsReady: () => setAssetsReady(true),
    });

    setEngine(engine);

    return () => {
      setEngine(null);
      engine.dispose();
    };
  }, []);

  return <div ref={containerRef} className="viewport-canvas" />;
}
