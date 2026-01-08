# Neon Saber → Beat Saber: Complete Implementation Plan

## Executive Summary

Transform the current "Neon Saber" prototype into a **full-fledged Beat Saber clone** with camera-based hand tracking, directional slashing, and **dynamic beat mapping from any YouTube video** - a feature that would actually surpass the original Beat Saber.

---

## Part 1: Beat Saber Core Features Analysis

### What Makes Beat Saber Great

| Feature | Description | Fun Factor |
|---------|-------------|------------|
| **Directional Slashing** | Blocks have arrow indicators requiring specific slash directions | ⭐⭐⭐⭐⭐ |
| **Music Synchronization** | Blocks arrive perfectly on beat | ⭐⭐⭐⭐⭐ |
| **Dual Sabers** | Two colored sabers (red/blue) | ⭐⭐⭐⭐ |
| **Color Matching** | Must hit right color with right saber | ⭐⭐⭐⭐ |
| **Flow State** | Continuous movement patterns | ⭐⭐⭐⭐⭐ |
| **Obstacles** | Dodge walls and bombs | ⭐⭐⭐ |
| **Scoring Precision** | Points based on angle, position, follow-through | ⭐⭐⭐⭐ |
| **Combo System** | Multiplier builds with consecutive hits | ⭐⭐⭐⭐ |
| **Visual Feedback** | Slice effects, particles, screen effects | ⭐⭐⭐⭐ |
| **Audio Feedback** | Satisfying slice sounds | ⭐⭐⭐⭐ |
| **Custom Songs** | Community beat maps | ⭐⭐⭐⭐⭐ |

---

## Part 2: Current vs Target Comparison

| Feature | Current State | Target State | Gap |
|---------|---------------|--------------|-----|
| **Hand Tracking** | MediaPipe position + direction | + Velocity vectors + gesture detection | Medium |
| **Directional Slashing** | ❌ Any hit counts | Blocks require correct slash direction | **HIGH** |
| **Beat Sync** | Timer-based spawning | Real FFT beat detection | **HIGH** |
| **Scoring** | 100pts flat | Angle + precision + follow-through scoring | Medium |
| **Block Types** | Basic cubes | + Arrows, + bombs, + walls | Medium |
| **Custom Music** | 3 hardcoded songs | YouTube/any audio source with dynamic mapping | **HIGH** |
| **Visual Polish** | Basic | + Slice trails, debris, screen shake | Low |
| **Haptic Feedback** | ❌ None | Vibration API (mobile) | Low |
| **Patterns** | Random | Designed flow patterns | Medium |

---

## Part 3: The YouTube Dynamic Beat Mapping Vision

### Why This Is Better Than Beat Saber

Beat Saber requires **manually created beat maps** - someone has to painstakingly place every block. This limits songs to what the community maps.

**Our Vision**: Link ANY YouTube video → AI/Algorithm analyzes audio in real-time → Generates beat map dynamically → Play immediately.

### Technical Approach

```
YouTube URL → youtube-dl/ytdl-core → Audio Stream → Web Audio API → FFT Analysis → Beat Events → Block Spawning
                                                           ↓
                                                  Onset Detection
                                                  BPM Detection
                                                  Frequency Analysis (bass vs treble)
                                                           ↓
                                              Smart Pattern Generation
```

### Implementation Options

#### Option A: Server-Side Processing (Recommended for YouTube)
```
1. User pastes YouTube URL
2. Backend extracts audio (yt-dlp / pytube)
3. Analyze with Librosa/Aubio (Python) or Essentia
4. Generate beat map JSON
5. Stream to frontend
6. Play with pre-computed map
```

**Pros**: Best accuracy, no CORS issues, can use advanced ML models
**Cons**: Requires backend, slight delay before playing

#### Option B: Client-Side Real-Time (For uploaded files)
```
1. User uploads MP3/audio file
2. Web Audio API decodes audio
3. web-audio-beat-detector for BPM
4. Custom FFT analysis for onset detection
5. Generate blocks in real-time
```

**Pros**: No backend needed, works offline
**Cons**: Less accurate, can't directly access YouTube audio

#### Option C: Hybrid (Best UX)
- YouTube videos → Server-side processing
- Local files → Client-side real-time
- Pre-mapped songs → Instant play

---

## Part 4: Hand Tracking Enhancement Options

### Current: MediaPipe Hands via @mediapipe/tasks-vision

**What we have**:
- 21 landmarks per hand
- Position + direction (wrist → knuckle)
- 60fps tracking
- Works well

