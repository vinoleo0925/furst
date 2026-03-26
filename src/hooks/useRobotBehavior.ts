import { useState, useEffect, useRef } from 'react';
import { RecognitionState } from './useRecognition';
import { RobotConfig, RobotReaction } from '../config/robotConfig';
import { generateSpeech } from '../services/geminiService';
import { generateEdgeTTS } from '../services/edgeTtsService';

export type TTSEngine = 'browser' | 'gemini' | 'edge';

export const useRobotBehavior = (
  state: RecognitionState, 
  config: RobotConfig,
  ttsEngine: TTSEngine = 'browser',
  voiceId: string = ''
) => {
  const [reaction, setReaction] = useState<RobotReaction>(config.events.idle);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [mood, setMood] = useState<string>('neutral');
  
  const gazeStartTimeRef = useRef<number>(0);
  const lastGazeTriggerRef = useRef<number>(0);
  const userPresentStartTimeRef = useRef<number>(0);
  const lastInteractionTimeRef = useRef<number>(Date.now());
  
  const lastReactionTimeRef = useRef<number>(0);
  const currentPriorityRef = useRef<number>(0);
  const lastEventKeyRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  const synth = window.speechSynthesis;

  const playBrowserTTS = (text: string) => {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    
    // Get voices and find the selected one
    const voices = synth.getVoices();
    if (voiceId) {
      const selectedVoice = voices.find(v => v.voiceURI === voiceId || v.name === voiceId);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
    } else {
      // Default to a Chinese voice if available
      const chineseVoice = voices.find(v => v.lang.includes('zh'));
      if (chineseVoice) utterance.voice = chineseVoice;
    }
    
    // Fake audio level for browser TTS
    let fakeAudioInterval: number;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      fakeAudioInterval = window.setInterval(() => {
        setAudioLevel(Math.random() * 0.5 + 0.2);
      }, 100);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      clearInterval(fakeAudioInterval);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setAudioLevel(0);
      clearInterval(fakeAudioInterval);
    };
    synth.speak(utterance);
  };

  const playGeminiTTS = async (text: string) => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsSpeaking(true);
    try {
      const audioBase64 = await generateSpeech(text, voiceId || 'Kore');
      if (audioBase64) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
        }
        const ctx = audioContextRef.current;
        const analyser = analyserRef.current!;
        
        const binaryString = window.atob(audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }
        
        const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setAudioLevel(average / 255); // Normalize to 0-1
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };
        
        source.onended = () => {
          setIsSpeaking(false);
          setAudioLevel(0);
          cancelAnimationFrame(animationFrameRef.current);
        };
        source.start();
        updateAudioLevel();
        
        audioSourceRef.current = source;
      } else {
        setIsSpeaking(false);
      }
    } catch (error: any) {
      if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Gemini TTS quota exceeded, falling back to browser TTS.");
      } else {
        console.error("Gemini TTS failed", error);
      }
      setIsSpeaking(false);
      playBrowserTTS(text);
    }
  };

  const playEdgeTTS = async (text: string) => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    setIsSpeaking(true);
    try {
      const audioBufferData = await generateEdgeTTS(text, voiceId || 'zh-CN-XiaoxiaoNeural');
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
      }
      const ctx = audioContextRef.current;
      const analyser = analyserRef.current!;
      
      const audioBuffer = await ctx.decodeAudioData(audioBufferData);
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioLevel(average / 255); // Normalize to 0-1
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      
      source.onended = () => {
        setIsSpeaking(false);
        setAudioLevel(0);
        cancelAnimationFrame(animationFrameRef.current);
      };
      source.start();
      updateAudioLevel();
      
      audioSourceRef.current = source;
    } catch (error) {
      console.error("Edge TTS failed", error);
      setIsSpeaking(false);
      playBrowserTTS(text);
    }
  };

  const triggerReaction = (newReaction: RobotReaction, priority: number) => {
    lastReactionTimeRef.current = Date.now();
    lastInteractionTimeRef.current = Date.now();
    currentPriorityRef.current = priority;
    
    // Update mood based on the reaction's expression
    if (newReaction.expression !== 'neutral' && newReaction.expression !== 'sleepy' && newReaction.expression !== 'confused') {
      setMood(newReaction.expression);
    }

    // Handle TTS array (random selection)
    let ttsText = '';
    if (Array.isArray(newReaction.tts)) {
      if (newReaction.tts.length > 0) {
        ttsText = newReaction.tts[Math.floor(Math.random() * newReaction.tts.length)];
      }
    } else {
      ttsText = newReaction.tts;
    }

    const finalReaction = { ...newReaction, tts: ttsText };
    setReaction(finalReaction);
    
    const trimmedTts = ttsText.trim();
    if (trimmedTts) {
      if (ttsEngine === 'gemini') {
        playGeminiTTS(trimmedTts);
      } else if (ttsEngine === 'edge') {
        playEdgeTTS(trimmedTts);
      } else {
        playBrowserTTS(trimmedTts);
      }
    }
  };

  // Handle Deep Scene Analysis (L2 Cascade)
  useEffect(() => {
    if (state.deepSceneDescription && !isSpeaking) {
      const now = Date.now();
      // Only react to deep analysis if we haven't had a high-priority reaction recently
      if (now - lastReactionTimeRef.current > 3000) {
        const deepReaction: RobotReaction = {
          expression: 'happy',
          action: '观察环境',
          tts: `我看到${state.deepSceneDescription}`
        };
        triggerReaction(deepReaction, 0.8);
      }
    }
  }, [state.deepSceneDescription]);

  useEffect(() => {
    const now = Date.now();
    const timeSinceLast = now - lastReactionTimeRef.current;
    
    // Global Cooldown: 8 seconds after any active interaction
    const isGlobalCooldown = timeSinceLast < 8000 && currentPriorityRef.current > 0 && currentPriorityRef.current < 4;

    // Priority decay: after 5 seconds, reset priority to 0 so new events can trigger
    if (timeSinceLast > 5000) {
      currentPriorityRef.current = 0;
    }

    let desiredReaction: RobotReaction | null = null;
    let desiredPriority = 0;
    let eventKey = '';

    // 1. Loud Noise Priority (P0 = 4)
    if (state.isLoud) {
      desiredReaction = config.events.loud_noise;
      desiredPriority = 4;
      eventKey = 'loud';
    } 
    // 2. Gesture Priority (P1 = 3)
    else if (state.gesture && !isGlobalCooldown) {
      const gestureReaction = config.gestures[state.gesture];
      if (gestureReaction) {
        desiredReaction = gestureReaction;
        desiredPriority = 3;
        eventKey = `gesture_${state.gesture}`;
      }
    } 
    // 3. Emotion Priority (P2 = 2)
    else if (state.emotion && state.emotion !== 'neutral' && !isGlobalCooldown) {
      const emotionReaction = config.emotions[state.emotion];
      if (emotionReaction) {
        desiredReaction = emotionReaction;
        desiredPriority = 2;
        eventKey = `emotion_${state.emotion}`;
      }
    } 
    // 4. Gaze & Attention Logic (P2 = 1)
    else if (state.isLooking && state.faceSize > 0.05 && !isGlobalCooldown) {
      if (gazeStartTimeRef.current === 0) {
        gazeStartTimeRef.current = now;
        lastGazeTriggerRef.current = 0;
      }
      
      const gazeDuration = (now - gazeStartTimeRef.current) / 1000;
      
      if (state.transcript || state.isLoud) {
        gazeStartTimeRef.current = now;
        lastGazeTriggerRef.current = 0;
        lastInteractionTimeRef.current = now;
      } else {
        if (gazeDuration >= 60 && lastGazeTriggerRef.current < 60) {
          desiredReaction = config.events.gaze_60s;
          desiredPriority = 1;
          eventKey = 'gaze_60s';
          lastGazeTriggerRef.current = 60;
        } else if (gazeDuration >= 30 && lastGazeTriggerRef.current < 30) {
          desiredReaction = config.events.gaze_30s;
          desiredPriority = 1;
          eventKey = 'gaze_30s';
          lastGazeTriggerRef.current = 30;
        } else if (gazeDuration >= 15 && lastGazeTriggerRef.current < 15) {
          desiredReaction = config.events.gaze_15s;
          desiredPriority = 1;
          eventKey = 'gaze_15s';
          lastGazeTriggerRef.current = 15;
        } else if (gazeDuration >= 3 && lastGazeTriggerRef.current < 3) {
          desiredReaction = config.events.gaze_5s;
          desiredPriority = 1;
          eventKey = 'gaze_5s';
          lastGazeTriggerRef.current = 3;
        }
      }
    } else {
      gazeStartTimeRef.current = 0;
      lastGazeTriggerRef.current = 0;
    }

    // 5. Dynamic Object Tracking (P3 = 0.8)
    if (state.fastObject?.detected && !desiredReaction && !isGlobalCooldown) {
      desiredReaction = { expression: 'surprised', action: '跟踪物体', tts: '' };
      desiredPriority = 0.8;
      eventKey = 'fast_object';
    } else if (state.objects.length > 0 && !desiredReaction && !isGlobalCooldown) {
      if (state.approaching || state.movingAway) {
        desiredReaction = { expression: 'neutral', action: '观察环境', tts: '' };
        desiredPriority = 0.8;
        eventKey = 'motion_tracking';
      }
    }

    // 6. Proactive Behavior (P3 = 0.5)
    if (state.faceDetected && state.faceSize > 0.05 && !isGlobalCooldown) {
      if (userPresentStartTimeRef.current === 0) {
        userPresentStartTimeRef.current = now;
      }
      const timeSinceInteraction = now - lastInteractionTimeRef.current;
      
      // If user is present but no interaction for 30 seconds, trigger proactive event
      if (timeSinceInteraction > 30000 && !desiredReaction && currentPriorityRef.current === 0) {
        desiredReaction = config.events.proactive_bored;
        desiredPriority = 0.5;
        eventKey = 'proactive_bored';
        lastInteractionTimeRef.current = now; // Reset to avoid spamming
      }
    } else {
      userPresentStartTimeRef.current = 0;
    }

    // Arbitration Logic
    if (desiredReaction) {
      const isHigherPriority = desiredPriority > currentPriorityRef.current;
      const isDifferentEvent = eventKey !== lastEventKeyRef.current;
      const isCooldownOver = timeSinceLast > 3000; // 3 seconds cooldown for same/lower priority
      
      // Trigger if it's a higher priority, OR if it's a different event and cooldown is over, OR if the priority has decayed
      if (isHigherPriority || (isDifferentEvent && isCooldownOver) || timeSinceLast > 5000) {
        triggerReaction(desiredReaction, desiredPriority);
        lastEventKeyRef.current = eventKey;
      }
    }

    // Return to idle if nothing has happened for a while (10 seconds)
    if (timeSinceLast > 10000 && reaction !== config.events.idle) {
      // Mood decay: after 30 seconds of no interaction, return to neutral mood
      if (now - lastInteractionTimeRef.current > 30000) {
        setMood('neutral');
        setReaction(config.events.idle);
      } else {
        // Keep the current mood but return to idle action
        setReaction({
          ...config.events.idle,
          expression: mood,
        });
      }
      currentPriorityRef.current = 0;
      lastEventKeyRef.current = '';
    }

  }, [state, config, ttsEngine, voiceId, mood]);

  return { reaction, isSpeaking, audioLevel };
};
