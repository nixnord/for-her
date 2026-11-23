# Agent Context: Real Celestial Map & Personal Universe

**Document Type:** Context & Implementation Reference for Autonomous Engineering Agents  
**Target Architecture:** Decoupled Vanilla Three.js Core + React UI Shell + Zustand State Bridge  
**Primary Interaction:** Mobile Gyroscope 360° Tracking (Android Chrome & iOS Safari) + Desktop Mouse-Drag Fallback  

---

## 1. Project Mission & Core Concept

You are building a mobile-first, 360-degree interactive celestial web application designed as a personal birthday gift. The application replicates the sky-exploration mechanics of planetarium software (e.g., Stellarium Mobile).

Instead of purely procedural random stars or a detached sci-fi scene, the experience layers a **personal, intimate universe on top of authentic astronomical reality**:
1. Users look around by physically tilting and rotating their smartphone.
2. The backdrop displays real astronomical data: the Milky Way galactic plane from NASA deep star surveys, real catalog stars with accurate spectral colors, and the 88 modern IAU constellations.
3. Layered directly into this real sky are **interactive personal memory stars**, custom story constellations, audio voice notes, photographs, and a cinematic birthday finale triggered once all designated memories are uncovered.

---

## 2. The Three-Tier Celestial Hierarchy

The 3D environment is structured into three concentric spherical layers centered on the camera at $(0, 0, 0)$:

```
+-----------------------------------------------------------------------------------+
|  TIER 3: Deep Cosmic Skybox (Radius R = 1000)                                     |
|  - Inverted sphere with NASA SVS Deep Star Map / Milky Way equirectangular texture|
|  - Real cosmic dust lanes, diffuse nebulae, and galactic plane                    |
|  - Material: MeshBasicMaterial (depthWrite: false, sRGBColorSpace)                |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  TIER 2: Real Celestial Catalog & IAU Constellations (Radius R = 400 - 500)       |
|  - Real catalog stars (Yale Bright Star / Hipparcos / HYG Database)               |
|  - Star brightness derived from Apparent Magnitude (V_mag)                        |
|  - Star colors derived from Astronomical Color Index (B - V)                      |
|  - 88 official IAU constellation stick-figure lines (subtle, non-interactive)     |
|  - Implementation: `three-starmap` or custom BufferGeometry line segments        |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|  TIER 1: Personal Universe Overlay (Radius R = 200)                               |
|  - Interactive story stars placed at specific RA/Dec or attached to real stars    |
|  - Single-pass analytical GLSL glow halos and 4-point diffraction spikes          |
|  - Dynamic story constellation lines that illuminate upon discovery               |
|  - Screen-center targeting reticle lock + tap-anywhere selection                  |
|  - Final birthday constellation that unlocks the ending letter                   |
+-----------------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Key Dependencies

```json
{
  "dependencies": {
    "three": "^0.165.0",
    "three-stdlib": "^2.30.0",
    "camera-controls": "^2.8.5",
    "three-starmap": "^1.1.0",
    "zustand": "^4.5.2",
    "gsap": "^3.12.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.395.0"
  }
}
```

* **Rendering Engine:** Vanilla Three.js singleton running an isolated `requestAnimationFrame` loop. React does **not** reconcile 3D scene objects.
* **Desktop Slew & Drag:** `camera-controls` (yomotsu) for smooth trackball dragging, momentum, and Stellarium-style programmatic camera slewing (`.rotateTo()`).
* **Mobile Gyroscope:** `three-stdlib`'s `DeviceOrientationControls` combined with custom Gravity-Aligned Yaw Offset calibration.
* **Astronomical Core:** `three-starmap` for Yale Bright Star catalog and IAU constellation geometries.
* **State Bridge:** Zustand with `persist` middleware to synchronize WebGL events with React UI overlays and persist discovery progress in `localStorage`.
* **Animations:** GSAP for cinematic camera transitions, HUD fades, and constellation line drawing.
* **Audio:** Native browser Web Audio API (procedural ambient drone and pentatonic chimes).

---

## 4. Mathematical Foundations & Coordinate Conversions

### 4.1 Right Ascension (RA) & Declination (Dec) to Cartesian Coordinates
Personal stars can be placed using standard astronomical coordinates:
* **Right Ascension ($\alpha$ / RA):** Measured in hours $[0, 24)\text{h}$ or degrees $[0, 360)^\circ$.
* **Declination ($\delta$ / Dec):** Measured in degrees $[-90^\circ, +90^\circ]$ ($-90^\circ$ South Celestial Pole, $+90^\circ$ North Celestial Pole).
* **Radius ($R$):** $R = 200.0$ for interactive overlay objects.

#### Conversion Formula
$$\theta = \left(\frac{\text{RA}_{\text{hours}}}{24}\right) \cdot 2\pi = \text{RA}_{\text{deg}} \cdot \frac{\pi}{180}$$
$$\phi = \frac{\pi}{2} - \left(\text{Dec}_{\text{deg}} \cdot \frac{\pi}{180}\right)$$

In Three.js right-handed coordinates ($+X$ East, $+Y$ North Pole/Zenith, $+Z$ South):
$$x = R \cdot \sin(\phi) \cdot \cos(\theta)$$
$$y = R \cdot \cos(\phi)$$
$$z = -R \cdot \sin(\phi) \cdot \sin(\theta)$$

#### TypeScript Implementation
```typescript
import * as THREE from 'three';

