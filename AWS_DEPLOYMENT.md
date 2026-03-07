# AWS Deployment Guide - AI Classroom

Complete guide to deploy the AI Classroom application on AWS (eu-north-1 region).

## Architecture Overview

```
┌─────────────────┐
│   CloudFront    │ (Optional CDN)
│   + S3 Static   │
└────────┬────────┘
         │
┌────────▼────────────────────────────────────┐
│          React Frontend (Browser)           │
│  - WebRTC (P2P Video/Audio)                │
│  - WebSocket Client                         │
└────────┬────────────────────────────────────┘
         │
         │ WebSocket
         │
┌────────▼────────────────────────────────────┐
│      API Gateway WebSocket API              │
└────────┬────────────────────────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────────┐
│ WS   │  │ AI        │
│Lambda│  │ Lambda    │
└───┬──┘  └──┬────────┘
    │        │
    │        ├─► Gemini API (Google)
    │        ├─► Polly (TTS)
    │        └─► S3 (Audio Storage)
    │
┌───▼──────────────┐
│   DynamoDB       │
│ - Connections    │
│ - Cache (7 days) │
└──────────────────┘
```

## Prerequisites

1. **AWS Account** with CLI configured
2. **AWS CLI** installed and configured
   ```bash
   aws configure
   # Enter your credentials for eu-north-1 region
   ```
3. **Node.js** 18+ and npm
4. **Gemini API Key** from Google AI Studio
5. **Bash** shell (Git Bash on Windows)

## Cost Estimate (5-8 users prototype)

- **S3**: ~$1-2/month (storage + requests)
- **DynamoDB**: Free tier (25GB, 25 WCU/RCU)
- **Lambda**: Free tier (1M requests/month)
- **API Gateway WebSocket**: ~$1/million messages (essentially free)
- **Polly**: Free tier (5M characters/month for first 12 months)
- **CloudFront**: Optional (~$1-5/month)

**Total: $0-5/month** for prototype usage

## Step 1: Deploy Infrastructure

```bash
# Set your Gemini API key
export GEMINI_API_KEY="your-gemini-api-key-here"

# Make scripts executable
chmod +x infrastructure/deploy.sh
chmod +x infrastructure/deploy-frontend.sh

# Deploy AWS infrastructure
cd infrastructure
./deploy.sh
```

This will:
- Create S3 buckets (frontend + audio)
- Create DynamoDB tables (connections + cache)
- Deploy Lambda functions
- Set up API Gateway WebSocket
- Configure IAM roles and permissions

**Expected time:** 5-10 minutes

## Step 2: Update Frontend Configuration

After deployment completes, you'll see output like:

```
WebSocket URL: wss://abc123xyz.execute-api.eu-north-1.amazonaws.com/prod
Frontend Bucket: ai-classroom-frontend-123456789
```

Update `.env.local`:

```env
GEMINI_API_KEY=your-key-here
VITE_WS_URL=wss://abc123xyz.execute-api.eu-north-1.amazonaws.com/prod
VITE_AWS_REGION=eu-north-1
```

## Step 3: Build and Deploy Frontend

```bash
# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to S3
./infrastructure/deploy-frontend.sh
```

## Step 4: Access Your Application

Your app will be available at:
```
http://ai-classroom-frontend-{account-id}.s3-website.eu-north-1.amazonaws.com
```

## Features Enabled

✅ Real-time chat with AI (Gemini API)
✅ Text-to-speech with caching (Polly + DynamoDB)
✅ Whiteboard collaboration (WebSocket sync)
✅ Code editor collaboration (WebSocket sync)
✅ Video/Audio calls (WebRTC P2P - FREE!)
✅ Session management
✅ 7-day audio cache (cost optimization)

## Architecture Details

### Lambda Functions

1. **ai-handler** (60s timeout, 512MB)
   - Calls Gemini API for AI responses
   - Generates audio with Polly (Matthew voice)
   - Caches responses in DynamoDB (context-aware)
   - Uploads audio to S3
   - Returns: text, audio URL, mode, diagrams

2. **websocket-handler** (30s timeout, 256MB)
   - Manages WebSocket connections
   - Broadcasts messages to session participants
   - Routes WebRTC signaling
   - Invokes AI handler for chat messages

### DynamoDB Tables

1. **ai-classroom-connections**
   - Primary Key: connectionId
   - GSI: sessionId-index
   - TTL: 24 hours
   - Tracks active WebSocket connections

