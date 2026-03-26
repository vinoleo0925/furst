import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as faceapi from '@vladmandic/face-api';
import * as vision from '@mediapipe/tasks-vision';
import { extractIntent } from '../services/geminiService';
import 'regenerator-runtime/runtime';

// Type helper for vision tasks
const FaceLandmarker = (vision as any).FaceLandmarker;
const FilesetResolver = (vision as any).FilesetResolver;
const GestureRecognizer = (vision as any).GestureRecognizer;

// Suppress specific TensorFlow Lite / MediaPipe info logs to keep console clean
const originalInfo = console.info;
const originalLog = console.log;
const originalWarn = console.warn;
const originalDebug = console.debug;
const originalError = console.error;

const suppressTFLogs = (...args: any[]) => {
  for (const arg of args) {
    if (typeof arg === 'string' && arg.includes('Created TensorFlow Lite XNNPACK delegate')) {
      return true;
    }
  }
  return false;
};

console.info = (...args) => {
  if (!suppressTFLogs(...args)) originalInfo(...args);
};
console.log = (...args) => {
  if (!suppressTFLogs(...args)) originalLog(...args);
};
console.warn = (...args) => {
  if (!suppressTFLogs(...args)) originalWarn(...args);
};
console.debug = (...args) => {
  if (!suppressTFLogs(...args)) originalDebug(...args);
};
console.error = (...args) => {
  if (!suppressTFLogs(...args)) originalError(...args);
};

export type RecognitionState = {
  emotion: string | null;
  faceDetected: boolean;
  gesture: string | null;
  noiseLevel: number;
  isLoud: boolean;
  entering: boolean;
  exiting: boolean;
  objects: string[];
  approaching: boolean;
  movingAway: boolean;
  isLooking: boolean;
  gazeData: { left: { x: number; y: number }; right: { x: number; y: number } } | null;
  transcript: string;
  isListening: boolean;
  audioDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  intent: { text: string; timestamp: number };
  deepSceneDescription: string;
  faceSize: number;
  faceX: number;
  faceY: number;
  fastObject: { detected: boolean; x: number; y: number; speed: number } | null;
};

export interface RecognitionConfig {
  noiseThreshold: number;
}

