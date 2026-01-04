import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Vector3 } from 'three';

interface HandTrackerProps {
  onHandsUpdate: (
      left: Vector3 | null, 
      right: Vector3 | null, 
      leftDir: Vector3 | null, 
      rightDir: Vector3 | null
  ) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onHandsUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2
        });

        startCamera();
      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
      }
    };

    const startCamera = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: 640,
              height: 480,
              frameRate: { ideal: 60 }
            }
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.addEventListener('loadeddata', predictWebcam);
            setLoaded(true);
          }
        } catch (error) {
          console.error("Error accessing camera:", error);
        }
      }
    };

    const mapToWorld = (landmark: {x: number, y: number, z: number}) => {
        // Tune these scale factors to match the 3D scene
        // Mirror X axis: (0.5 - landmark.x) ensures that if hand is on left of raw feed (physical right), 
        // it maps to positive X (world right), matching the CSS mirrored visual.
        const x = (0.5 - landmark.x) * 8; 
        const y = (0.5 - landmark.y) * 6 + 1.0; 
        const z = landmark.z * -8; 
        return new Vector3(x, y, z);
    };

    const predictWebcam = () => {
      if (videoRef.current && handLandmarker) {
        if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            const startTimeMs = performance.now();
            const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

            let leftHand: Vector3 | null = null;
            let rightHand: Vector3 | null = null;
            let leftDir: Vector3 | null = null;
            let rightDir: Vector3 | null = null;

            // --- Visualization Logic ---
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            
            if (canvas && ctx) {
                // Ensure canvas resolution matches video for accurate coordinate mapping
                if (canvas.width !== videoRef.current.videoWidth) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                }
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.lineWidth = 3;
            }

            if (results.landmarks && results.handedness) {
                for (let i = 0; i < results.handedness.length; i++) {
                    const handInfo = results.handedness[i][0];
                    const landmarks = results.landmarks[i];

                    // Landmark 0: Wrist
                    // Landmark 9: Middle Finger MCP (Knuckle)
                    
                    const wrist = mapToWorld(landmarks[0]);
                    const knuckle = mapToWorld(landmarks[9]);
                    
                    const direction = new Vector3().subVectors(knuckle, wrist).normalize();
                    
                    if (handInfo.displayName === "Left") {
                        leftHand = wrist;
                        leftDir = direction;
                    } else {
                        rightHand = wrist;
                        rightDir = direction;
                    }

                    // Draw on Canvas
                    if (canvas && ctx) {
                        const wX = landmarks[0].x * canvas.width;
                        const wY = landmarks[0].y * canvas.height;
                        const kX = landmarks[9].x * canvas.width;
                        const kY = landmarks[9].y * canvas.height;

                        const color = handInfo.displayName === "Left" ? '#00FFFF' : '#FFA500'; // Cyan for Left, Orange for Right

                        // Draw Line
                        ctx.beginPath();
                        ctx.moveTo(wX, wY);
                        ctx.lineTo(kX, kY);
                        ctx.strokeStyle = color;
                        ctx.stroke();

                        // Draw Wrist
                        ctx.beginPath();
                        ctx.arc(wX, wY, 5, 0, 2 * Math.PI);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fill();

                        // Draw Knuckle
                        ctx.beginPath();
                        ctx.arc(kX, kY, 3, 0, 2 * Math.PI);
                        ctx.fillStyle = color;
                        ctx.fill();
                    }
                }
            }
            onHandsUpdate(leftHand, rightHand, leftDir, rightDir);
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      cancelAnimationFrame(animationFrameId);
      if (handLandmarker) handLandmarker.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute top-4 right-4 w-48 h-36 border-2 border-cyan-500 rounded-lg overflow-hidden z-50 opacity-80 bg-black shadow-[0_0_15px_rgba(0,255,255,0.3)]">
        {!loaded && <div className="absolute inset-0 flex items-center justify-center text-xs text-cyan-500 animate-pulse">Init Camera...</div>}
        
        <div className="relative w-full h-full">
            <video 
                ref={videoRef} 
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
                autoPlay 
                playsInline 
                muted
            />
            <canvas 
                ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
            />
        </div>

        <div className="absolute bottom-0 w-full bg-black/60 text-[10px] text-center text-cyan-100 py-1 pointer-events-none backdrop-blur-sm">
            TRACKING ACTIVE
        </div>
    </div>
  );
};

export default HandTracker;