export function raDecToCartesian(raHours: number, decDeg: number, radius = 200): THREE.Vector3 {
  const theta = (raHours / 24) * 2 * Math.PI;
  const decRad = THREE.MathUtils.degToRad(decDeg);
  const phi = Math.PI / 2 - decRad;

  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(decRad),
    -radius * Math.sin(phi) * Math.sin(theta)
  );
}
```

---

### 4.2 Mobile IMU to Three.js Camera Quaternion Transformation
The browser's `DeviceOrientationEvent` emits intrinsic Tait-Bryan angles in the $Z-X'-Y''$ sequence ($\alpha, \beta, \gamma$).

To map these angles so holding the smartphone upright and looking through the rear camera matches the virtual celestial sphere:

1. **Euler Construction:**
   $$\mathbf{e} = \left(\beta_{\text{rad}},\, \alpha_{\text{rad}},\, -\gamma_{\text{rad}},\, \text{'YXZ'}\right)$$
   $$q_{\text{device}} = \text{QuaternionFromEuler}(\mathbf{e})$$

2. **Rear-Camera Alignment ($q_{\text{flip}}$):**
   Rotate $-90^\circ$ ($-\pi/2$ radians) around local $X$:
   $$q_{\text{flip}} = \left(-\frac{\sqrt{2}}{2},\, 0,\, 0,\, \frac{\sqrt{2}}{2}\right)$$

3. **Screen Orientation Compensation ($q_{\text{screen}}$):**
   Query $\theta_{\text{screen}} = (\text{screen.orientation.angle} \parallel 0)^\circ$:
   $$q_{\text{screen}} = \text{FromAxisAngle}\left(\begin{bmatrix} 0 \\ 0 \\ 1 \end{bmatrix},\, -\theta_{\text{screen}} \times \frac{\pi}{180}\right)$$

4. **Composite Raw Quaternion:**
   $$q_{\text{raw}} = q_{\text{device}} \cdot q_{\text{flip}} \cdot q_{\text{screen}}$$

---

### 4.3 Gravity-Aligned Yaw Offset Calibration (Recenter)
Absolute compass heading ($\alpha$) suffers from indoor electromagnetic interference, and forcing the user to face physical North to see the initial constellation creates poor UX.

**CRITICAL RULE:** Never zero pitch ($\beta$) or roll ($\gamma$) during calibration. If pitch or roll are zeroed, the virtual celestial horizon tilts relative to real physical gravity. Calibrate **only** the yaw offset around the world $Y$-axis:

```typescript
// 1. Calculate device line-of-sight in world coordinates
const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q_raw);

// 2. Extract horizontal azimuth angle (yaw) relative to -Z axis
const currentYaw = Math.atan2(forward.x, -forward.z);

// 3. Offset yaw so current heading snaps to target heading (0 rad)
const yawOffset = -currentYaw;
const q_yawOffset = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0), 
  yawOffset
);

