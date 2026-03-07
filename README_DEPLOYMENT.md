# 🎓 AI Classroom - Deployment Guide

## 🎯 Quick Deploy

```powershell
# Deploy frontend to AWS
.\push.ps1

# Access your classroom
https://d2a1z182a2prw4.cloudfront.net
```

That's it! Your AI Classroom is live with:
- ✅ HTTPS (camera/mic support)
- ✅ AWS Lambda backend (secure API key)
- ✅ Polly TTS (high-quality voice)
- ✅ Response caching (faster + cheaper)
- ✅ Automatic fallback (reliability)

## 📋 What's Deployed

### Frontend (CloudFront + S3)
- **URL**: `https://d2a1z182a2prw4.cloudfront.net`
- **Region**: eu-north-1 (Stockholm)
- **Features**: React app, WebRTC, WebSocket client

### Backend (AWS Lambda + API Gateway)
- **WebSocket**: `wss://t6atejt5l8.execute-api.eu-north-1.amazonaws.com/prod`
- **Functions**:
  - `ai-classroom-ai-handler` - Gemini API + Polly + Caching
  - `ai-classroom-websocket-handler` - Real-time communication

### Storage (DynamoDB + S3)
- **DynamoDB Tables**:
  - `ai-classroom-connections` - WebSocket connections (24h TTL)
  - `ai-classroom-cache` - AI responses (7-day TTL)
- **S3 Buckets**:
  - `ai-classroom-frontend-637423421920` - Static website
  - `ai-classroom-audio-637423421920` - Polly audio files (7-day lifecycle)

## 🔧 Configuration

### Environment Variables

**Frontend (`.env.local`)**:
```env
# AWS Configuration (Primary)
VITE_WS_URL=wss://t6atejt5l8.execute-api.eu-north-1.amazonaws.com/prod
VITE_AWS_REGION=eu-north-1

# Fallback API Key (only used if AWS fails)
VITE_GEMINI_API_KEY=AIzaSyAEKJc0MlcbbhBbwDij6UEqMQVezwCQfxg
```

**Backend (Lambda)**:
- `GEMINI_API_KEY` - Secure, not exposed (set via CloudFormation)
- `AWS_REGION` - eu-north-1
- `CACHE_TABLE` - ai-classroom-cache
- `AUDIO_BUCKET` - ai-classroom-audio-637423421920

### Update API Key

To update the Gemini API key in Lambda:

```powershell
$env:GEMINI_API_KEY="your-new-key"
.\infrastructure\deploy.ps1
```

## 🧪 Testing

### Test WebSocket Connection

**Option 1: Browser Test Tool**
```powershell
# Open test-websocket.html in browser
Start-Process "test-websocket.html"
```

**Option 2: Browser Console**
1. Open `https://d2a1z182a2prw4.cloudfront.net`
2. Press F12 (DevTools)
3. Look for: `"✅ WebSocket connected - AWS backend active"`

### Test AI Response

1. Join classroom
2. Ask: "What is photosynthesis?"
3. Check console for:
   - `"🚀 Trying AWS Lambda + Polly..."` = AWS attempt
   - `"✅ Using AWS Lambda response"` = Success!
   - `"🔄 Using fallback"` = Using direct Gemini

### Test Audio (Polly)

1. Ask AI a question
2. Listen for voice response
3. Check console for audio URL
4. Verify it's from S3: `https://ai-classroom-audio-*.s3.eu-north-1.amazonaws.com/audio/*.mp3`

## 📊 Architecture

```
User Browser (HTTPS)
    ↓
CloudFront Distribution
    ↓
S3 Static Website
    ↓
WebSocket Connection
    ↓
API Gateway WebSocket
    ↓
Lambda: websocket-handler
    ↓
Lambda: ai-handler
    ↓
┌─────────────┬──────────────┬─────────────┐
│   Gemini    │    Polly     │  DynamoDB   │
│   API       │    TTS       │   Cache     │
└─────────────┴──────────────┴─────────────┘
```

## 💰 Cost Breakdown

For 5-8 users prototype (estimated):

| Service | Monthly Cost |
|---------|-------------|
| API Gateway | $0.50 |
| Lambda | $1.00 |
| DynamoDB | $0.50 |
| S3 | $0.25 |
| Polly | $1.00 |
| CloudFront | $0.50 |
| **Total** | **$3.75-5.00** |

