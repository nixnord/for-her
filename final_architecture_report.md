# Final Technical Architecture Report: Mobile-First 360° Interactive Celestial Universe

**Document Version:** 2.0.0 — Production Blueprint  
**Target Systems:** Mobile-First (Android Chrome & iOS Safari with Physical IMU Sensor Tracking) + Desktop Pointer Drag Fallback  
**Core Architecture Pattern:** Decoupled Imperative WebGL Engine (Three.js) + Declarative 2D Glassmorphism UI Shell (React) + Zustand Reactive Bridge  
**Recommended Tooling & Foundational Libraries:** `three`, `camera-controls` (yomotsu), `three-stdlib` (`DeviceOrientationControls`), `zustand`, `gsap`

---

## 1. Executive Summary & Architectural Vision

This specification defines the complete engineering architecture for an interactive, 360-degree personal universe inspired by the observational mechanics of planetarium software (such as Stellarium). Rather than rendering cold astronomical ephemerides, this platform renders personal memories, story nodes, hidden letters, interconnected constellations, and an automated cinematic birthday finale.

```
+---------------------------------------------------------------------------------------------------+
|                                      SYSTEM TOPOLOGY OVERVIEW                                     |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|    +-----------------------------+                           +-------------------------------+    |
|    |     PHYSICAL MOBILE IMU     |                           |    DESKTOP MOUSE / TOUCH      |    |
|    |  Gyro / Accelerometer /     |                           |   Virtual Trackball Inertia   |    |
|    |  Screen Orientation Angle   |                           |    (camera-controls engine)   |    |
|    +--------------+--------------+                           +---------------+---------------+    |
|                   |                                                          |                    |
|                   +----------------------------+-----------------------------+                    |
|                                                |                                                  |
|                                                v                                                  |
|                             +--------------------------------------+                              |
|                             |      CAMERA ARBITRATION FSM          |                              |
|                             |  - FREE_SENSOR (Mobile IMU)          |                              |
|                             |  - POINTER_DRAG (Desktop Fallback)   |                              |
|                             |  - TARGET_FOCUS (Smooth Slew)        |                              |
|                             |  - CINEMATIC_FINALE (GSAP Drift)     |                              |
|                             +------------------+-------------------+                              |
|                                                |                                                  |
|                                                v                                                  |
|                             +--------------------------------------+                              |
|                             |      THREE.JS WEBGL PIPELINE         |                              |
|                             |  - Sky Dome (R=500, Gradient GLSL)   |                              |
|                             |  - Starfield (R=400, Twinkle GLSL)   |                              |
|                             |  - Interactive Stars (Instanced Mesh)|                              |
|                             |  - Constellation Line Buffers        |                              |
|                             |  - Layered Nebula Billboard Shaders  |                              |
|                             +------------------+-------------------+                              |
|                                                |                                                  |
|                       Forward Cone Raycast     |     Camera Projection Matrix                     |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  ZUSTAND STATE BRIDGE                                       |  |
|  |  - Discovered Star IDs (LocalStorage)          - Active Modal & Memory Payload              |  |
|  |  - Constellation Completion Tracker            - Current Control Mode                       |  |
|  +---------------------------------------------+-----------------------------------------------+  |
|                                                |                                                  |
|                                                v                                                  |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                    REACT UI OVERLAY                                         |  |
|  |  - Fullscreen Canvas Mount                     - Dynamic HUD & Proximity Reticle            |  |
|  |  - Onboarding & iOS Sensor Gate                - Glassmorphism Memory Cards                 |  |
|  |  - Web Audio Pentatonic Chimes                 - Final Birthday Letter Modal                |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

### Core Architectural Decisions
1. **No Reinvention of Astronomical Mechanics:** Real planetariums compute Julian epochs, precession matrices, and sidereal hour angles. This engine projects pre-baked, authorable Cartesian vectors and constellation lines directly onto a fixed spherical shell ($R = 200$), eliminating real-time ephemeris calculations.
2. **Optimum Library Strategy:** 
   - Uses `camera-controls` by yomotsu to handle desktop drag, momentum, spherical damping, and Stellarium-style `.rotateTo()` transitions out of the box.
   - Uses `three-stdlib` (`DeviceOrientationControls`) combined with custom Gravity-Aligned Yaw Offset math to ensure stable mobile gyroscope exploration without tilting virtual horizons.
3. **Decoupled Architecture:** React does not manage or reconcile WebGL scene objects. The 3D render loop runs imperatively at the display refresh rate ($60\text{Hz}$–$120\text{Hz}$), communicating with React overlays via a zero-overhead Zustand state store.
4. **Single-Pass Mobile Shader Pipeline:** Standard multi-pass bloom pipelines (`UnrealBloomPass`) cause severe fill-rate collapse on mobile GPUs. All star glows, diffraction spikes, and volumetric nebulae use single-pass additive analytical GLSL shaders.

---

## 2. Directory Structure & Modular Layout

```text
src/
├── main.tsx                           # Application entry point
├── App.tsx                            # Root viewport container & layout
├── index.css                          # Mobile lock (100dvh, overscroll prevention)
├── types/
│   └── universe.types.ts              # Data contracts and schema definitions
├── data/
│   └── universeData.json              # Authorable memories, stars, and constellations
├── store/
│   └── useUniverseStore.ts            # Zustand store (progression, state, persistence)
├── audio/
│   └── CelestialAudioEngine.ts        # Synthesized Web Audio ambient chords & chimes
├── core/                              # PURE THREE.JS & SENSORS (ZERO REACT IMPORTS)
│   ├── CelestialUniverse.ts           # WebGL master controller & RAF loop
│   ├── CameraArbitrator.ts            # Camera FSM (Sensor vs. Drag vs. Programmatic)
│   ├── InteractionManager.ts          # Cone raycasting & screen-center target lock
│   ├── controllers/
│   │   ├── MobileGyroController.ts    # DeviceOrientation + Yaw Calibration wrapper
│   │   └── DesktopDragController.ts   # camera-controls integration with inertia
│   └── scene/
│       ├── CelestialSkyDome.ts        # Inverted sphere with GLSL navy-indigo gradient
│       ├── BackgroundStarfield.ts     # Instanced twinkling background particles
│       ├── InteractiveStarSystem.ts   # Instanced clickable stars with glow shaders
│       ├── ConstellationSystem.ts     # Dynamic BufferGeometry line segments
│       └── ProceduralNebulae.ts       # Layered billboard particle clouds
└── components/                        # REACT 2D GLASSMORPHISM OVERLAY
    ├── ViewportCanvas.tsx             # Mounts HTML5 canvas and binds CelestialUniverse
    ├── OnboardingModal.tsx            # iOS sensor permission trigger & audio unlock
    ├── HUD/
    │   ├── TopNavigation.tsx          # Star discovery counter, mute button, recenter action
    │   ├── CenterAimReticle.tsx       # Dynamic targeting reticle (scales on lock)
    │   └── InteractionPrompt.tsx      # "Tap anywhere to inspect" callout
    ├── Modals/
    │   ├── MemoryCardModal.tsx        # Memory viewer (photo, text, audio player)
    │   └── ConstellationToast.tsx     # Toast shown when a constellation is completed
    └── Finale/
        ├── FinaleSkipControl.tsx      # Skip button during programmatic camera drift
        └── BirthdayLetterModal.tsx    # Poetic final birthday letter reveal
