# AWS Integration Plan - Final Prototype

## What We're Doing

Connecting the React frontend to AWS backend while keeping the fallback working.

## Changes Overview

### 1. Add Environment Variable for Gemini Key
**File**: `.env.local`
```
VITE_GEMINI_API_KEY=AIzaSyB6jRe8UJEgPItv_KFfvepslu3s3DSTAp4
```
(Already has GEMINI_API_KEY, need VITE_ prefix for frontend)

### 2. Initialize WebSocket in App.tsx
**File**: `src/App.tsx`
- Connect to WebSocket on app start
- Pass WebSocket to AI service
- Generate unique userId and sessionId

### 3. Update Classroom.tsx
**File**: `src/components/Classroom.tsx`
- Replace direct Gemini calls with `aiService.sendMessage()`
- AI service tries AWS first, falls back to direct Gemini
- Replace browser TTS with Polly audio (when available)
- Keep all existing functionality

### 4. Audio Playback
- If AWS returns `audioUrl`, play it
- If no audioUrl (fallback), use browser TTS (current behavior)

## What Stays the Same

✅ All UI components
✅ Whiteboard drawing
✅ Code editor
✅ Chat interface
✅ Video/audio (WebRTC)
✅ Screen sharing
✅ PDF export

## What Changes

🔄 AI calls go through AI service (tries AWS, falls back)
🔄 Audio from Polly (when AWS works) or browser TTS (fallback)
🔄 Responses cached in DynamoDB (when AWS works)

## Fallback Behavior

```
User sends message
    ↓
AI Service tries AWS Lambda
    ↓
Success? → Use AWS response + Polly audio
    ↓
Failed? → Use direct Gemini + browser TTS
```

## Testing Plan

1. **Test AWS Path**: Normal usage should use Lambda
2. **Test Fallback**: Disconnect internet briefly, should fall back
3. **Test Audio**: Polly audio should play (AWS) or TTS (fallback)
4. **Test Cache**: Same question twice should be faster (AWS only)

## Deployment

After integration:
```powershell
.\push.ps1
```

App will be available at CloudFront HTTPS URL with full AWS integration!