**What we need to add**:
1. **Velocity Tracking** - For slash detection
2. **Direction History** - For validating slash direction
3. **Gesture Recognition** - For pause, menu navigation

### Library Options Comparison

| Library | Accuracy | Performance | Features | Bundle Size |
|---------|----------|-------------|----------|-------------|
| **MediaPipe Hands (current)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ~12MB |
| **TensorFlow.js HandPose** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ~15MB |
| **Fingerpose (addon)** | N/A | N/A | ⭐⭐⭐⭐⭐ | ~50KB |
| **MediaPipe Gesture Recognizer** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ~15MB |

### Recommendation: Stick with MediaPipe + Custom Velocity/Direction Analysis

MediaPipe is already excellent. We just need to:
1. Add velocity calculation (already have position delta!)
2. Track direction history (last 5-10 frames)
3. Implement slash direction validation

```typescript
// Enhanced hand data structure
interface EnhancedHandData {
  position: Vector3;
  direction: Vector3;
  velocity: Vector3;           // NEW: movement speed/direction
  velocityHistory: Vector3[];  // NEW: last N velocity samples
  slashDirection: SlashDir;    // NEW: computed from velocity history
}
```

---

## Part 5: Prioritized Implementation Roadmap

### 🔴 Priority 1: Core Gameplay (MUST HAVE)

These make the difference between "demo" and "game":

#### 1.1 Directional Slashing System ⭐⭐⭐⭐⭐
**Impact**: Transforms button-mashing into skill-based gameplay

```typescript
enum SlashDirection {
  UP, DOWN, LEFT, RIGHT,
  UP_LEFT, UP_RIGHT, DOWN_LEFT, DOWN_RIGHT,
  ANY  // Some blocks don't care
}

// Cube now has required direction
interface CubeData {
  // ... existing
  requiredDirection: SlashDirection;
}

// Validation logic
function validateSlash(cubeDir: SlashDirection, slashVelocity: Vector3): boolean {
  const slashDir = velocityToDirection(slashVelocity);
  return cubeDir === SlashDirection.ANY || cubeDir === slashDir;
}
```

**Visual**: Arrow on cube face pointing in required direction

#### 1.2 Velocity-Based Hit Detection ⭐⭐⭐⭐⭐
**Impact**: Prevents "parking" saber on blocks

```typescript
// In HandTracker - add velocity tracking
const prevPositions = useRef<{left: Vector3[], right: Vector3[]}>({left: [], right: []});

const calculateVelocity = (current: Vector3, history: Vector3[], dt: number): Vector3 => {
  if (history.length < 2) return new Vector3();
  const oldest = history[0];
  return current.clone().sub(oldest).divideScalar(dt * history.length);
};

// In hit detection - require minimum velocity
const MIN_SLASH_VELOCITY = 2.0; // units/sec
if (velocity.length() < MIN_SLASH_VELOCITY) {
  return; // Too slow, doesn't count as hit
}
```

#### 1.3 Enhanced Scoring System ⭐⭐⭐⭐
**Impact**: Rewards precision, creates skill ceiling

```typescript
function calculateScore(
  slashAngle: number,      // How accurate vs required direction (0-180°)
  swingVelocity: number,   // Speed of slash
  positionAccuracy: number // How centered the hit was
): number {
  const angleScore = Math.max(0, 1 - slashAngle / 60) * 70;    // Max 70pts
  const speedScore = Math.min(swingVelocity / 5, 1) * 15;      // Max 15pts
  const positionScore = positionAccuracy * 15;                  // Max 15pts

  const baseScore = angleScore + speedScore + positionScore;   // Max 100
  const multiplier = 1 + Math.floor(streak / 10) * 0.1;

  return Math.floor(baseScore * multiplier);
}
```

---

### 🟠 Priority 2: Beat Synchronization (HIGH VALUE)

#### 2.1 Real-Time Beat Detection ⭐⭐⭐⭐⭐
**Impact**: Music feels connected to gameplay

**Option A: web-audio-beat-detector (Simple, Good for Electronic)**
```bash
npm install web-audio-beat-detector
```

```typescript
import { analyze } from 'web-audio-beat-detector';

const detectBPM = async (audioBuffer: AudioBuffer): Promise<number> => {
  const { bpm } = await analyze(audioBuffer);
  return bpm;
};
```