export const useRecognition = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  config: RecognitionConfig = { noiseThreshold: 100 }
) => {
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<RecognitionState>({
    emotion: null,
    faceDetected: false,
    gesture: null,
    noiseLevel: 0,
    isLoud: false,
    entering: false,
    exiting: false,
    objects: [],
    approaching: false,
    movingAway: false,
    isLooking: false,
    gazeData: null,
    transcript: '',
    isListening: false,
    audioDevices: [],
    selectedAudioDevice: '',
    intent: { text: '未知', timestamp: 0 },
    deepSceneDescription: '',
    faceSize: 0,
    faceX: 0,
    faceY: 0,
    fastObject: null,
  });

  const speechRecognitionRef = useRef<any>(null);
  const lastDeepAnalysisTimeRef = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);

  const modelsRef = useRef<{
    objectDetector: cocoSsd.ObjectDetection | null;
    gestureRecognizer: any | null;
    faceLandmarker: any | null;
  }>({
    objectDetector: null,
    gestureRecognizer: null,
    faceLandmarker: null,
  });

  const audioRef = useRef<{
    audioCtx: AudioContext | null;
    analyser: AnalyserNode | null;
    dataArray: Uint8Array | null;
  }>({
    audioCtx: null,
    analyser: null,
    dataArray: null,
  });

  const historyRef = useRef({
    personArea: 0,
    personCount: 0,
    lastPersonX: 0,
    enteringUntil: 0,
    exitingUntil: 0,
    approachingUntil: 0,
    movingAwayUntil: 0,
    lastObjects: [] as Array<{ class: string, cx: number, cy: number, time: number }>,
  });

  const isDetectingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const performDeepAnalysis = useCallback(async (video: HTMLVideoElement, transcript: string) => {
    if (isAnalyzingRef.current) return;
    
    const now = Date.now();
    // 每 15 秒触发一次，或者在检测到人脸且距离上次分析超过 5 秒时触发
    if (now - lastDeepAnalysisTimeRef.current < 15000) return;

    isAnalyzingRef.current = true;
    lastDeepAnalysisTimeRef.current = now;

    try {
      // 捕获当前帧
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        const { analyzeScene } = await import('../services/geminiService');
        const description = await analyzeScene(base64Image, transcript);
        
        if (description) {
          setState(prev => ({ ...prev, deepSceneDescription: description }));
        }
      }
    } catch (err) {
      console.error("Failed to perform deep analysis:", err);
    } finally {
      isAnalyzingRef.current = false;
    }
  }, []);

  const initModels = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      console.log("Starting model initialization...");

      // Get audio devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setState(prev => ({ ...prev, audioDevices: audioInputs }));
        if (audioInputs.length > 0 && !state.selectedAudioDevice) {
          setState(prev => ({ ...prev, selectedAudioDevice: audioInputs[0].deviceId }));
        }
      } catch (e) {
        console.warn("Failed to get audio devices:", e);
      }

      // Initialize TF.js backend
      try {
        tf.enableProdMode();
        await tf.ready();
        console.log("TF.js ready");
      } catch (e) {
        console.error("TF.js initialization failed:", e);
        throw new Error("TensorFlow.js 初始化失败");
      }

      // Load Face API models
      // Try jsDelivr as it's often more reliable in various regions
      const MODEL_URL = 'https://cdn.jsdelivr.net/gh/vladmandic/face-api/model/';
      console.log("Loading Face-API models from:", MODEL_URL);
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        console.log("Face-API models loaded");
      } catch (e) {
        console.error("Face-API models failed to load:", e);
        // Fallback to original URL if jsDelivr fails
        const FALLBACK_URL = 'https://vladmandic.github.io/face-api/model/';
        console.log("Retrying Face-API models from fallback:", FALLBACK_URL);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(FALLBACK_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(FALLBACK_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(FALLBACK_URL),
        ]);
      }

      // Load COCO-SSD
      console.log("Loading COCO-SSD...");
      modelsRef.current.objectDetector = await cocoSsd.load();
      console.log("COCO-SSD loaded");

      // Load MediaPipe Gesture Recognizer
      console.log("Loading MediaPipe tasks...");
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.33/wasm"
      );
      
      modelsRef.current.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO"
      });
      console.log("Gesture Recognizer loaded");

      // Load MediaPipe Face Landmarker
      modelsRef.current.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputIrisLandmarks: true,
        runningMode: "VIDEO"
      });
      console.log("Face Landmarker loaded");

      setIsReady(true);
      return true;
    } catch (err: any) {
      console.error("Detailed model loading error:", err);
      setError(`模型加载失败: ${err.message || "网络连接错误 (Failed to fetch)"}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const startRecognition = async (audioDeviceId?: string): Promise<boolean> => {
    if (!videoRef.current) {
      setError("找不到视频组件");
      return false;
    }

    try {
      const constraints = {
        video: true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoRef.current.srcObject = stream;
      
      // Setup Audio for noise detection
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioRef.current = { audioCtx, analyser, dataArray };

      // Start Native Speech Recognition
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onstart = () => {
          console.log('ASR Started');
          setState(prev => ({ ...prev, isListening: true }));
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }

          const currentTranscript = finalTranscript || interimTranscript;
          
          if (currentTranscript) {
            console.log('ASR Result:', currentTranscript);
            setState(prev => ({ ...prev, transcript: currentTranscript }));
            
            // Clear transcript after 5 seconds of silence
            if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
            transcriptTimeoutRef.current = setTimeout(() => {
              setState(prev => ({ ...prev, transcript: '' }));
              transcriptTimeoutRef.current = null;
            }, 5000);
          }

          if (finalTranscript) {
            extractIntent(finalTranscript).then(intentText => {
              setState(prev => ({ ...prev, intent: { text: intentText, timestamp: Date.now() } }));
            });
          }
        };

        recognition.onerror = (event: any) => {
          console.error('ASR Error:', event.error);
          if (event.error === 'not-allowed') {
            setError('麦克风访问被拒绝，请检查权限设置');
          }
          if (event.error === 'network' || event.error === 'no-speech') {
            return;
          }
        };

        recognition.onend = () => {
          console.log('ASR Ended');
          setState(prev => ({ ...prev, isListening: false }));
          // Restart if we are still supposed to be listening
          if (videoRef.current && videoRef.current.srcObject) {
            try {
              recognition.start();
            } catch (e) {
              console.error("Failed to restart recognition", e);
            }
          }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
      } else {
        console.warn("Browser does not support native speech recognition.");
      }

      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error("Video play failed:", e));
        loop();
      };
      
      return true;
    } catch (err: any) {
      console.error("Failed to access camera/mic:", err);
      setError(`无法访问摄像头或麦克风: ${err.message}`);
      return false;
    }
  };

  const stopRecognition = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (audioRef.current.audioCtx) {
      audioRef.current.audioCtx.close();
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
  };

  const loop = async () => {
    if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

    const video = videoRef.current;
    const now = Date.now();

    // 1. Audio Processing (Fast, every frame)
    let avgNoise = 0;
    let isLoud = false;
    if (audioRef.current.analyser && audioRef.current.dataArray) {
      audioRef.current.analyser.getByteFrequencyData(audioRef.current.dataArray);
      let sum = 0;
      for (let i = 0; i < audioRef.current.dataArray.length; i++) {
        sum += audioRef.current.dataArray[i];
      }
      avgNoise = sum / audioRef.current.dataArray.length;
      isLoud = avgNoise > configRef.current.noiseThreshold; // Threshold for loud noise
    }

    // 2. Vision Processing (Throttled)
    if (!isDetectingRef.current && modelsRef.current.objectDetector && modelsRef.current.gestureRecognizer && modelsRef.current.faceLandmarker && video.readyState >= 2) {
      isDetectingRef.current = true;

      try {
        const [detections, predictions, faceLandmarksResult] = await Promise.all([
          faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions(),
          modelsRef.current.objectDetector.detect(video),
          modelsRef.current.faceLandmarker.detectForVideo(video, now)
        ]);

        const gestureResult = modelsRef.current.gestureRecognizer.recognizeForVideo(video, now);

        // Process Face & Emotion & Advanced Gaze
        let emotion = null;
        let isLooking = false;
        let faceSize = 0;
        let faceX = 0;
        let faceY = 0;

        if (detections.length > 0) {
          const det = detections[0];
          const expressions = det.expressions;
          emotion = Object.keys(expressions).reduce((a, b) => expressions[a as keyof typeof expressions] > expressions[b as keyof typeof expressions] ? a : b);

          const box = det.detection.box;
          faceSize = (box.width * box.height) / (video.videoWidth * video.videoHeight);
          faceX = ((box.x + box.width / 2) / video.videoWidth) * 2 - 1;
          faceY = ((box.y + box.height / 2) / video.videoHeight) * 2 - 1;
        }

        // Advanced Gaze Tracking using MediaPipe Iris Landmarks
        let gazeData = null;
        if (faceLandmarksResult.faceLandmarks && faceLandmarksResult.faceLandmarks.length > 0) {
          const landmarks = faceLandmarksResult.faceLandmarks[0];
          // MediaPipe Iris landmarks indices: Left Iris 468-472, Right Iris 473-477
          // Center of iris is 468 (left) and 473 (right)
          const leftIris = landmarks[468];
          const rightIris = landmarks[473];
          
          // Eye corners for relative position
          const leftEyeInner = landmarks[133];
          const leftEyeOuter = landmarks[33];
          const rightEyeInner = landmarks[362];
          const rightEyeOuter = landmarks[263];

          if (leftIris && rightIris) {
            // Calculate horizontal gaze (0.5 is center)
            const leftGazeX = (leftIris.x - leftEyeOuter.x) / (leftEyeInner.x - leftEyeOuter.x);
            const rightGazeX = (rightIris.x - rightEyeInner.x) / (rightEyeOuter.x - rightEyeInner.x);
            const avgGazeX = (leftGazeX + rightGazeX) / 2;

            // Calculate vertical gaze
            const leftEyeTop = landmarks[159];
            const leftEyeBottom = landmarks[145];
            const rightEyeTop = landmarks[386];
            const rightEyeBottom = landmarks[374];
            const leftGazeY = (leftIris.y - leftEyeTop.y) / (leftEyeBottom.y - leftEyeTop.y);
            const rightGazeY = (rightIris.y - rightEyeTop.y) / (rightEyeBottom.y - rightEyeTop.y);
            const avgGazeY = (leftGazeY + rightGazeY) / 2;

            gazeData = {
              left: { x: leftGazeX, y: leftGazeY },
              right: { x: rightGazeX, y: rightGazeY }
            };

            // Looking at camera if iris is roughly centered horizontally and vertically
            // Tightened threshold for better accuracy
            isLooking = avgGazeX > 0.42 && avgGazeX < 0.58 && avgGazeY > 0.4 && avgGazeY < 0.6;
          }
        }

        // Process Gesture
        let gesture = null;
        if (gestureResult.gestures.length > 0) {
          gesture = gestureResult.gestures[0][0].categoryName;
          if (gesture === 'None') gesture = null;
        }

        // Process Objects & Enter/Exit & Approach/Away
        const objects = predictions.map(p => p.class);
        const persons = predictions.filter(p => p.class === 'person');
        
        // Fast Object Tracking
        const currentObjects = predictions.map(p => {
          const cx = p.bbox[0] + p.bbox[2] / 2;
          const cy = p.bbox[1] + p.bbox[3] / 2;
          return { class: p.class, cx, cy, time: now, area: p.bbox[2] * p.bbox[3] };
        });

        let fastestObj = null;
        let maxSpeed = 0;

        for (const curr of currentObjects) {
          // Find matching object in last frame
          const prev = historyRef.current.lastObjects.find(p => p.class === curr.class);
          if (prev) {
            const dt = (curr.time - prev.time) / 1000; // seconds
            if (dt > 0 && dt < 0.5) { // Valid time delta
              const dx = (curr.cx - prev.cx) / video.videoWidth;
              const dy = (curr.cy - prev.cy) / video.videoHeight;
              const distance = Math.sqrt(dx*dx + dy*dy);
              const speed = distance / dt; // screen percentage per second
              
              // Threshold: moving > 20% of screen per second + area > 3%
              const areaPct = curr.area / (video.videoWidth * video.videoHeight);
              if (speed > 0.2 && areaPct > 0.03 && speed > maxSpeed) {
                maxSpeed = speed;
                fastestObj = curr;
              }
            }
          }
        }

        historyRef.current.lastObjects = currentObjects;

        let fastObjectState = null;
        if (fastestObj) {
          fastObjectState = {
            detected: true,
            x: (fastestObj.cx / video.videoWidth) * 2 - 1,
            y: (fastestObj.cy / video.videoHeight) * 2 - 1,
            speed: maxSpeed
          };
        }

        let entering = false;
        let exiting = false;
        let approaching = false;
        let movingAway = false;

        if (persons.length > 0) {
          const largestPerson = persons.reduce((prev, current) => {
            return (prev.bbox[2] * prev.bbox[3] > current.bbox[2] * current.bbox[3]) ? prev : current;
          });
          const area = largestPerson.bbox[2] * largestPerson.bbox[3];
          const centerX = largestPerson.bbox[0] + largestPerson.bbox[2] / 2;
          const videoWidth = video.videoWidth;

          if (historyRef.current.personArea > 0) {
            if (area > historyRef.current.personArea * 1.15) approaching = true;
            if (area < historyRef.current.personArea * 0.85) movingAway = true;
          }
          historyRef.current.personArea = area;

          if (historyRef.current.personCount === 0) {
            if (centerX < videoWidth * 0.3 || centerX > videoWidth * 0.7) {
              entering = true;
            }
          }
          historyRef.current.lastPersonX = centerX;
        } else {
          if (historyRef.current.personCount > 0) {
            const lastX = historyRef.current.lastPersonX;
            const videoWidth = video.videoWidth;
            if (lastX < videoWidth * 0.3 || lastX > videoWidth * 0.7) {
              exiting = true;
            }
          }
          historyRef.current.personArea = 0;
        }
        historyRef.current.personCount = persons.length;

        // Update transient states
        if (entering) historyRef.current.enteringUntil = now + 2000;
        if (exiting) historyRef.current.exitingUntil = now + 2000;
        if (approaching) historyRef.current.approachingUntil = now + 1500;
        if (movingAway) historyRef.current.movingAwayUntil = now + 1500;

        // Draw to Canvas
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw Object Bounding Boxes
            predictions.forEach(prediction => {
              const [x, y, width, height] = prediction.bbox;
              ctx.strokeStyle = '#00FF00';
              ctx.lineWidth = 2;
              ctx.strokeRect(x, y, width, height);
              
              ctx.fillStyle = '#00FF00';
              ctx.font = '16px Arial';
              ctx.fillText(
                `${prediction.class} (${Math.round(prediction.score * 100)}%)`, 
                x, 
                y > 20 ? y - 5 : 20
              );
            });

            // Draw Face Landmarks
            detections.forEach(det => {
              const box = det.detection.box;
              ctx.strokeStyle = '#FF0000';
              ctx.lineWidth = 2;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            });

            // Draw Eye/Iris Boxes (Very light color as requested)
            if (faceLandmarksResult.faceLandmarks && faceLandmarksResult.faceLandmarks.length > 0) {
              const landmarks = faceLandmarksResult.faceLandmarks[0];
              const irisIndices = [468, 473]; // Left and Right iris centers
              
              irisIndices.forEach(idx => {
                const iris = landmarks[idx];
                if (iris) {
                  const px = iris.x * canvas.width;
                  const py = iris.y * canvas.height;
                  
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.lineWidth = 1;
                  // Draw a small box around the iris
                  ctx.strokeRect(px - 10, py - 10, 20, 20);
                  
                  // Draw a dot at the center
                  ctx.fillStyle = isLooking ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)';
                  ctx.beginPath();
                  ctx.arc(px, py, 2, 0, Math.PI * 2);
                  ctx.fill();
                }
              });
            }
          }
        }

        // Deep Analysis Trigger
        if (detections.length > 0 || persons.length > 0) {
          performDeepAnalysis(video, state.transcript);
        }

        setState(prev => ({
          ...prev,
          emotion,
          faceDetected: detections.length > 0,
          gesture,
          noiseLevel: avgNoise,
          isLoud,
          entering: now < historyRef.current.enteringUntil,
          exiting: now < historyRef.current.exitingUntil,
          objects: Array.from(new Set(objects)),
          approaching: now < historyRef.current.approachingUntil,
          movingAway: now < historyRef.current.movingAwayUntil,
          isLooking,
          gazeData,
          faceSize,
          faceX,
          faceY,
          fastObject: fastObjectState,
        }));

      } catch (err) {
        console.error("Detection error:", err);
      } finally {
        isDetectingRef.current = false;
      }
    } else {
      // Just update audio state if vision is busy
      setState(prev => ({
        ...prev,
        noiseLevel: avgNoise,
        isLoud,
        entering: now < historyRef.current.enteringUntil,
        exiting: now < historyRef.current.exitingUntil,
        approaching: now < historyRef.current.approachingUntil,
        movingAway: now < historyRef.current.movingAwayUntil,
      }));
    }

    animationFrameRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    return () => {
      stopRecognition();
    };
  }, []);

  const setSelectedAudioDevice = (deviceId: string) => {
    setState(prev => ({ ...prev, selectedAudioDevice: deviceId }));
  };

  return {
    isReady,
    isLoading,
    error,
    state,
    initModels,
    startRecognition,
    stopRecognition,
    setSelectedAudioDevice,
  };
};