2. **ai-classroom-cache**
   - Primary Key: cacheKey (SHA256 hash)
   - TTL: 7 days
   - Caches AI responses + audio URLs
   - Cache key = hash(prompt + last 2 messages + image flag)

### S3 Buckets

1. **ai-classroom-frontend-{account-id}**
   - Static website hosting
   - Public read access
   - CORS enabled

2. **ai-classroom-audio-{account-id}**
   - Polly-generated MP3 files
   - Public read access
   - 7-day lifecycle policy (auto-delete)

## Development Workflow

### Local Development
```bash
npm run dev
# Frontend runs on localhost:3000
# Still connects to AWS backend
```

### Update Lambda Code
```bash
cd lambda
npm install  # if dependencies changed
cd ..

# Repackage and deploy
cd lambda
zip -r dist/ai-handler.zip ai-handler.mjs node_modules package.json
aws lambda update-function-code \
  --function-name ai-classroom-ai-handler \
  --zip-file fileb://dist/ai-handler.zip \
  --region eu-north-1
```

### Update Frontend
```bash
npm run build
./infrastructure/deploy-frontend.sh
```

## Monitoring

### CloudWatch Logs
```bash
# AI Handler logs
aws logs tail /aws/lambda/ai-classroom-ai-handler --follow --region eu-north-1

# WebSocket Handler logs
aws logs tail /aws/lambda/ai-classroom-websocket-handler --follow --region eu-north-1
```

### DynamoDB Metrics
```bash
# Check cache hit rate
aws dynamodb describe-table \
  --table-name ai-classroom-cache \
  --region eu-north-1
```

### S3 Storage
```bash
# Check audio storage usage
aws s3 ls s3://ai-classroom-audio-{account-id}/audio/ --recursive --human-readable --summarize
```

## Troubleshooting

### WebSocket Connection Fails
1. Check `.env.local` has correct `VITE_WS_URL`
2. Verify API Gateway deployment:
   ```bash
   aws apigatewayv2 get-apis --region eu-north-1
   ```

### AI Responses Not Working
1. Check Lambda logs for errors
2. Verify Gemini API key is set correctly
3. Test Lambda directly:
   ```bash
   aws lambda invoke \
     --function-name ai-classroom-ai-handler \
     --payload '{"sessionId":"test","prompt":"Hello"}' \
     --region eu-north-1 \
     response.json
   ```

### Audio Not Playing
1. Check S3 bucket policy allows public read
2. Verify Polly permissions in IAM role
3. Check browser console for CORS errors

### Cache Not Working
1. Verify DynamoDB table exists
2. Check TTL is enabled on `ttl` attribute
3. Review Lambda logs for DynamoDB errors

## Cleanup / Teardown

To delete all AWS resources:

```bash
# Delete S3 buckets (must be empty first)
aws s3 rm s3://ai-classroom-frontend-{account-id} --recursive --region eu-north-1
aws s3 rm s3://ai-classroom-audio-{account-id} --recursive --region eu-north-1

# Delete CloudFormation stack
aws cloudformation delete-stack \
  --stack-name ai-classroom-stack \
  --region eu-north-1

# Wait for deletion
aws cloudformation wait stack-delete-complete \
  --stack-name ai-classroom-stack \
  --region eu-north-1
```

## Security Considerations

1. **API Keys**: Gemini API key is stored in Lambda environment variables (encrypted at rest)
2. **WebSocket**: No authentication (suitable for prototype, add Cognito for production)
3. **S3**: Public read access (required for audio playback)
4. **CORS**: Configured to allow all origins (restrict in production)

## Scaling for Production

If you need to scale beyond 5-8 users:

1. **Add CloudFront** for global CDN
2. **Enable DynamoDB Auto Scaling**
3. **Add Cognito** for user authentication
4. **Implement rate limiting** on API Gateway
5. **Add CloudWatch alarms** for monitoring
6. **Use Lambda reserved concurrency**
7. **Consider API Gateway REST API** for non-real-time endpoints

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review AWS CloudFormation events
3. Test individual components (Lambda, DynamoDB, S3)

## Next Steps

- [ ] Add CloudFront distribution
- [ ] Implement user authentication (Cognito)
- [ ] Add session recording (S3 + DynamoDB)
- [ ] Implement admin dashboard
- [ ] Add analytics (CloudWatch + QuickSight)