**Option B: Custom FFT Onset Detection (Better for varied music)**
```typescript
class BeatDetector {
  private analyser: AnalyserNode;
  private lastEnergy = 0;
  private threshold = 1.5;

  detectBeat(): boolean {
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    // Focus on bass frequencies (0-200Hz) for kick drums
    const bassEnergy = freqData.slice(0, 10).reduce((a, b) => a + b, 0);

    const isBeat = bassEnergy > this.lastEnergy * this.threshold;
    this.lastEnergy = bassEnergy * 0.9 + this.lastEnergy * 0.1; // Smooth

    return isBeat;
  }
}
```

#### 2.2 Pattern Generation from Beats ⭐⭐⭐⭐
**Impact**: Creates "designed" feeling levels

```typescript
interface BeatEvent {
  time: number;
  type: 'kick' | 'snare' | 'hihat' | 'vocal' | 'melody';
  intensity: number;
}

function generatePattern(beats: BeatEvent[]): CubeSpawn[] {
  return beats.map((beat, i) => {
    // Kicks → lower blocks
    // Snares → upper blocks
    // Hihats → fast patterns
    // High intensity → double blocks

    const y = beat.type === 'kick' ? 0.5 : beat.type === 'snare' ? 1.5 : 1.0;
    const doubleBlock = beat.intensity > 0.8;

    return {
      time: beat.time,
      position: new Vector3(randomLane(), y, SPAWN_Z),
      direction: generateFlowDirection(i, beats),
      doubleBlock
    };
  });
}
```

---

### 🟡 Priority 3: YouTube Integration (GAME CHANGER)

#### 3.1 Backend Service for Audio Extraction
**Impact**: "Play ANY song" - killer feature

```python
# backend/audio_service.py
from yt_dlp import YoutubeDL
import librosa
import json

def extract_beats(youtube_url: str) -> dict:
    # Download audio
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': '/tmp/%(id)s.%(ext)s',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3'}]
    }

    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        audio_path = f"/tmp/{info['id']}.mp3"

    # Analyze with librosa
    y, sr = librosa.load(audio_path)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(y=y, sr=sr, onset_envelope=onset_env)

    return {
        'bpm': float(tempo),
        'beats': librosa.frames_to_time(beats, sr=sr).tolist(),
        'onsets': librosa.frames_to_time(onsets, sr=sr).tolist(),
        'duration': float(len(y) / sr),
        'audio_url': f'/api/audio/{info["id"]}.mp3'
    }
```

#### 3.2 Frontend YouTube Input
```typescript
const YouTubeInput: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    const beatMap = await response.json();
    onBeatMapReady(beatMap);
    setLoading(false);
  };

  return (
    <div>
      <input
        placeholder="Paste YouTube URL..."
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <button onClick={handleSubmit}>
        {loading ? 'Analyzing...' : 'Generate Beat Map'}
      </button>
    </div>
  );
};
```

---

### 🟢 Priority 4: Polish & Extra Features (NICE TO HAVE)

#### 4.1 Obstacles (Bombs & Walls)
```typescript
interface Obstacle {
  type: 'bomb' | 'wall';
  position: Vector3;
  size: Vector3; // For walls
  duration: number; // How long wall lasts
}

// Bombs: Hit = lose points, must avoid
// Walls: Must duck/lean to avoid
```

#### 4.2 Slice Visual Effects
```typescript
// Trail renderer following saber tip
const SliceTrail = ({ saber }) => {
  const trailRef = useRef();
  const positions = useRef<Vector3[]>([]);

  useFrame(() => {
    positions.current.push(saber.position.clone());
    if (positions.current.length > 20) positions.current.shift();
    // Update trail geometry
  });

  return <line ref={trailRef} />;
};

// Debris particles when cube is sliced
const SliceDebris = ({ position, sliceDirection, color }) => {
  // Two halves of cube flying apart along slice plane
};
```

#### 4.3 Screen Effects on Miss/Hit
```typescript
// Camera shake on miss
const useScreenShake = () => {
  const shake = useRef(0);

  useFrame(({ camera }) => {
    if (shake.current > 0) {
      camera.position.x += (Math.random() - 0.5) * shake.current * 0.1;
      camera.position.y += (Math.random() - 0.5) * shake.current * 0.1;
      shake.current *= 0.9;
    }
  });

  return { triggerShake: (intensity: number) => { shake.current = intensity; } };
};
```

#### 4.4 Practice Mode
- Slow motion option (0.5x, 0.75x speed)
- No-fail mode
- Section repeat

---

## Part 6: Technical Architecture

### Current Architecture
```
App.tsx (State)
├── HandTracker.tsx (Input)
├── GameScene.tsx (Rendering)
│   ├── Saber (2x)
│   ├── CubeManager
│   │   └── Cube (many)
│   └── Explosions
└── UIOverlay.tsx (UI)
```