```

---

## 3. Mathematical Foundations: Device Orientation & Coordinates

### 3.1 Coordinate Systems & Projection
The universe uses a right-handed Cartesian coordinate system:
- $+X$: Celestial East / Right
- $+Y$: Celestial Zenith (directly overhead against gravity)
- $+Z$: Celestial South / Backward
- Visual Line of Sight at rest: $(0, 0, -1)$ (Celestial North / Forward)

Authors define stars using intuitive spherical coordinates:
- $\alpha_{\text{deg}} \in [0, 360)^\circ$: Azimuth (horizontal heading, clockwise from North)
- $\delta_{\text{deg}} \in [-90, +90]^\circ$: Elevation / Pitch ($-90^\circ$ Nadir, $+90^\circ$ Zenith)
- $R$: Shell radius ($R = 200.0$)

The conversion to Cartesian coordinates $\mathbf{P}(x, y, z)$ is:

$$\phi = (90^\circ - \delta_{\text{deg}}) \times \frac{\pi}{180}, \quad \theta = \alpha_{\text{deg}} \times \frac{\pi}{180}$$

$$x = R \cdot \sin(\phi) \cdot \sin(\theta)$$
$$y = R \cdot \cos(\phi)$$
$$z = -R \cdot \sin(\phi) \cdot \cos(\theta)$$

### 3.2 Mobile IMU to Three.js Camera Quaternion Transformation
The browser's `DeviceOrientationEvent` emits intrinsic Tait-Bryan angles in the $Z-X'-Y''$ sequence ($\alpha, \beta, \gamma$). To translate these into a stable camera orientation pointing out the back of the smartphone:

1. **Construct Device Quaternion ($q_{\text{device}}$):**
   Convert angles to radians: $\alpha_{\text{rad}}, \beta_{\text{rad}}, \gamma_{\text{rad}}$. Construct an intrinsic `'YXZ'` Euler object:
   $$\mathbf{e} = \left(\beta_{\text{rad}},\, \alpha_{\text{rad}},\, -\gamma_{\text{rad}},\, \text{'YXZ'}\right)$$
   $$q_{\text{device}} = \text{QuaternionFromEuler}(\mathbf{e})$$

2. **Align Camera Axis ($q_{\text{flip}}$):**
   Rotate the virtual camera $-90^\circ$ around the physical $X$-axis so the viewpoint aligns with the rear camera instead of the user's face:
   $$q_{\text{flip}} = \begin{bmatrix} -\sin(\pi / 4) \\ 0 \\ 0 \\ \cos(\pi / 4) \end{bmatrix} = \begin{bmatrix} -\frac{\sqrt{2}}{2} \\ 0 \\ 0 \\ \frac{\sqrt{2}}{2} \end{bmatrix}$$

3. **Compensate for Screen Orientation ($q_{\text{screen}}$):**
   Query the display orientation angle $\theta_{\text{screen}} = (\text{screen.orientation.angle} \parallel 0)^\circ$:
   $$q_{\text{screen}} = \text{FromAxisAngle}\left(\begin{bmatrix} 0 \\ 0 \\ 1 \end{bmatrix},\, -\theta_{\text{screen}} \times \frac{\pi}{180}\right)$$

4. **Composite Raw Quaternion:**
   $$q_{\text{raw}} = q_{\text{device}} \cdot q_{\text{flip}} \cdot q_{\text{screen}}$$

### 3.3 Gravity-Aligned Yaw Offset Calibration (Recenter Mechanism)
Raw compass readings ($\alpha$) are often distorted indoors by electromagnetic interference. Furthermore, requiring the user to face physical North to see the initial constellation is poor UX.

**Rule:** Never zero pitch ($\beta$) or roll ($\gamma$) during calibration, or the virtual horizon will tilt relative to real gravity. Calibrate *only* the yaw offset around the world $Y$-axis:

```typescript
// 1. Extract device forward line-of-sight in world coordinates
const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(q_raw);

