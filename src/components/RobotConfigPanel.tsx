import React, { useState, useEffect } from 'react';
import { RobotConfig, defaultRobotConfig } from '../config/robotConfig';
import { Settings, Save, RefreshCw, Volume2, Mic, PlayCircle } from 'lucide-react';
import { TTSEngine } from '../hooks/useRobotBehavior';

interface RobotConfigPanelProps {
  config: RobotConfig;
  onConfigChange: (newConfig: RobotConfig) => void;
  ttsEngine: TTSEngine;
  onTtsEngineChange: (engine: TTSEngine) => void;
  voiceId: string;
  onVoiceIdChange: (voiceId: string) => void;
  audioDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
}

export const RobotConfigPanel: React.FC<RobotConfigPanelProps> = ({ 
  config, onConfigChange, ttsEngine, onTtsEngineChange, voiceId, onVoiceIdChange,
  audioDevices, selectedAudioDevice, onAudioDeviceChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [jsonStr, setJsonStr] = useState(JSON.stringify(config, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);

  useEffect(() => {
    const loadVoices = () => {
      setBrowserVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonStr);
      onConfigChange(parsed);
      setError(null);
      setIsOpen(false);
    } catch (e: any) {
      setError('JSON 格式错误: ' + e.message);
    }
  };

  const handleReset = () => {
    const defaultStr = JSON.stringify(defaultRobotConfig, null, 2);
    setJsonStr(defaultStr);
    onConfigChange(defaultRobotConfig);
    setError(null);
  };

  const handleTestVoice = () => {
    if (ttsEngine === 'edge') {
      // Test Edge TTS
      import('../services/edgeTtsService').then(({ generateEdgeTTS }) => {
        generateEdgeTTS("您好，我是您的多模态助手。这是我的测试语音。", voiceId || 'zh-CN-XiaoxiaoNeural')
          .then(buffer => {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            ctx.decodeAudioData(buffer).then(audioBuffer => {
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start();
            });
          })
          .catch(console.error);
      });
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance("您好，我是您的多模态助手。这是我的测试语音。");
    utterance.lang = 'zh-CN';
    utterance.rate = voiceSpeed;
    
    if (voiceId) {
      const voices = synth.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voiceId || v.name === voiceId);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      }
    }
    synth.speak(utterance);
  };

  const geminiVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
  const edgeVoices = [
    { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (温柔女声)' },
    { id: 'zh-CN-YunxiNeural', name: '云希 (阳光男声)' },
    { id: 'zh-CN-YunjianNeural', name: '云健 (成熟男声)' },
    { id: 'zh-CN-XiaoyiNeural', name: '晓伊 (可爱童声)' },
    { id: 'zh-CN-YunxiaNeural', name: '云夏 (活泼男童)' }
  ];

  return (
    <div className="w-full max-w-[1600px] mx-auto mb-8">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Settings size={20} className="text-gray-500" />
            <span>机器人行为与语音配置</span>
          </div>
          <span className="text-sm text-blue-600 hover:underline">
            {isOpen ? '收起' : '展开编辑'}
          </span>
        </div>

        {isOpen && (
          <div className="mt-6 flex flex-col gap-6">
            {/* Audio Input Settings */}
            <div className="flex flex-col gap-3 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Mic size={18} className="text-green-500" />
                <h3>音频输入 (ASR) 设置</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">选择麦克风 (支持蓝牙耳机)</label>
                  <select 
                    value={selectedAudioDevice}
                    onChange={(e) => onAudioDeviceChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {audioDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 flex items-end">
                  <p className="text-xs text-gray-400 italic">
                    * ASR 运行在浏览器端侧，确保您的隐私。连接蓝牙耳机后请在此处选择。
                  </p>
                </div>
              </div>
            </div>

            {/* Voice Settings */}
            <div className="flex flex-col gap-3 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-700 font-medium">
                <Volume2 size={18} className="text-blue-500" />
                <h3>语音 (TTS) 设置</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">TTS 引擎</label>
                  <select 
                    value={ttsEngine}
                    onChange={(e) => {
                      onTtsEngineChange(e.target.value as TTSEngine);
                      onVoiceIdChange(''); // Reset voice when engine changes
                    }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="edge">Edge TTS (高质量开源, 推荐)</option>
                    <option value="browser">浏览器原生 TTS (本地运行, 响应快)</option>
                    <option value="gemini">Gemini TTS (云端生成, 更自然)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">选择音色 (支持热切换)</label>
                  <div className="flex gap-2">
                    <select 
                      value={voiceId}
                      onChange={(e) => onVoiceIdChange(e.target.value)}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">默认音色</option>
                      {ttsEngine === 'edge' ? (
                        edgeVoices.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))
                      ) : ttsEngine === 'browser' ? (
                        browserVoices.map(v => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {v.name} ({v.lang})
                          </option>
                        ))
                      ) : (
                        geminiVoices.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))
                      )}
                    </select>
                    <button 
                      onClick={handleTestVoice}
                      className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="测试音色"
                    >
                      <PlayCircle size={20} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-2">
                <div className="flex-1">
                  <label className="block text-sm text-gray-500 mb-1">语速: <span className="font-mono">{voiceSpeed.toFixed(1)}</span></label>
                  <input 
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceSpeed}
                    onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
                <div className="flex-1"></div>
              </div>
            </div>

            {/* JSON Config */}
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500">
                您可以在这里自定义机器人在不同场景下的表情、动作和语音回复。
              </p>
              <textarea
                value={jsonStr}
                onChange={(e) => setJsonStr(e.target.value)}
                className="w-full h-64 p-4 font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                spellCheck={false}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={16} />恢复默认
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Save size={16} />保存配置
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
