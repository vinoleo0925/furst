import React from 'react';
import { motion } from 'motion/react';
import { Smile, User, Hand, Volume2, LogIn, LogOut, Box, MoveRight, MoveLeft, Eye, Mic, MessageSquareText, Sparkles } from 'lucide-react';
import { RecognitionState } from '../hooks/useRecognition';

interface DashboardProps {
  state: RecognitionState;
}

const colorMap = {
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    text: 'text-blue-700'
  },
  green: {
    border: 'border-green-500',
    bg: 'bg-green-50',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600',
    text: 'text-green-700'
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600',
    text: 'text-purple-700'
  },
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    text: 'text-red-700'
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    text: 'text-orange-700'
  },
  teal: {
    border: 'border-teal-500',
    bg: 'bg-teal-50',
    iconBg: 'bg-teal-100',
    iconText: 'text-teal-600',
    text: 'text-teal-700'
  },
  indigo: {
    border: 'border-indigo-500',
    bg: 'bg-indigo-50',
    iconBg: 'bg-indigo-100',
    iconText: 'text-indigo-600',
    text: 'text-indigo-700'
  },
  pink: {
    border: 'border-pink-500',
    bg: 'bg-pink-50',
    iconBg: 'bg-pink-100',
    iconText: 'text-pink-600',
    text: 'text-pink-700'
  },
  cyan: {
    border: 'border-cyan-500',
    bg: 'bg-cyan-50',
    iconBg: 'bg-cyan-100',
    iconText: 'text-cyan-600',
    text: 'text-cyan-700'
  },
  amber: {
    border: 'border-amber-500',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    text: 'text-amber-700'
  },
  violet: {
    border: 'border-violet-500',
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
    text: 'text-violet-700'
  }
};

const Card = ({ title, icon, active, value, color }: { title: string, icon: React.ReactNode, active: boolean, value: string, color: keyof typeof colorMap }) => {
  const styles = colorMap[color];
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`p-2 rounded-xl border ${active ? `${styles.border} ${styles.bg}` : 'border-gray-200 bg-white'} shadow-sm transition-colors duration-300 flex flex-col items-center justify-center text-center gap-1`}
    >
      <div className={`p-2 rounded-full ${active ? `${styles.iconBg} ${styles.iconText}` : 'bg-gray-100 text-gray-400'}`}>
        {icon}
      </div>
      <h3 className="text-xs font-medium text-gray-500">{title}</h3>
      <p className={`text-sm font-semibold ${active ? styles.text : 'text-gray-900'} line-clamp-1`} title={value}>
        {value}
      </p>
    </motion.div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 w-full">
      <Card
        title="语音识别 (ASR)"
        icon={<Mic size={18} />}
        active={!!state.transcript}
        value={state.transcript || 'Listening...'}
        color="cyan"
      />
      <Card
        title="意图提取 (NLU)"
        icon={<MessageSquareText size={18} />}
        active={state.intent.text !== '未知'}
        value={state.intent.text}
        color="amber"
      />
      <Card
        title="情绪识别"
        icon={<Smile size={18} />}
        active={!!state.emotion}
        value={state.emotion ? state.emotion.charAt(0).toUpperCase() + state.emotion.slice(1) : 'None'}
        color="blue"
      />
      <Card
        title="人脸识别"
        icon={<User size={18} />}
        active={state.faceDetected}
        value={state.faceDetected ? 'Detected' : 'Not Detected'}
        color="green"
      />
      <Card
        title="手势识别"
        icon={<Hand size={18} />}
        active={!!state.gesture}
        value={state.gesture || 'None'}
        color="purple"
      />
      <Card
        title="高分贝噪声"
        icon={<Volume2 size={18} />}
        active={state.isLoud}
        value={state.isLoud ? 'Loud!' : 'Quiet'}
        color="red"
      />
      <Card
        title="进门/出门"
        icon={state.entering ? <LogIn size={18} /> : <LogOut size={18} />}
        active={state.entering || state.exiting}
        value={state.entering ? 'Entering' : state.exiting ? 'Exiting' : 'None'}
        color="orange"
      />
      <Card
        title="画面中物体"
        icon={<Box size={18} />}
        active={state.objects.length > 0}
        value={state.objects.length > 0 ? state.objects.join(', ') : 'None'}
        color="teal"
      />
      <Card
        title="接近/远离"
        icon={state.approaching ? <MoveRight size={18} /> : <MoveLeft size={18} />}
        active={state.approaching || state.movingAway}
        value={state.approaching ? 'Approaching' : state.movingAway ? 'Moving Away' : 'Stable'}
        color="indigo"
      />
      <Card
        title="有人注视"
        icon={<Eye size={18} />}
        active={state.isLooking}
        value={state.isLooking ? 'Looking' : 'Not Looking'}
        color="pink"
      />
      <Card 
        title="深度分析" 
        icon={<Sparkles size={18} />} 
        active={!!state.deepSceneDescription} 
        value={state.deepSceneDescription || '扫描中...'} 
        color="violet" 
      />
    </div>
  );
};