// 4. Calibrated orientation quaternion
const q_calibrated = q_yawOffset.clone().multiply(q_raw);
```

---

### 4.4 Delta-Time Exponential Smoothing
To filter out hand tremors and raw IMU noise without introducing perceptible latency:
$$t = 1.0 - e^{-\lambda \cdot \Delta t} \quad (\lambda = 16.0)$$
$$q_{\text{camera}} = \text{slerp}\left(q_{\text{camera}},\, q_{\text{calibrated}},\, t\right)$$

**Angular Deadband:** If $|q_{\text{camera}} \cdot q_{\text{calibrated}}| > 0.9999994$ (divergence $< 0.04^\circ$), skip the SLERP update to prevent sub-pixel star shimmering when holding the device steady.

---

## 5. Dual-Mode Input & Camera Arbitration

The camera state is governed by an explicit Finite State Machine:

```
[ UNINITIALIZED ]
       | User taps "Enter Universe" (iOS Permission & Audio Unlock)
       v
[ CAPABILITY CHECK ]
       |-- Mobile with Gyroscope   --> [ MOBILE_SENSOR ]
       +-- Desktop / Denied Sensors --> [ POINTER_DRAG ]
       |
       +--> When star selected    --> [ TARGET_FOCUS ] (camera-controls .rotateTo)
       +--> When finale unlocked   --> [ CINEMATIC_FINALE ] (GSAP slerp drift)
```

### 5.1 Mobile Interaction: Screen-Center Reticle & Tap Anywhere
Tapping small stars on high-DPI smartphone screens causes missed touches.
* The application features a **fixed screen-center targeting reticle**.
* On every frame, compute forward line-of-sight: $\mathbf{v}_{\text{forward}} = (0, 0, -1) \cdot q_{\text{camera}}$.
* For each interactive star $\mathbf{P}_{\text{star}}$, compute angular cosine:
  $$\cos(\theta) = \mathbf{v}_{\text{forward}} \cdot \frac{\mathbf{P}_{\text{star}}}{\|\mathbf{P}_{\text{star}}\|}$$
* If $\cos(\theta) > \cos(3.5^\circ) \approx 0.9981$:
  1. The star enters **Reticle Lock**.
  2. The 2D UI reticle pulses and scales down.
  3. Star quad GLSL uniform `uHover` interpolates to `1.0`.
  4. **Tapping anywhere on the screen** opens the locked star's memory modal.

### 5.2 Desktop Interaction: Drag & Hover Raycasting
When `POINTER_DRAG` is active:
* Mouse-drag rotates the sky using `camera-controls` with planetary inertia damping (`dampingFactor: 0.05`).
* Standard Three.js raycasting detects hover states over enlarged hit proxy spheres ($R_{\text{hit}} = 12.0$).
* Clicking a star triggers `controls.rotateTo(theta, phi, true)` to center the star before opening the modal.

---

## 6. Single-Pass Custom GLSL Shaders (Mobile Performance)

Standard multi-pass post-processing bloom (`UnrealBloomPass`) causes severe GPU fill-rate drops on mobile devices (e.g., Mali-G52, Adreno 610). 

**Constraint:** All star glows, halation, and diffraction spikes must be rendered in a **single pass** using additive blending (`THREE.AdditiveBlending`, `depthWrite: false`).

### Interactive Star Quad Fragment Shader
Rendered on camera-facing billboard planes (`PlaneGeometry(24, 24)`):

```glsl
varying vec2 vUv;

