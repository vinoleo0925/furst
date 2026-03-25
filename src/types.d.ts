declare module '@mediapipe/tasks-vision' {
  export class GestureRecognizer {
    static createFromOptions(vision: any, options: any): Promise<GestureRecognizer>;
    recognizeForVideo(video: HTMLVideoElement, timestamp: number): any;
  }
  export class FilesetResolver {
    static forVisionTasks(url: string): Promise<any>;
  }
}
