import React, { useRef, useState } from 'react';
import { useRecognition } from './hooks/useRecognition';
import { useRobotBehavior, TTSEngine } from './hooks/useRobotBehavior';
import { defaultRobotConfig } from './config/robotConfig';
import { Dashboard } from './components/Dashboard';
import { AIAssistant } from './components/AIAssistant';
import { RobotAvatar } from './components/RobotAvatar';
import { RobotConfigPanel } from './components/RobotConfigPanel';
import { motion } from 'motion/react';
import { Play, Square, Loader2, AlertCircle, Settings } from 'lucide-react';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [noiseThreshold, setNoiseThreshold] = useState(100);
  const [robotConfig, setRobotConfig] = useState(defaultRobotConfig);
  const [ttsEngine, setTtsEngine] = useState<TTSEngine>('browser');
  const [voiceId, setVoiceId] = useState<string>('');
  
  const { isReady, isLoading, error, state, initModels, startRecognition, stopRecognition, setSelectedAudioDevice } = useRecognition(videoRef, canvasRef, { noiseThreshold });
  const { reaction, isSpeaking, audioLevel } = useRobotBehavior(state, robotConfig, ttsEngine, voiceId);
  
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handleStart = async () => {
    let ready = isReady;
    if (!ready) {
      ready = await initModels();
    }
    if (ready) {
      const started = await startRecognition(state.selectedAudioDevice);
      if (started) {
        setIsPlaying(true);
      }
    }
  };

  const handleStop = () => {
    stopRecognition();
    setIsPlaying(false);
  };

  const handleAudioDeviceChange = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    if (isPlaying) {
      // Restart recognition with new device
      stopRecognition();
      await startRecognition(deviceId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 font-sans">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">多模态场景识别系统</h1>
        <p className="text-gray-500">基于本地摄像头和麦克风的实时 AI 识别</p>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 max-w-[1600px] w-full">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      <div className="w-full max-w-[1600px] flex flex-col xl:flex-row gap-4 mb-4">
        {/* Left Column: Video, Controls & Dashboard */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Video Container */}
          <div className="w-full bg-black rounded-3xl overflow-hidden relative shadow-lg aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
              muted
              playsInline
              autoPlay
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
            />
            
            {!isPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 backdrop-blur-sm">
                  <Play size={32} className="ml-1" />
                </div>
                <p>点击下方按钮开始识别</p>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white z-10">
                <Loader2 size={48} className="animate-spin mb-4 text-blue-500" />
                <p className="text-lg font-medium">正在加载 AI 模型...</p>
                <p className="text-sm text-gray-400 mt-2">首次加载可能需要一些时间</p>
              </div>
            )}

            {/* Real-time Transcript Subtitle */}
            {isPlaying && (
              <>
                {state.isListening && (
                  <div className="absolute top-6 left-6 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-white/80 font-mono uppercase tracking-wider">ASR Listening</span>
                  </div>
                )}
                {state.transcript && (
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-6 py-3 rounded-2xl max-w-[80%] text-center text-lg font-medium backdrop-blur-md shadow-lg transition-all line-clamp-2">
                    {state.transcript.length > 100 ? '...' + state.transcript.slice(-100) : state.transcript}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls & Tuning Panel */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 w-full">
              <div className="flex items-center gap-2 text-gray-700 font-medium min-w-max">
                <Settings size={18} className="text-gray-500" />
                <span className="text-sm">高分贝阈值: <span className="font-mono text-gray-900">{noiseThreshold}</span></span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                step="5"
                value={noiseThreshold}
                onChange={(e) => setNoiseThreshold(Number(e.target.value))}
                className="w-full max-w-[200px] h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            
            <div className="w-full sm:w-auto shrink-0">
              {!isPlaying ? (
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full sm:w-32 py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                  {isLoading ? '加载中' : '开始识别'}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="w-full sm:w-32 py-2 px-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Square size={16} />
                  停止识别
                </button>
              )}
            </div>
          </div>

          {/* Dashboard */}
          <Dashboard state={state} />
        </div>

        {/* Right Column: AI Assistant & Robot */}
        <div className="w-full xl:w-[380px] flex-shrink-0 flex flex-col gap-4">
          <div className="h-64 xl:h-72">
            <RobotAvatar reaction={reaction} isSpeaking={isSpeaking} faceX={state.faceX} faceY={state.faceY} audioLevel={audioLevel} />
          </div>
          <div className="flex-1 min-h-[400px]">
            <AIAssistant videoRef={videoRef} isPlaying={isPlaying} intent={state.intent} />
          </div>
        </div>
      </div>

      {/* Parameter Tuning Panel */}
      <RobotConfigPanel 
        config={robotConfig} 
        onConfigChange={setRobotConfig} 
        ttsEngine={ttsEngine}
        onTtsEngineChange={setTtsEngine}
        voiceId={voiceId}
        onVoiceIdChange={setVoiceId}
        audioDevices={state.audioDevices}
        selectedAudioDevice={state.selectedAudioDevice}
        onAudioDeviceChange={handleAudioDeviceChange}
      />
    </div>
  );
}
