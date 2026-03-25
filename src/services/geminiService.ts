import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeVideo = async (base64Video: string, mimeType: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Video,
              mimeType: mimeType,
            }
          },
          { text: prompt }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Video analysis error:", error);
    throw error;
  }
};

export const quickSceneDescription = async (base64Image: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            }
          },
          { text: prompt }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Quick scene description error:", error);
    throw error;
  }
};

export const chatWithAI = async (message: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: message,
    });
    return response.text;
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

export const extractIntent = async (text: string) => {
  try {
    const prompt = `分析以下用户的语音输入，提取其核心意图（例如：询问天气、控制设备、打招呼、闲聊等），并用简短的几个字概括（不超过5个字）。如果无法提取，请回复"未知"。输入："${text}"`;
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: prompt,
    });
    return response.text?.trim() || '未知';
  } catch (error) {
    console.error("Intent extraction error:", error);
    return '未知';
  }
};

export const analyzeScene = async (base64Image: string, currentTranscript: string = '') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        },
        {
          text: `你是一个具有高度生命感的机器人。请观察这张图片并结合最近的对话内容（如果有）："${currentTranscript}"。
          请提供一个简短的场景描述（20字以内），重点关注：
          1. 用户正在做的具体动作或状态。
          2. 环境中引人注目的细节（如物体、背景、光线）。
          3. 任何可以作为有趣谈资的发现。
          
          直接返回描述文字，不要有任何前缀。`
        }
      ],
      config: {
        temperature: 0.7,
        topP: 0.95,
      }
    });
    return response.text?.trim() || '';
  } catch (error) {
    console.error("Deep scene analysis error:", error);
    return '';
  }
};

export const generateSpeech = async (text: string, voiceName: string = 'Kore') => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn("TTS quota exceeded.");
    } else {
      console.error("TTS error:", error);
    }
    throw error;
  }
};