// 2. Compute current horizontal azimuth relative to -Z axis
const currentYaw = Math.atan2(forwardVector.x, -forwardVector.z);

// 3. Define yaw offset to bring target heading (0 rad) into view
const yawOffsetAngle = -currentYaw;
const q_yawOffset = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  yawOffsetAngle
);

// 4. Final Calibrated Camera Target Quaternion
const q_calibrated = q_yawOffset.clone().multiply(q_raw);
```

### 3.4 Frame-Rate Independent Exponential Smoothing
To filter out hand tremors and raw sensor noise without introducing latency, apply delta-time-dependent Spherical Linear Interpolation (SLERP):

$$t_{\text{smooth}} = 1.0 - e^{-\lambda \cdot \Delta t} \quad (\text{where } \lambda = 16.0)$$
$$q_{\text{camera}} = \text{slerp}\left(q_{\text{camera}},\, q_{\text{calibrated}},\, t_{\text{smooth}}\right)$$

**Angular Deadband:** If the angular divergence between frames satisfies $|q_{\text{camera}} \cdot q_{\text{calibrated}}| > \cos(0.04^\circ / 2) \approx 0.9999994$, skip the interpolation update. This prevents sub-pixel star shimmering when the phone is held still.

---

## 4. Input & Camera Arbitration Architecture

The application implements a Finite State Machine (FSM) to switch between hardware sensor input, desktop mouse navigation, targeted star inspection, and cinematic sequences:

```
                     +---------------------------------------+
                     |           UNINITIALIZED               |
                     +-------------------+-------------------+
                                         |
                       User Taps "Enter Universe" Button
                                         |
                                         v
                     +---------------------------------------+
                     |       CAPABILITY AUTO-DETECTION       |
                     +---------+-------------------+---------+
                               |                   |
            Mobile with Sensor |                   | Desktop or Sensors
            Permission Granted |                   | Denied/Unavailable
                               v                   v
                     +-------------------+   +-------------------+
        +----------> |   MOBILE_SENSOR   |   |   POINTER_DRAG    | <----------+
        |            |  IMU Quaternion   |   |  camera-controls  |            |
        |            +---------+---------+   +---------+---------+            |
        |                      |                       |                      |
        | Return to Sky        | Star Selected         | Star Selected        | Return to Sky
        |                      v                       v                      |
        |            +---------------------------------------+                |
        +------------+           TARGET_FOCUS                +----------------+
                     |  Smooth .rotateTo() Slew + Soft Lock  |
                     +-------------------+-------------------+
                                         |
                               All Stars Discovered
                                         |
                                         v
                     +---------------------------------------+
                     |           CINEMATIC_FINALE            |
                     |  Programmatic GSAP Slerp to Finale    |
                     +---------------------------------------+
