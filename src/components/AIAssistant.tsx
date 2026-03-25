import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Video, Camera, Volume2, Loader2, Send } from 'lucide-react';
import { analyzeVideo, quickSceneDescription, chatWithAI, generateSpeech } from '../services/geminiService';

interface AIAssistantProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPlaying: boolean;
  intent?: { text: string; timestamp: number };
}

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  text: string;
  isAudioLoading?: boolean;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ videoRef, isPlaying, intent }) => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: '你好！我是你的 AI 助手。我可以帮你分析当前画面，或者回答你的问题。' }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Automatically print NLU intent when it changes
  useEffect(() => {
    if (intent && intent.text !== '未知' && intent.timestamp > 0) {
      addMessage('system', `[NLU 意图识别]: ${intent.text}`);
    }
  }, [intent?.timestamp]);

  const addMessage = (role: 'user' | 'ai' | 'system', text: string) => {
    const newMsg: Message = { id: Date.now().toString() + Math.random(), role, text };
    setMessages(prev => [...prev, newMsg]);
    return newMsg.id;
  };

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg));
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const userText = input;
    setInput('');
    addMessage('user', userText);
    
    setIsProcessing(true);
    try {
      const response = await chatWithAI(userText);
      if (response) addMessage('ai', response);
    } catch (error) {
      addMessage('ai', '抱歉，处理您的请求时出错了。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickScene = async () => {
    if (!videoRef.current || !isPlaying || isProcessing) return;
    
    setIsProcessing(true);
    addMessage('user', '请快速描述一下当前画面。');
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg').split(',')[1];
      
      const response = await quickSceneDescription(base64Image, '请用简短的一两句话描述这幅画面里有什么。');
      if (response) addMessage('ai', response);
    } catch (error) {
      addMessage('ai', '抱歉，无法获取或分析画面。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAnalyzeVideo = async () => {
    if (!videoRef.current || !videoRef.current.srcObject || !isPlaying || isProcessing) return;
    
    setIsProcessing(true);
    addMessage('user', '请录制一段3秒的视频并进行详细分析。');
    
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      const videoPromise = new Promise<{base64: string, mimeType: string}>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            resolve({ base64: base64data, mimeType: 'video/webm' });
          };
          reader.onerror = reject;
        };
      });
      
      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 3000); // Record 3 seconds
      
      const { base64, mimeType } = await videoPromise;
      const response = await analyzeVideo(base64, mimeType, '请详细分析这段视频中发生了什么，包括人物的动作、环境的变化等。');
      if (response) addMessage('ai', response);
    } catch (error) {
      console.error(error);
      addMessage('ai', '抱歉，视频录制或分析失败。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayAudio = async (messageId: string, text: string) => {
    updateMessage(messageId, { isAudioLoading: true });
    try {
      const audioBase64 = await generateSpeech(text);
      if (audioBase64) {
        const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
        audio.play();
      }
    } catch (error) {
      console.error("Failed to play audio", error);
    } finally {
      updateMessage(messageId, { isAudioLoading: false });
    }
  };

  return (
    <div className="flex flex-col bg-white rounded-3xl border border-gray-200 shadow-sm h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
        <MessageSquare className="text-blue-600" size={20} />
        <h2 className="font-semibold text-gray-900">AI 智能助手</h2>
      </div>

      {/* Action Buttons */}
      <div className="p-3 flex gap-2 border-b border-gray-100 overflow-x-auto">
        <button
          onClick={handleQuickScene}
          disabled={!isPlaying || isProcessing}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <Camera size={16} />
          快速看一眼
        </button>
        <button
          onClick={handleAnalyzeVideo}
          disabled={!isPlaying || isProcessing}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          <Video size={16} />
          录制3秒分析
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
          >
            {msg.role === 'system' ? (
              <div className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
                {msg.text}
              </div>
            ) : (
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                
                {msg.role === 'ai' && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => handlePlayAudio(msg.id, msg.text)}
                      disabled={msg.isAudioLoading}
                      className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                      title="朗读"
                    >
                      {msg.isAudioLoading ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        ))}
        {isProcessing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">AI 正在思考...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-100 bg-white">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问我任何问题..."
            disabled={isProcessing}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
