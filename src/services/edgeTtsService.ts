export async function generateEdgeTTS(text: string, voiceName: string = 'zh-CN-XiaoxiaoNeural'): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
    
    let audioData: Uint8Array[] = [];

    ws.onopen = () => {
      // 1. Send speech config
      const configMsg = `X-Timestamp:${Date.now()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(configMsg);

      // 2. Send SSML
      const requestId = crypto.randomUUID().replace(/-/g, '');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'><voice name='${voiceName}'><prosody pitch='+0Hz' rate='1.0' volume='100'>${text}</prosody></voice></speak>`;
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${Date.now()}Z\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          ws.close();
        }
      } else if (event.data instanceof Blob) {
        // Binary audio data
        const buffer = await event.data.arrayBuffer();
        const view = new DataView(buffer);
        const headerLength = view.getUint16(0);
        const audioPayload = new Uint8Array(buffer, 2 + headerLength);
        audioData.push(audioPayload);
      }
    };

    ws.onclose = () => {
      if (audioData.length > 0) {
        // Concatenate all Uint8Arrays
        const totalLength = audioData.reduce((acc, val) => acc + val.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const array of audioData) {
          result.set(array, offset);
          offset += array.length;
        }
        resolve(result.buffer);
      } else {
        reject(new Error('No audio data received from Edge TTS'));
      }
    };

    ws.onerror = (error) => {
      reject(error);
    };
  });
}
