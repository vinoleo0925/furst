import React from 'react';
import { motion } from 'motion/react';
import { RobotReaction } from '../config/robotConfig';
import { Bot, Volume2, Activity } from 'lucide-react';
import { Robot3D } from './Robot3D';

interface RobotAvatarProps {
  reaction: RobotReaction;
  isSpeaking: boolean;
  faceX?: number;
  faceY?: number;
  audioLevel?: number;
}

export const RobotAvatar: React.FC<RobotAvatarProps> = ({ reaction, isSpeaking, faceX = 0, faceY = 0, audioLevel = 0 }) => {
  return (
    <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-0 flex flex-col items-center justify-center h-full relative overflow-hidden group">
      {/* Simulation Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} 
      />
      
      {/* Status Indicators */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Sim_Active</span>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <Activity size={14} className="text-slate-500" />
      </div>

      <div className="relative z-10 w-full h-full flex flex-col">
        {/* 3D Robot Viewport */}
        <div className="flex-1 w-full relative">
          <Robot3D 
            expression={reaction.expression} 
            action={reaction.action}
            isSpeaking={isSpeaking} 
            faceX={faceX} 
            faceY={faceY} 
            audioLevel={audioLevel} 
          />
          
          {/* Viewport Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[12px] border-slate-900/50 rounded-3xl" />
        </div>

        {/* Info Panel Overlay */}
        <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-slate-950/90 to-transparent flex flex-col items-center gap-3">
          {/* Action Badge */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            key={reaction.action}
            className="bg-blue-600/20 border border-blue-500/30 text-blue-400 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 backdrop-blur-sm"
          >
            <Bot size={12} />
            {reaction.action || 'Idle'}
          </motion.div>

          {/* TTS Speech Bubble */}
          {reaction.tts && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={Array.isArray(reaction.tts) ? reaction.tts.join('') : reaction.tts}
              className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-3 text-slate-200 text-xs text-center max-w-[280px] backdrop-blur-md shadow-xl"
            >
              <div className="flex items-start gap-2">
                {isSpeaking && <Volume2 size={14} className="text-blue-400 shrink-0 mt-0.5 animate-pulse" />}
                <p className="leading-relaxed italic">"{Array.isArray(reaction.tts) ? reaction.tts[0] : reaction.tts}"</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Corner Accents */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500/30 m-2" />
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500/30 m-2" />
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500/30 m-2" />
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500/30 m-2" />
    </div>
  );
};

