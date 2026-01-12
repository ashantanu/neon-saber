# Hand Tracking Smoothing Guide

## When to Use This Document

Use this guide when:
- You're implementing hand/body tracking using camera-based systems (MediaPipe, TensorFlow.js PoseNet, etc.)
- Your tracked positions appear jittery or noisy
- You need to detect gestures like swipes, slashes, or directional movements
- You're building real-time interactive applications (games, AR/VR, gesture controls)

## The Core Problem

Camera-based hand tracking gives you raw position data every frame. This data has inherent noise from:
- Camera sensor noise
- Lighting variations
- Motion blur
- ML model inference uncertainty
- Frame-to-frame detection inconsistencies

Directly using this raw data results in jittery, unstable visuals and unreliable gesture detection.

## Key Concepts

### 1. Input Smoothing vs Render Smoothing

There are two places you can smooth data:

**Input Smoothing** - Filter the raw tracking data before anything else uses it. This gives all consumers (rendering, collision detection, gesture recognition) clean data to work with.

**Render Smoothing** - Smooth only the visual representation. The underlying data remains raw. This can cause mismatches between what you see and what the system detects.

**Recommendation**: Do input smoothing. It solves the problem at the source.

### 2. Linear Interpolation (Lerp)

Lerp blends between a current value and a target value:
```
smoothed = current + (target - current) * factor
```

The factor (0-1) controls responsiveness:
- Low (0.1-0.3): Very smooth, but laggy
- Medium (0.3-0.5): Balanced
- High (0.5-0.8): Responsive, less smoothing

For positions, lerp works well. Apply it every frame towards the raw tracked position.

### 3. Direction/Rotation Smoothing

For direction vectors or rotations, you have options:
- **Lerp + Normalize**: Lerp the direction vector, then normalize. Simple and effective.
- **Slerp (Spherical Lerp)**: Proper interpolation on a sphere. Better for quaternions/rotations.

### 4. Velocity Averaging

Raw velocity (position delta / time delta) is extremely noisy because it amplifies position noise.

Solution: Keep a history buffer of the last N velocity samples and average them. This gives:
- Stable velocity magnitude for threshold detection
- Consistent direction for gesture recognition
- Smooth acceleration/deceleration curves

Typical buffer size: 5-10 samples.

### 5. Performance: Refs vs State

In React/game loops, storing tracking data in state causes re-renders every frame (60+ times/second). This kills performance.

Store tracking data in refs or plain objects that update without triggering re-renders. Let the render loop read from these refs directly.

## Implementation Approach

1. **Capture raw data** from your tracking library
2. **Smooth positions** using lerp towards raw targets
3. **Smooth directions** using lerp + normalize or slerp
4. **Calculate velocity** from smoothed positions (not raw)
5. **Average velocity** over a history buffer
6. **Store smoothed data** in refs/mutable objects
7. **Let consumers read** the already-smoothed data

## Tuning Guide

| Symptom | Solution |
|---------|----------|
| Too jittery | Lower smoothing factor (e.g., 0.3 → 0.2) |
| Too laggy/slow | Raise smoothing factor (e.g., 0.3 → 0.5) |
| Gestures not detected | Increase velocity history size, lower detection thresholds |
| False gesture triggers | Decrease velocity history size, raise detection thresholds |
| Rotation wobbles | Lower direction smoothing factor |

Start with position smoothing around 0.4-0.5 and direction smoothing around 0.3-0.4, then adjust based on feel.

## Things to Consider

- **Latency vs Stability tradeoff**: More smoothing = more stable but more latency. Find the sweet spot for your use case.
- **Different smoothing for different signals**: Positions might need different smoothing than rotations.
- **Edge cases**: What happens when tracking is lost? Reset smoothed values or decay gracefully?
- **Frame rate independence**: If using fixed lerp factors, they behave differently at different frame rates. Consider delta-time based smoothing for consistency.
- **Predictive smoothing**: Advanced techniques like Kalman filters or One Euro filter can predict movement for even lower latency.

## Resources

### MediaPipe Hand Tracking
- https://developers.google.com/mediapipe/solutions/vision/hand_landmarker
- https://github.com/google-ai-edge/mediapipe

### Smoothing Techniques
- One Euro Filter (adaptive smoothing): http://cristal.univ-lille.fr/~casiez/1euro/
- Lerp/Slerp explained: https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/a-brief-introduction-to-lerp-r4954/
- Kalman Filter basics: https://www.kalmanfilter.net/

### React Three Fiber / Three.js
- useFrame for render loops: https://r3f.docs.pmnd.rs/api/hooks#useframe
- Three.js Vector3.lerp: https://threejs.org/docs/#api/en/math/Vector3.lerp
- Three.js Quaternion.slerp: https://threejs.org/docs/#api/en/math/Quaternion.slerp

### Performance
- React refs vs state: https://react.dev/reference/react/useRef
- Avoiding re-renders: https://react.dev/learn/render-and-commit

## Summary

The key insight: **smooth the input data at the source**, not just the visuals. Use lerp for positions, lerp+normalize or slerp for directions, and average velocity over a history buffer. Store everything in refs for performance. Start with moderate smoothing factors and tune based on feel.