```

### 4.1 State Machine Modes
1. **`MOBILE_SENSOR`**: Physical smartphone movement drives camera orientation. The user aims by moving the phone. The central aiming reticle targets stars via forward cone-casting.
2. **`POINTER_DRAG`**: Active on desktop machines or devices where motion sensors are unavailable or denied. Powered by `camera-controls` with high-friction spherical inertia. Clicking and dragging rotates the virtual camera dome smoothly.
3. **`TARGET_FOCUS`**: Activated when an interactive star is selected. The camera disengages active input and uses `camera-controls.rotateTo()` to center the star in the viewport over $0.85\text{s}$. If on mobile, micro-IMU adjustments are permitted with dampened gain ($\lambda = 4.0$).
4. **`CINEMATIC_FINALE`**: Activated once all required stars are collected. Sensor and pointer listeners are detached. A deterministic GSAP timeline smoothly steers the camera along a spherical arc toward the birthday constellation.

---

## 5. Interaction Engine: Dual-Mode Targeting System

### 5.1 Primary Mobile Interaction: Screen-Center Cone Reticle
Attempting to tap small stars directly on a high-DPI smartphone screen while holding the device upright causes missed touches and user frustration. The primary mobile interaction uses **Screen-Center Reticle Targeting with Tap-Anywhere Activation**:

1. On each frame, extract the camera's forward unit vector:
   $$\mathbf{v}_{\text{forward}} = (0, 0, -1) \cdot q_{\text{camera}}$$
2. Loop through active interactive stars ($\le 30$ objects). Compute the normalized direction to the star:
   $$\hat{\mathbf{v}}_{\text{star}} = \frac{\mathbf{P}_{\text{star}}}{\|\mathbf{P}_{\text{star}}\|}$$
3. Compute angular cosine via dot product:
   $$\cos(\theta) = \mathbf{v}_{\text{forward}} \cdot \hat{\mathbf{v}}_{\text{star}}$$
4. **Selection Threshold:** If $\cos(\theta) > \cos(3.5^\circ) \approx 0.99813$:
   - The star enters the **Reticle-Locked State**.
   - The 2D UI reticle animates from a thin circle to a focused diamond with a pulse glow.
   - The star quad's GLSL uniform `uHover` interpolates toward `1.0`.
5. **Tap-Anywhere Trigger:** When the screen receives a `pointerup` event and a star is locked in the reticle, open that star's message modal immediately. The user can tap anywhere on the screen with their thumb.

### 5.2 Desktop Interaction: Cursor Hover & Raycast Picking
When `POINTER_DRAG` mode is active on desktop:
1. `pointermove` calculates Normalized Device Coordinates (NDC) $\in [-1, 1]^2$.
2. Direct Three.js raycasting targets spherical hit proxies ($R_{\text{hit}} = 12.0\text{ units}$, significantly larger than the visual star core).
3. Hovering over a star switches the CSS cursor to `pointer` and activates the star's GLSL glow uniform. Clicking triggers the `TARGET_FOCUS` transition to center the star.

---

## 6. Single-Pass Custom GLSL Shader Pipeline

To achieve an intimate planetarium visual style without the heavy performance penalty of multi-pass bloom filters, the engine uses single-pass additive GLSL shaders.

### 6.1 Interactive Star Billboard Quad Shader
Interactive stars are camera-facing billboard planes (`PlaneGeometry(24, 24)`) using `THREE.AdditiveBlending` and `depthWrite: false`.

```glsl
// Vertex Shader
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
```

```glsl
// Fragment Shader: Analytical Core, Exponential Halo, and Diffraction Spikes
varying vec2 vUv;
uniform vec3 uCoreColor;       // Warm champagne: vec3(1.0, 0.95, 0.82)
uniform vec3 uHaloColor;       // Rose gold / Amber: vec3(0.98, 0.58, 0.42)
uniform float uTime;
uniform float uPulseSpeed;
uniform float uIsDiscovered;   // 0.0 undiscovered, 1.0 discovered
uniform float uHoverState;     // 0.0 to 1.0 transition from reticle lock

