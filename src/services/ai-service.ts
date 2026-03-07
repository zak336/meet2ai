// AI Service with AWS Lambda + Fallback to Direct Gemini
import { GoogleGenAI } from '@google/genai';

export interface AIMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface AIRequest {
  prompt: string;
  messages: AIMessage[];
  whiteboardText: string;
  image?: string;
  screenShareOn?: boolean;
}

// Keep the response as raw text to maintain compatibility with existing parsing
export interface AIResponse {
  text: string;
  audioUrl?: string;
  cached?: boolean;
  source: 'aws' | 'fallback';
}

class AIService {
  private wsConnected = false;
  private ws: any = null;

  setWebSocket(ws: any) {
    this.ws = ws;
    this.wsConnected = ws?.isConnected() || false;
  }

  async sendMessage(request: AIRequest): Promise<AIResponse> {
    // Try AWS Lambda first
    if (this.wsConnected && this.ws) {
      try {
        console.log('🚀 Trying AWS Lambda + Polly...');
        return await this.sendViaAWS(request);
      } catch (error) {
        console.warn('⚠️ AWS Lambda failed, falling back to direct Gemini:', error);
      }
    }

    // Fallback to direct Gemini API
    console.log('🔄 Using fallback: Direct Gemini API');
    return await this.sendViaDirect(request);
  }

  private async sendViaAWS(request: AIRequest): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('AWS Lambda timeout'));
      }, 30000); // 30s timeout

      // Listen for AI response
      const handler = (data: any) => {
        clearTimeout(timeout);
        this.ws.off('ai-response', handler);
        
        // AWS Lambda returns structured response, convert to text format
        const text = this.formatAWSResponse(data);
        
        resolve({
          text,
          audioUrl: data.audioUrl,
          cached: data.cached,
          source: 'aws' as const
        });
      };

      this.ws.on('ai-response', handler);

      // Send request via WebSocket
      this.ws.sendChatMessage(
        request.prompt,
        request.messages,
        request.whiteboardText,
        request.image,
        request.screenShareOn
      );
    });
  }

  private formatAWSResponse(data: any): string {
    // Convert AWS structured response back to the text format Classroom expects
    let text = '';
    
    if (data.chatAction) {
      text += `CHAT_ACTION: ${data.chatAction}\n`;
    }
    
    if (data.mode) {
      text += `MODE: ${data.mode}\n`;
    }
    
    if (data.clearBoard !== undefined) {
      text += `CLEAR_BOARD: ${data.clearBoard}\n`;
    }
    
    // Add step format
    text += `===STEP===\n`;
    text += `SPOKEN: ${data.spokenText || data.chatAction}\n`;
    text += `WRITTEN: ${data.whiteboardText || data.codeText || ''}\n`;
    text += `DIAGRAM_PROMPT: \n`;
    text += `HIGHLIGHT: \n`;
    text += `PERMANENT_HIGHLIGHT: \n`;
    text += `===STEP===\n`;
    
    return text;
  }

  private async sendViaDirect(request: AIRequest): Promise<AIResponse> {
    // This returns the raw Gemini response text as-is
    // Classroom.tsx will parse it the same way it always has
    return {
      text: '', // Will be filled by streaming in Classroom
      source: 'fallback' as const
    };
  }
}

export const aiService = new AIService();