## 🔒 Security

### API Key Protection
- ✅ Lambda has secure key (not exposed)
- ⚠️ Frontend has fallback key (exposed in bundle)

### Why Fallback Exists
- Ensures app always works
- Graceful degradation if AWS fails
- Better user experience

### To Remove Fallback
1. Remove `VITE_GEMINI_API_KEY` from `.env.local`
2. Update `Classroom.tsx` to show error instead
3. Rebuild: `npm run build && .\push.ps1`

⚠️ **Trade-off**: App won't work if AWS WebSocket fails

## 🐛 Troubleshooting

### WebSocket Not Connecting

```powershell
# Check WebSocket URL
aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' --output text

# Check Lambda logs
aws logs tail /aws/lambda/ai-classroom-websocket-handler --follow --region eu-north-1
```

### AI Not Responding

```powershell
# Check AI handler logs
aws logs tail /aws/lambda/ai-classroom-ai-handler --follow --region eu-north-1

# Test Lambda directly
aws lambda invoke --function-name ai-classroom-ai-handler --region eu-north-1 --payload '{"sessionId":"test","prompt":"hello"}' response.json
cat response.json
```

### Audio Not Playing

```powershell
# Check S3 bucket
aws s3 ls s3://ai-classroom-audio-637423421920/audio/ --region eu-north-1

# Check Polly permissions
aws iam get-role-policy --role-name ai-classroom-ai-handler-role --policy-name ai-handler-policy --region eu-north-1
```

## 📝 Commands Reference

### Deploy
```powershell
# Deploy frontend only
.\push.ps1

# Deploy infrastructure only
.\infrastructure\deploy.ps1

# Deploy both
.\infrastructure\deploy.ps1
.\push.ps1
```

### Monitor
```powershell
# View all outputs
aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].Outputs' --output table

# Check Lambda invocations
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=ai-classroom-ai-handler --start-time 2026-03-08T00:00:00Z --end-time 2026-03-08T23:59:59Z --period 3600 --statistics Sum --region eu-north-1

# Check cache size
aws dynamodb describe-table --table-name ai-classroom-cache --region eu-north-1 --query 'Table.ItemCount'
```

### Clean Up
```powershell
# Delete entire stack (WARNING: Deletes everything!)
aws cloudformation delete-stack --stack-name ai-classroom-stack --region eu-north-1

# Empty S3 buckets first
aws s3 rm s3://ai-classroom-frontend-637423421920 --recursive --region eu-north-1
aws s3 rm s3://ai-classroom-audio-637423421920 --recursive --region eu-north-1
```

## 🎉 Features

### Working Features
- ✅ Real-time whiteboard with LaTeX math
- ✅ Code editor with syntax highlighting
- ✅ AI teacher (Gemini 2.5 Flash)
- ✅ High-quality TTS (Polly - Matthew voice)
- ✅ Video/audio calls (WebRTC P2P)
- ✅ Screen sharing
- ✅ Chat with AI
- ✅ PDF export
- ✅ Response caching (7 days)
- ✅ Diagram generation
- ✅ Step-by-step explanations

### AI Capabilities
- Explains any topic (science, math, programming, etc.)
- Generates diagrams and visualizations
- Writes code with explanations
- Solves math/physics problems
- Analyzes uploaded images
- Responds to voice commands

## 📚 Documentation

- `CURRENT_STATUS.md` - Detailed status of all components
- `NEXT_STEPS.md` - Step-by-step deployment guide
- `FINAL_STATUS.md` - Original deployment summary
- `test-websocket.html` - WebSocket connection tester

## 🚀 Get Started

```powershell
# 1. Deploy
.\push.ps1

# 2. Open app
Start-Process "https://d2a1z182a2prw4.cloudfront.net"

# 3. Join classroom and start learning!
```

## 🆘 Support

If you encounter issues:

1. Check browser console (F12)
2. Check Lambda logs (see Troubleshooting section)
3. Verify AWS resources are deployed
4. Test WebSocket connection with `test-websocket.html`

## 📄 License

This project uses:
- Google Gemini API (requires API key)
- AWS Services (requires AWS account)
- React + Vite (MIT License)

---

**Your AI Classroom is ready! Deploy and start teaching!** 🎓✨