### Proposed Enhanced Architecture
```
App.tsx (State + Game Loop)
├── HandTracker.tsx (Input)
│   └── VelocityTracker (NEW)
├── BeatEngine/ (NEW)
│   ├── BeatDetector.ts
│   ├── PatternGenerator.ts
│   └── YouTubeIntegration.ts
├── GameScene.tsx (Rendering)
│   ├── Saber (2x)
│   │   └── SliceTrail (NEW)
│   ├── CubeManager
│   │   └── DirectionalCube (ENHANCED)
│   ├── ObstacleManager (NEW)
│   │   ├── Bomb
│   │   └── Wall
│   └── Effects
│       ├── Explosions
│       ├── SliceDebris (NEW)
│       └── ScreenEffects (NEW)
└── UIOverlay.tsx (UI)
    ├── Menu
    ├── YouTubeInput (NEW)
    ├── SongBrowser (NEW)
    └── ScoreDisplay
```

---

## Part 7: Implementation Order (Step-by-Step)

### Phase 1: Core Slashing (Week focus: Gameplay feel)
1. ✅ Add velocity tracking to HandTracker
2. ✅ Create SlashDirection enum and detection
3. ✅ Update Cube to show directional arrows
4. ✅ Implement direction validation on hit
5. ✅ Add minimum velocity requirement
6. ✅ Enhanced scoring with angle accuracy

### Phase 2: Beat Integration (Week focus: Music connection)
7. ✅ Integrate web-audio-beat-detector
8. ✅ Create BeatDetector class with FFT
9. ✅ Build PatternGenerator for beat→cubes
10. ✅ Test with various music genres
11. ✅ Add visual beat indicator

### Phase 3: YouTube Feature (Week focus: Killer feature)
12. ✅ Set up backend (Python/Node)
13. ✅ Implement YouTube audio extraction
14. ✅ Add Librosa beat analysis
15. ✅ Create frontend YouTube input
16. ✅ Build loading/progress UI
17. ✅ Cache analyzed songs

### Phase 4: Polish (Week focus: Feel & juice)
18. ✅ Slice trail effects
19. ✅ Cube debris particles
20. ✅ Screen shake on miss
21. ✅ Combo announcements (10x! 50x!)
22. ✅ Better audio feedback
23. ✅ Bombs & walls (optional)

---

## Part 8: Key Questions Answered

### Q: Should blocks sync with music?
**A: ABSOLUTELY YES.** This is THE defining feature of rhythm games. Without music sync, it's just a reaction game. The satisfaction of slicing on-beat is 90% of the fun.

### Q: YouTube video or just audio?
**A: Both options, audio-focused.**
- Allow YouTube music videos (most common use case)
- Also support direct audio file upload
- Visual video playback optional (performance cost)

### Q: Can we do dynamic beat mapping?
**A: YES, and it's our competitive advantage.**
- Beat Saber requires pre-made maps
- We can analyze ANY song
- Trade-off: Auto-generated maps won't be as "designed" as hand-crafted ones
- Solution: Generate good-enough maps + allow community refinement

### Q: MediaPipe vs other tracking?
**A: Stick with MediaPipe.** It's already state-of-the-art. Our enhancement is:
1. Better velocity calculation
2. Direction history tracking
3. Slash validation logic

These are algorithm additions, not library replacements.

---

## Part 9: Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Accurate direction detection | 0% | >90% |
| Beat sync accuracy | ~50% (random) | >95% |
| Songs playable | 3 | Unlimited (YouTube) |
| Score differentiation | Low (all 100) | High (10-115 per block) |
| Player engagement (est.) | 2 min | 15+ min |

---

## Part 10: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| YouTube API blocks | Medium | High | Multiple extraction methods, self-hosted |
| Beat detection inaccurate for some genres | Medium | Medium | Manual BPM input fallback |
| Performance issues with effects | Low | Medium | LOD system, effect quality settings |
| Hand tracking loses track | Medium | Medium | Graceful degradation, re-detection |

---

## Conclusion

The path from current "Neon Saber" to a true Beat Saber experience is clear:

1. **Directional slashing** is the #1 priority - it transforms gameplay
2. **Beat sync** is #2 - it makes music meaningful
3. **YouTube integration** is the killer feature that beats the original
4. **Polish** makes it feel professional

With MediaPipe's excellent tracking as our foundation, we can build a genuinely competitive rhythm game that runs entirely in the browser.

**Let's build this.** 🎮