void main() {
  // Normalize UVs to [-1.0, 1.0]
  vec2 p = (vUv - 0.5) * 2.0;
  float dist = length(p);
  if (dist > 1.0) discard;

  // Twinkle / Pulse rhythm
  float pulse = 0.85 + 0.15 * sin(uTime * uPulseSpeed);
  float focusBoost = 1.0 + uHoverState * 0.5;

  // 1. Analytical Inverse-Square Core
  float core = 0.022 / (dist * dist + 0.012);

  // 2. Exponential Soft Halo Falloff
  float halo = pow(max(0.0, 1.0 - dist), 3.0) * 0.7;

  // 3. 4-Point Diffraction Cross Spikes (Planetarium / Telescope Aesthetic)
  float spikeH = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 3.0);
  float spikeV = exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 3.0);
  float spikes = (spikeH + spikeV) * 0.45 * (1.0 + uIsDiscovered * 0.5);

  float totalIntensity = (core + halo + spikes) * pulse * focusBoost;

  // Blend white-hot interior into warm tinted halo
  vec3 finalColor = mix(uHaloColor, uCoreColor, clamp(core * 0.6, 0.0, 1.0));
  
  // Edge feather to prevent harsh bounding quad intersections
  float edgeFeather = smoothstep(1.0, 0.75, dist);
  gl_FragColor = vec4(finalColor * totalIntensity * edgeFeather, totalIntensity * edgeFeather);
}
```

### 6.2 Deep Celestial Sky Dome Shader
An inverted icosahedron sphere ($R = 500.0$) creates a deep gradient:
- Zenith ($+Y$): Deep midnight navy (`#050711`)
- Equator / Horizon: Dark indigo (`#0F142E`)
- Nadir ($-Y$): Deepest abyss black (`#020307`)

$$\text{Gradient Factor } t = \text{clamp}\left(\frac{y}{R} \cdot 0.5 + 0.5,\, 0.0,\, 1.0\right)$$
$$\text{Color} = \text{mix}\left(\mathbf{C}_{\text{horizon}},\, \mathbf{C}_{\text{zenith}},\, t^{1.4}\right)$$

---

## 7. Data Models & Schemas (`src/types/universe.types.ts`)

```typescript
export type ControlMode = 
  | 'UNINITIALIZED'
  | 'MOBILE_SENSOR'
  | 'POINTER_DRAG'
  | 'TARGET_FOCUS'
  | 'CINEMATIC_FINALE';

export type StarCategory = 
  | 'standalone_memory'
  | 'constellation_node'
  | 'nebula_heart'
  | 'finale_anchor';

export interface SphericalPosition {
  azimuthDeg: number;   // 0° to 360° (Heading)
  elevationDeg: number; // -90° to +90° (Pitch)
  radius: number;       // Default interactive shell = 200.0
}

export interface MemoryPayload {
  title: string;
  dateContext?: string;
  narrativeText: string;
  photoUrl?: string;
  photoCaption?: string;
  audioVoiceNoteUrl?: string;
  chimeTone: 'C4' | 'D4' | 'E4' | 'G4' | 'A4' | 'C5';
}

export interface InteractiveStarItem {
  id: string;
  category: StarCategory;
  coordinates: SphericalPosition;
  coreColorHex: string;
  haloColorHex: string;
  sizeMultiplier: number;
  constellationId?: string;
  unveilsFinaleProgress: boolean;
  content: MemoryPayload;
}

export interface ConstellationEdge {
  fromStarId: string;
  toStarId: string;
}

export interface ConstellationItem {
  id: string;
  name: string;
  storySnippet: string;
  themeColorHex: string;
  memberStarIds: string[];
  connections: ConstellationEdge[];
}

export interface NebulaRegion {
  id: string;
  coordinates: SphericalPosition;
  quadScale: [number, number];
  tintColorHex: string;
  particleDensity: number;
}

export interface FinaleConfiguration {
  targetCoordinates: SphericalPosition;
  birthdayStarIds: string[];
  constellationEdges: ConstellationEdge[];
  letterContent: {
    title: string;
    salutation: string;
    bodyParagraphs: string[];
    closing: string;
    signature: string;
  };
}

export interface MasterUniverseData {
  requiredStarCountForFinale: number;
  interactiveStars: InteractiveStarItem[];
  constellations: ConstellationItem[];
  nebulae: NebulaRegion[];
  finale: FinaleConfiguration;
}
```

