import { useState, useEffect } from "react";
import SectionLayer from "./layers/SectionLayer";
import BackgroundLayer from "./layers/BackgroundLayer";
import AvatarLayer from "./layers/AvatarLayer";
import { useWebSocket } from "./hooks/useWebSocket";
import { aiService } from "./services/ai-service";

export type AppPhase =
  | "intro"
  | "landing"
  | "about"
  | "features"
  | "join"
  | "prejoin"
  | "classroom";

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>("intro");
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [userId] = useState(() => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const landingLayoutMode: "centered" | "asymmetrical" = "centered";

  // Initialize WebSocket connection
  const { connected, ws, error } = useWebSocket({
    sessionId,
    userId,
    onAIResponse: (data) => {
      console.log('AI Response received:', data);
    },
    onError: (err) => {
      console.error('WebSocket error:', err);
    }
  });

  // Connect AI service to WebSocket
  useEffect(() => {
    if (ws) {
      aiService.setWebSocket(ws);
      console.log('✅ AI Service connected to WebSocket');
    }
  }, [ws]);

  useEffect(() => {
    if (connected) {
      console.log('✅ WebSocket connected - AWS backend active');
    } else if (error) {
      console.warn('⚠️ WebSocket not connected - Using fallback mode');
    }
  }, [connected, error]);

  return (
    <>
      <BackgroundLayer />
      <AvatarLayer />
      <SectionLayer
        appPhase={appPhase}
        setAppPhase={setAppPhase}
        landingLayoutMode={landingLayoutMode}
      />
    </>
  );
}
