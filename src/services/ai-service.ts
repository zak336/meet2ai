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

export interface AIResponse {
  chatAction: string;
  mode: 'whiteboard' | 'code' | 'none';
  clearBoard: boolean;
  whiteboardText?: string;
  codeText?: string;
  spokenText: string;
  audioUrl?: string;
  diagrams?: any[];
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
        console.log('🚀 Trying AWS Lambda...');
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
        resolve({
          ...data,
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

  private async sendViaDirect(request: AIRequest): Promise<AIResponse> {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
    const model = 'gemini-2.5-flash';

    const conversationHistory = request.messages
      .slice(-6)
      .map(m => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');

    const systemPrompt = `You are an AI teacher. 
Current text on the board:
\`\`\`
${request.whiteboardText || ''}
\`\`\`

Conversation History:
${conversationHistory}

The user asks: "${request.prompt}". 
${request.image ? (request.screenShareOn ? "The user has shared their screen." : "The user uploaded an image.") : ""}

DECISION LOGIC:
- TOPIC EXPLANATION: Start with clean heading, set CLEAR_BOARD: true
- PROBLEM TO SOLVE: Write problem at top
- GREETING/VAGUE: MODE: none, ask for clarification
- BIG TOPIC: MODE: whiteboard or code, CLEAR_BOARD: true

Return JSON format:
{
  "chatAction": "text for chat",
  "mode": "whiteboard|code|none",
  "clearBoard": true|false,
  "whiteboardText": "text for board",
  "codeText": "code if mode=code",
  "spokenText": "full explanation to speak"
}`;

    const parts: any[] = [{ text: systemPrompt }];
    
    if (request.image) {
      const matches = request.image.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inlineData: {
            mimeType: matches[1],
            data: matches[2]
          }
        });
      }
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts }]
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Parse response
    const parsed = this.parseGeminiResponse(text);

    return {
      ...parsed,
      source: 'fallback' as const
    };
  }

  private parseGeminiResponse(text: string): Omit<AIResponse, 'source'> {
    const result: any = {
      chatAction: '',
      mode: 'none',
      clearBoard: false,
      whiteboardText: '',
      codeText: '',
      spokenText: '',
      diagrams: []
    };

    // Try to parse as JSON first
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...result, ...parsed };
      }
    } catch (e) {
      // Fall back to regex parsing
    }

    // Regex parsing
    const chatActionMatch = text.match(/CHAT_ACTION:\s*(.+?)(?=\n|MODE:|$)/s);
    const modeMatch = text.match(/MODE:\s*(whiteboard|code|none)/i);
    const clearBoardMatch = text.match(/CLEAR_BOARD:\s*(true|false)/i);
    
    if (chatActionMatch) result.chatAction = chatActionMatch[1].trim();
    if (modeMatch) result.mode = modeMatch[1].toLowerCase();
    if (clearBoardMatch) result.clearBoard = clearBoardMatch[1].toLowerCase() === 'true';

    const whiteboardMatch = text.match(/```whiteboard\n([\s\S]*?)```/);
    if (whiteboardMatch) result.whiteboardText = whiteboardMatch[1].trim();

    const codeMatch = text.match(/```(?:python|javascript|java|cpp|c)?\n([\s\S]*?)```/);
    if (codeMatch && result.mode === 'code') result.codeText = codeMatch[1].trim();

    result.spokenText = result.chatAction || text;

    return result;
  }
}

export const aiService = new AIService();