---

## 8. Web Audio Procedural Synthesizer Architecture

To avoid loading large MP3 sound banks that increase initial load times, the application synthesizes its own celestial sounds using the native browser **Web Audio API**:

```
+---------------------------------------------------------------------------------+
|                           WEB AUDIO GRAPH TOPOLOGY                              |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ Ambient Drone ]                                                              |
|  Dual Low-Frequency Sine Oscillators (55Hz / 110Hz)                             |
|          |                                                                      |
|          v                                                                      |
|  Biquad Lowpass Filter (350Hz Cutoff, Q=2.0)                                    |
|          |                                                                      |
|          v                                                                      |
|  Stereo GainNode (-18dB) ----------------------------+                          |
|                                                     |                          |
|  [ Discovery Chime ]                                |                          |
|  Pentatonic Sine Tone (e.g., E5 = 659.25Hz)         |                          |
|          |                                          v                          |
|  Decay Envelope (Gain: Peak -> exp decay 2.4s) -> Master Gain -> AudioDestination|
|          |                                          ^                          |
|  [ Convolver Reverb ]                               |                          |
|  Procedural 3.5s Impulse Response Buffer -----------+                          |
+---------------------------------------------------------------------------------+
```

### Key Audio Features
- **Zero HTTP Audio Asset Latency:** Chimes and ambient drones synthesize instantaneously on device.
- **Mobile Autoplay Compliance:** `AudioContext` initializes in suspended mode and resumes synchronously during the first user interaction on the onboarding screen.
- **Dynamic Pentatonic Tuning:** Each discovered star triggers a harmonic pitch from the Celestial Pentatonic Scale ($C_4, D_4, E_4, G_4, A_4, C_5$), ensuring every discovery sound is musical and consonant.

---

## 9. Cinematic Finale Choreography

When all required interactive stars are discovered and the user closes the final memory card modal, the finale sequence triggers:

```
T = 0.0s             T = 1.0s                    T = 4.2s                 T = 6.8s
+--------------------+---------------------------+------------------------+-----------------+
| Lock Input & State | Smooth Camera Drift       | Awaken Birthday Stars  | Reveal Letter   |
| Disengage sensor   | GSAP slerps camera        | Staggered opacity fade | Display full    |
| and pointer        | orientation toward        | of finale constellation| birthday letter |
| listeners.         | finale coordinates.       | and line drawing.      | modal overlay.  |
+--------------------+---------------------------+------------------------+-----------------+
```

```typescript
// Finale Camera Drift Blueprint (using GSAP and Quaternion slerp)
export function runCinematicFinale(
  camera: THREE.PerspectiveCamera, 
  targetCoords: SphericalPosition, 
  onComplete: () => void
): void {
  // 1. Calculate destination quaternion
  const targetCartesian = sphericalToCartesian(targetCoords).normalize();
  const targetRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    targetCartesian
  );

  const startRotation = camera.quaternion.clone();
  const transitionTracker = { progress: 0 };

  gsap.to(transitionTracker, {
    progress: 1,
    duration: 3.8,
    ease: 'power2.inOut',
    onUpdate: () => {
      // Delta-time independent spherical interpolation
      camera.quaternion.copy(startRotation).slerp(targetRotation, transitionTracker.progress);
    },
    onComplete: () => {
      onComplete();
    }
  });
}
```

