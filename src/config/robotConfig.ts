export interface RobotReaction {
  expression: string;
  action: string;
  tts: string | string[];
}

export interface RobotConfig {
  emotions: Record<string, RobotReaction>;
  gestures: Record<string, RobotReaction>;
  events: Record<string, RobotReaction>;
}

export const defaultRobotConfig: RobotConfig = {
  emotions: {
    happy: { expression: 'happy', action: '开心摇摆', tts: ['你看起来很高兴呢！', '遇到什么好事啦？', '看到你开心我也很开心~'] },
    sad: { expression: 'sad', action: '低头安慰', tts: ['不要难过，我在这里陪你。', '抱抱你，一切都会好起来的。', '有什么心事可以跟我说说哦。'] },
    angry: { expression: 'angry', action: '害怕后退', tts: ['请不要生气...', '消消气，深呼吸~', '我有点害怕...'] },
    surprised: { expression: 'surprised', action: '后仰惊讶', tts: ['哇哦！', '天哪！', '真让人意想不到！'] },
    neutral: { expression: 'neutral', action: '待机呼吸', tts: '' },
  },
  gestures: {
    Thumb_Up: { expression: 'happy', action: '竖起大拇指', tts: ['太棒了！给你点赞！', '干得漂亮！', '牛牛牛！'] },
    Victory: { expression: 'happy', action: '比耶', tts: ['耶！开心！', 'V字手势！', '胜利！'] },
    Open_Palm: { expression: 'happy', action: '挥手', tts: ['你好呀！过来玩！', '哈喽！', '嗨~'] },
    ILoveYou: { expression: 'love', action: '张开双臂', tts: ['要抱抱！', '爱你哟~', '我也喜欢你！'] },
  },
  events: {
    loud_noise: { expression: 'surprised', action: '捂耳朵/转头', tts: ['哇，好大的声音！', '吓我一跳！', '声音太大了~'] },
    gaze_5s: { expression: 'confused', action: '歪头询问', tts: ['你一直看着我，是想和我聊天吗？还是需要我帮忙？', '怎么啦？', '我脸上有什么东西吗？'] },
    gaze_15s: { expression: 'confused', action: '挠头困惑', tts: ['怎么不说话呀？', '是不是不知道说什么？', '你可以跟我随便聊聊哦。'] },
    gaze_30s: { expression: 'neutral', action: '左右环顾', tts: ['这里有什么好看的吗？', '你在想什么呢？'] },
    gaze_60s: { expression: 'sleepy', action: '转身离开', tts: ['我先去充电啦，有事叫我。', '好困哦，我去休息一下。'] },
    proactive_bored: { expression: 'confused', action: '主动搭话', tts: ['你在发呆吗？', '需要我给你放点音乐吗？', '好无聊呀，我们玩个游戏吧？', '哈欠~ 你在忙什么呢？'] },
    approach_near: { expression: 'happy', action: '目光与人脸跟随', tts: '' },
    approach_far: { expression: 'neutral', action: '目光跟随', tts: '' },
    walk_past: { expression: 'neutral', action: '随机跟随', tts: '' },
    idle: { expression: 'neutral', action: '待机呼吸', tts: '' }
  }
};