uniform vec3 uCoreColor;     // Warm champagne: vec3(1.0, 0.95, 0.82)
uniform vec3 uHaloColor;     // Rose gold / Amber: vec3(0.98, 0.58, 0.42)
uniform float uTime;
uniform float uPulseSpeed;
uniform float uIsDiscovered; // 0.0 = undiscovered, 1.0 = discovered
uniform float uHoverState;   // 0.0 to 1.0 from reticle focus

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float dist = length(p);
  if (dist > 1.0) discard;

  float pulse = 0.85 + 0.15 * sin(uTime * uPulseSpeed);
  float focusBoost = 1.0 + uHoverState * 0.5;

  // 1. Analytical Inverse-Square Core
  float core = 0.022 / (dist * dist + 0.012);

  // 2. Exponential Halo Falloff
  float halo = pow(max(0.0, 1.0 - dist), 3.0) * 0.7;

  // 3. 4-Point Diffraction Cross Spikes (Telescope / Planetarium Aesthetic)
  float spikeH = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 3.0);
  float spikeV = exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 3.0);
  float spikes = (spikeH + spikeV) * 0.45 * (1.0 + uIsDiscovered * 0.5);

  float intensity = (core + halo + spikes) * pulse * focusBoost;
  vec3 color = mix(uHaloColor, uCoreColor, clamp(core * 0.6, 0.0, 1.0));

  float edgeFeather = smoothstep(1.0, 0.75, dist);
  gl_FragColor = vec4(color * intensity * edgeFeather, intensity * edgeFeather);
}
```

---

## 7. Web Audio Synthesizer Engine

To eliminate network latency and asset overhead from loading audio files:
1. An `AudioContext` singleton initializes in suspended state and resumes synchronously on the first user tap ("Enter Universe").
2. **Ambient Drone:** Two detuned sine-wave oscillators ($55\text{Hz}$ and $110\text{Hz}$) routed through a low-pass filter ($350\text{Hz}$, $Q=2.0$) and a $-18\text{dB}$ stereo gain stage.
3. **Discovery Chimes:** Each star is mapped to a note from the **Celestial Pentatonic Scale** ($C_4, D_4, E_4, G_4, A_4, C_5$). On discovery, an oscillator synthesizes the frequency with an exponential decay envelope ($2.4\text{s}$) routed through a procedural reverb convolver.

---

## 8. Data Schema (`universeData.json`)

```json
{
  "requiredStarCountForFinale": 10,
  "nasaSkyboxTextureUrl": "/textures/nasa_milkyway_4k.jpg",
  "interactiveStars": [
    {
      "id": "star_vega",
      "associatedCatalogStar": "Vega",
      "coordinates": { "raHours": 18.615, "decDeg": 38.78, "radius": 200 },
      "coreColorHex": "#FFF4E8",
      "haloColorHex": "#A0C4FF",
      "sizeMultiplier": 1.2,
      "constellationId": "constellation_summer_triangle",
      "content": {
        "title": "Summer Triangle Memory",
        "dateContext": "August 14, 2023",
        "narrativeText": "We lay on the grass trying to find Vega while the city lights flickered in the valley below...",
        "photoUrl": "/memories/summer_terrace.webp",
        "photoCaption": "Stargazing at midnight.",
        "chimeTone": "E4"
      }
    }
  ],
  "constellations": [
    {
      "id": "constellation_summer_triangle",
      "name": "The Memory Triangle",
      "themeColorHex": "#83C5BE",
      "memberStarIds": ["star_vega", "star_deneb", "star_altair"],
      "connections": [
        { "fromStarId": "star_vega", "toStarId": "star_deneb" },
        { "toStarId": "star_altair", "fromStarId": "star_deneb" },
        { "fromStarId": "star_altair", "toStarId": "star_vega" }
      ],
      "completionReward": {
        "title": "Triangle Completed",
        "storySnippet": "Three memories woven into a permanent constellation in your sky."
      }
    }
  ],
  "finale": {
    "targetCoordinates": { "raHours": 5.58, "decDeg": -5.38, "radius": 200 },
    "birthdayConstellationLines": [
      { "fromStarId": "star_bday_1", "toStarId": "star_bday_2" }
    ],
    "letter": {
      "title": "Happy Birthday",
      "salutation": "To My Favorite Star,",
      "bodyParagraphs": [
        "Every star in this sky represents a memory that wouldn't exist without you.",
        "May this coming year be as vast, luminous, and beautiful as this universe."
      ],
      "closing": "With all my love,",
      "signature": "Always"
    }
  }
}
```

---

## 9. Mobile UX Guardrails & Performance Checklist

| Potential Issue | Root Cause | Mandatory Agent Solution |
| :--- | :--- | :--- |
| **Black screen on iOS** | `requestPermission` was not triggered directly by user gesture. | Gate initial entry behind an explicit "Enter Universe" button. Await `DeviceOrientationEvent.requestPermission()` inside the `click` handler. |
| **Android sensor hang** | Device advertises sensor support but emits `null` coordinates. | Start a 600ms watchdog timer on boot. If no numeric `alpha`/`beta` events fire within 600ms, fall back to `POINTER_DRAG`. |
| **Viewport jump on scroll** | Address bar expands/contracts on touch gestures. | Set CSS `height: 100dvh`, apply `overscroll-behavior: none` and `touch-action: none` to `#root` and `canvas`. |
| **Frame stutter on rotation** | Heap memory allocations inside the render tick trigger GC pauses. | Pre-allocate all scratch vectors (`THREE.Vector3`, `THREE.Quaternion`, `THREE.Matrix4`) at class construction. Zero allocations inside `requestAnimationFrame`. |
| **Overdraw / GPU melt** | Multiple full-screen post-processing bloom passes. | **Strictly prohibited.** Use single-pass analytical additive billboard GLSL quads. |
| **Canvas DPI battery drain** | Rendering at native 3x/4x retina resolution. | Restrict pixel ratio: `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))`. |