---

## 10. Mobile UX, Viewport Guardrails & Technical Risks

| Technical Risk | Critical Symptom | Architecture Mitigation |
| :--- | :--- | :--- |
| **iOS Permission Denial** | Screen remains black or stationary; orientation event never fires. | Provide an explicit "Enter Sky" button on an onboarding screen that calls `DeviceOrientationEvent.requestPermission()` directly from the user gesture. Fall back to pointer drag if denied. |
| **Android Sensor Watchdog** | Some devices advertise `DeviceOrientationEvent` but never dispatch numeric coordinates. | Implement a 600ms watchdog timer. If no event with valid numeric `alpha`/`beta` values arrives within 600ms of listening, automatically switch to `POINTER_DRAG`. |
| **Mobile Fill-Rate Collapse** | Framerate drops below 25fps on mid-range Android chips (Mali / Adreno). | Disallow multi-pass post-processing bloom. Use analytical single-pass GLSL quad shaders. Cap pixel ratio: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))`. |
| **Address Bar Jitter** | Mobile viewport resizes when scrolling, causing WebGL projection matrix flutter. | Lock viewport height using CSS `height: 100dvh` and apply `overscroll-behavior: none` and `touch-action: none` to the root HTML body. |
| **Memory / GC Freezes** | Periodic 100ms visual stutters during camera rotation caused by Garbage Collection. | Pre-allocate all scratch vectors (`THREE.Vector3`, `THREE.Quaternion`, `THREE.Matrix4`) at class construction. Zero heap object allocations inside the render tick. |

---

## 11. Implementation Execution Plan for Autonomous Agents

Engineering agents implementing this project should proceed through five sequential milestones:

```
+-----------------------------------------------------------------------------------------------+
|                                AGENT IMPLEMENTATION PIPELINE                                  |
+-------------+-------------------------------+-------------------------------------------------+
| Milestone   | Focus Module                  | Verification Criterion                          |
+-------------+-------------------------------+-------------------------------------------------+
| Milestone 1 | Scaffolding & Dual-Controller | - WebGL canvas mounts and renders a basic dome. |
|             | Camera Foundation             | - Mobile IMU moves camera smoothly.             |
|             |                               | - Desktop mouse-drag provides smooth fallback.  |
|             |                               | - Recenter button zeroes horizontal yaw.        |
|             |                               |                                                 |
| Milestone 2 | Shaders, Starfield & Data     | - 2000 background stars twinkle via GLSL.       |
|             | Ingestion                     | - Interactive stars render with glow shaders.   |
|             |                               | - Coordinates map from universeData.json.       |
|             |                               |                                                 |
| Milestone 3 | Interaction Engine & HUD      | - Center reticle highlights stars within 3.5°.  |
|             |                               | - Tap-anywhere opens memory cards.              |
|             |                               | - Desktop click-to-focus works as expected.     |
|             |                               |                                                 |
| Milestone 4 | Constellations & Progression  | - Constellation lines render via buffer lines.  |
|             |                               | - Completed clusters trigger toast banner.      |
|             |                               | - Discoveries persist across page refreshes.    |
|             |                               |                                                 |
| Milestone 5 | Audio Engine & Finale         | - Web Audio synth plays pentatonic tones.       |
|             | Sequence                      | - Camera drifts smoothly to finale cluster.     |
|             |                               | - Birthday letter displays on arrival.          |
+-------------+-------------------------------+-------------------------------------------------+
```

### Self-Contained Verification Checklist for Agents
- [ ] **Mobile Sensor Check:** Test on physical iOS Safari and Android Chrome devices over HTTPS.
- [ ] **Gyro Horizon Check:** Rotate phone around roll and pitch axes; confirm the celestial horizon stays aligned with real gravity.
- [ ] **Desktop Fallback Check:** Open on a desktop browser. Drag navigation must work smoothly without throwing device orientation errors.
- [ ] **Reticle Targeting Check:** Align a star with the center screen reticle; confirm the targeting animation triggers and tapping opens the modal.
- [ ] **Offline / Persistence Check:** Discover 3 stars, refresh the browser, and confirm the HUD displays `3 / N Stars Found`.
- [ ] **Finale Drift Check:** Trigger the finale sequence; verify user input disengages and the camera glides smoothly to the final constellation.