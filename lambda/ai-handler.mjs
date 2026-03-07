// AI Handler Lambda - Gemini API + Polly TTS + Caching
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });
const polly = new PollyClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

const CACHE_TABLE = process.env.CACHE_TABLE || "ai-classroom-cache";
const AUDIO_BUCKET = process.env.AUDIO_BUCKET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Generate context-aware cache key
function generateCacheKey(prompt, recentMessages, hasImage) {
  const context = recentMessages.slice(-2).map(m => `${m.role}:${m.text}`).join("|");
  const cacheInput = `${prompt}|${context}|img:${hasImage}`;
  return createHash("sha256").update(cacheInput).digest("hex");
}

// Call Gemini API
async function callGeminiAPI(prompt, messages, whiteboardText, image, screenShareOn) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
  
  const conversationHistory = messages
    .slice(-6)
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");

  const systemPrompt = `You are an AI teacher. 
Current text on the board:
\`\`\`
${whiteboardText || ""}
\`\`\`

Conversation History:
${conversationHistory}

The user asks: "${prompt}". 
${image ? (screenShareOn ? "The user has shared their screen. The image provided is a screenshot of their current screen." : "The user has also uploaded an image which is now displayed on the whiteboard.") : ""}

First, analyze the user's input (text and/or image) in the context of the Conversation History.

DECISION LOGIC (CRITICAL):
0. CLASSIFY THE REQUEST: 
   - Is it a "TOPIC EXPLANATION" (e.g., "what is a black hole", "explain gravity")?
   - Or a "PROBLEM TO SOLVE" (e.g., "solve this equation", uploaded image of homework)?
   - Or an "INTERRUPTION / NEW TOPIC" (user asks something completely different while you were explaining)?
   If TOPIC EXPLANATION or NEW TOPIC: Do NOT write the user's question on the board. Start directly with a clean, formal Topic Heading (e.g., if the user asks "how a plant grow from seed", write "Growth of a Plant"). Do NOT write the question directly. CLEAR_BOARD must be true for new topics.
   If PROBLEM TO SOLVE: Write the problem statement or question at the top of the board first.

1. SIMPLICITY FIRST: Use simple wording. Do NOT go deep into any topic unless the user explicitly asks for details (e.g., "how does that work", "tell me more"). Keep explanations high-level, brief, and easy to understand.
   - CRITICAL: If the user asks about a component (e.g., "diodes"), explain WHAT it is and HOW it works simply. Do NOT explain advanced concepts like IV curves, band gaps, or quantum mechanics unless explicitly asked.
   - INTERRUPTIONS: If the user asks a completely new question that interrupts the current topic, immediately pivot to the new topic. Set CLEAR_BOARD: true and start fresh. Do not force them to finish the previous topic.

2. IF the user provided an IMAGE:
   - MODE: whiteboard
   - CLEAR_BOARD: true
   - The image is ALREADY displayed on the board.
   - Your task is to EXPLAIN the image or SOLVE the problem shown in it.
   - Write your explanation/solution step-by-step on the whiteboard (it will appear below the image).

3. IF the user asks about a "BIG TOPIC" (e.g., "Explain Quantum Physics", "How does a car engine work?", "Teach me Python", "What is history of Rome?", "Solve this math problem"):
   - MODE: whiteboard (or code if it's programming)
   - CLEAR_BOARD: true
   - You MUST write the explanation on the board. Do not just speak it.
   - Break it down into clear steps.

4. IF the user says a GREETING (e.g., "Hi", "Hello") or an INCOMPLETE/VAGUE QUESTION (e.g., "I have a question", "Can you help?", "Tell me about..."):
   - MODE: none
   - CLEAR_BOARD: false
   - Do NOT write anything on the board.
   - Reply ONLY with a spoken response.
   - Ask the user to provide the full question or topic.
   - Example: "Hello! I'm ready to help. What specific topic would you like to learn about today?"

5. IF the user explicitly asked to "write", "draw", "show me on the board", "code this":
   - MODE: whiteboard (or code)
   - CLEAR_BOARD: true

6. IF the user asks a simple factual question (e.g., "What is the capital of France?") AND did NOT ask to write/draw/explain in detail:
   - MODE: none
   - CLEAR_BOARD: false
   - Reply ONLY with a spoken explanation.

Next, generate a "CHAT_ACTION" to reply to the user in the chat.
- "CHAT_ACTION: <action text>"

Next, decide the MODE: "whiteboard", "code", or "none".
- "MODE: <mode>"

If MODE is "whiteboard" or "code", generate the content to display.
If MODE is "whiteboard", also generate DIAGRAMS if needed using the special syntax.

Return your response in this exact JSON format:
{
  "chatAction": "text to show in chat",
  "mode": "whiteboard|code|none",
  "clearBoard": true|false,
  "whiteboardText": "text to write on whiteboard (if mode=whiteboard)",
  "codeText": "code to write (if mode=code)",
  "spokenText": "full explanation to speak via audio",
  "diagrams": []
}`;

  const parts = [{ text: systemPrompt }];
  
  if (image) {
    // Extract base64 data and mime type
    const matches = image.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const base64Data = matches[2];
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data
        }
      });
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }]
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error("Empty response from Gemini API");
  }

  // Parse the response
  return parseGeminiResponse(text);
}

