import { ViewportCanvas } from './components/ViewportCanvas';
import { OnboardingModal } from './components/OnboardingModal';
import { ControlHint, ExplorationPrompt, TopNavigation } from './components/HUD/TopNavigation';
import { CenterAimReticle } from './components/HUD/CenterAimReticle';
import { SensorPermissionModal } from './components/Modals/SensorPermissionModal';
import { MemoryCardModal } from './components/Modals/MemoryCardModal';
import { useUniverseStore } from './store/useUniverseStore';

export default function App() {
  const hasEntered = useUniverseStore((s) => s.hasEntered);

  return (
    <div className="app-root">
      <ViewportCanvas />
      <div className="ui-layer">
        {hasEntered && (
          <>
            <TopNavigation />
            <CenterAimReticle />
            <ControlHint />
            <ExplorationPrompt />
          </>
        )}
        <MemoryCardModal />
        <OnboardingModal />
        <SensorPermissionModal />
      </div>
    </div>
  );
}