---

## 10. Suggested Directory Structure for Implementation

```
src/
├── main.tsx
├── App.tsx
├── index.css                          # 100dvh, touch-action: none
├── types/
│   └── universe.types.ts              # Data contracts and schema interfaces
├── data/
│   └── universeData.json              # Real coordinates and personal memories
├── store/
│   └── useUniverseStore.ts            # Zustand store (discovery progress, persistence)
├── audio/
│   └── CelestialAudioEngine.ts        # Synthesized Web Audio ambient and chimes
├── core/                              # PURE THREE.JS & SENSORS (NO REACT)
│   ├── CelestialUniverse.ts           # Master WebGL coordinator & RAF loop
│   ├── CameraArbitrator.ts            # FSM: Sensor vs. Drag vs. Slew vs. Finale
│   ├── InteractionManager.ts          # Screen-center cone raycasting & target lock
│   ├── controllers/
│   │   ├── MobileGyroController.ts    # Orientation math & yaw recalibration
│   │   └── DesktopDragController.ts   # camera-controls integration
│   └── scene/
│       ├── CelestialSkybox.ts         # NASA Deep Star Map equirectangular sphere
│       ├── RealCatalogStars.ts        # three-starmap / Yale catalog stars & 88 lines
│       ├── PersonalStarSystem.ts      # Instanced personal stars with GLSL glow
│       └── StoryConstellations.ts     # Dynamic BufferGeometry memory lines
└── components/                        # REACT 2D GLASSMORPHISM OVERLAY
    ├── ViewportCanvas.tsx             # Mounts canvas and hooks to CelestialUniverse
    ├── OnboardingModal.tsx            # iOS permission trigger & audio context unlock
    ├── HUD/
    │   ├── TopNavigation.tsx          # Star discovery counter & recenter button
    │   ├── CenterAimReticle.tsx       # Dynamic targeting crosshair UI
    │   └── InteractionPrompt.tsx      # "Tap anywhere to open" prompt
    ├── Modals/
    │   ├── MemoryCardModal.tsx        # Glassmorphic card (photo, audio, story)
    │   └── ConstellationToast.tsx     # Constellation completion notification
    └── Finale/
        ├── FinaleSkipControl.tsx      # Skip button during camera drift
        └── BirthdayLetterModal.tsx    # Poetic final birthday letter overlay
```

---

## 11. Verification & Acceptance Criteria

When evaluating any generated module or running end-to-end testing, verify:
1. **Desktop Exploration:** Opening on desktop defaults immediately to click-and-drag camera exploration with smooth inertia damping.
2. **Mobile Exploration:** Tapping "Enter Universe" on mobile requests orientation permissions and tracks physical phone movement.
3. **Horizon Stability:** Tilting the phone upward, downward, or rolling it sideways keeps the virtual celestial horizon aligned with real gravity.
4. **Targeting Accuracy:** Pointing the center reticle at an interactive star within $3.5^\circ$ triggers the focus animation and allows tapping anywhere on the screen to view the card.
5. **Session Persistence:** Refreshing the browser preserves previously unlocked stars in `localStorage`.
6. **Finale Execution:** Discovering all required stars disengages sensor input, slews the camera smoothly to the finale constellation, and reveals the birthday letter.