// Parse Gemini's structured response
function parseGeminiResponse(text) {
  const result = {
    chatAction: "",
    mode: "none",
    clearBoard: false,
    whiteboardText: "",
    codeText: "",
    spokenText: "",
    diagrams: []
  };

  // Extract fields using regex
  const chatActionMatch = text.match(/CHAT_ACTION:\s*(.+?)(?=\n|MODE:|$)/s);
  const modeMatch = text.match(/MODE:\s*(whiteboard|code|none)/i);
  const clearBoardMatch = text.match(/CLEAR_BOARD:\s*(true|false)/i);
  
  if (chatActionMatch) result.chatAction = chatActionMatch[1].trim();
  if (modeMatch) result.mode = modeMatch[1].toLowerCase();
  if (clearBoardMatch) result.clearBoard = clearBoardMatch[1].toLowerCase() === "true";

  // Extract whiteboard text
  const whiteboardMatch = text.match(/```whiteboard\n([\s\S]*?)```/);
  if (whiteboardMatch) {
    result.whiteboardText = whiteboardMatch[1].trim();
  }

  // Extract code
  const codeMatch = text.match(/```(?:python|javascript|java|cpp|c)?\n([\s\S]*?)```/);
  if (codeMatch && result.mode === "code") {
    result.codeText = codeMatch[1].trim();
  }

  // Extract spoken text (everything after the structured parts)
  const spokenMatch = text.match(/SPOKEN_TEXT:\s*(.+?)$/s);
  if (spokenMatch) {
    result.spokenText = spokenMatch[1].trim();
  } else {
    // Fallback: use chat action as spoken text
    result.spokenText = result.chatAction;
  }

  return result;
}

// Generate audio with Polly
async function generateAudio(text, sessionId) {
  if (!text || !AUDIO_BUCKET) return null;

  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: "Matthew", // US Male voice
      Engine: "neural"
    });

    const response = await polly.send(command);
    const audioBuffer = Buffer.from(await response.AudioStream.transformToByteArray());

    // Upload to S3
    const key = `audio/${sessionId}-${Date.now()}.mp3`;
    await s3.send(new PutObjectCommand({
      Bucket: AUDIO_BUCKET,
      Key: key,
      Body: audioBuffer,
      ContentType: "audio/mpeg",
      CacheControl: "max-age=604800" // 7 days
    }));

    return `https://${AUDIO_BUCKET}.s3.eu-north-1.amazonaws.com/${key}`;
  } catch (error) {
    console.error("Polly error:", error);
    return null;
  }
}

// Main handler
export const handler = async (event) => {
  console.log("AI Handler invoked:", JSON.stringify(event));

  const {
    sessionId,
    prompt,
    messages = [],
    whiteboardText = "",
    image = null,
    screenShareOn = false
  } = event;

  if (!sessionId || !prompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing sessionId or prompt" })
    };
  }

  // Generate cache key
  const cacheKey = generateCacheKey(prompt, messages, !!image);

  // Check cache
  try {
    const cacheResult = await dynamodb.send(new GetItemCommand({
      TableName: CACHE_TABLE,
      Key: { cacheKey: { S: cacheKey } }
    }));

    if (cacheResult.Item) {
      console.log("Cache hit!");
      return {
        statusCode: 200,
        body: JSON.stringify({
          ...JSON.parse(cacheResult.Item.response.S),
          audioUrl: cacheResult.Item.audioUrl.S,
          cached: true
        })
      };
    }
  } catch (error) {
    console.warn("Cache read error:", error);
  }

  // Call Gemini API
  let geminiResponse;
  try {
    geminiResponse = await callGeminiAPI(prompt, messages, whiteboardText, image, screenShareOn);
  } catch (error) {
    console.error("Gemini API error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI service error", details: error.message })
    };
  }

  // Generate audio
  const audioUrl = await generateAudio(geminiResponse.spokenText, sessionId);

  // Save to cache with 7-day TTL
  const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
  try {
    await dynamodb.send(new PutItemCommand({
      TableName: CACHE_TABLE,
      Item: {
        cacheKey: { S: cacheKey },
        prompt: { S: prompt },
        response: { S: JSON.stringify(geminiResponse) },
        audioUrl: { S: audioUrl || "" },
        ttl: { N: ttl.toString() },
        timestamp: { N: Date.now().toString() }
      }
    }));
  } catch (error) {
    console.warn("Cache write error:", error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...geminiResponse,
      audioUrl,
      cached: false
    })
  };
};
