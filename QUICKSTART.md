# Quick Start Guide - Deploy in 10 Minutes

## Prerequisites
- AWS Account with CLI configured
- Gemini API Key
- Node.js 18+

## Step 1: Deploy Backend (5 minutes)

```bash
# Set your Gemini API key
export GEMINI_API_KEY="your-gemini-api-key"

# Make scripts executable (Linux/Mac/Git Bash)
chmod +x infrastructure/deploy.sh
chmod +x infrastructure/deploy-frontend.sh

# Deploy AWS infrastructure
./infrastructure/deploy.sh
```

**Wait for completion.** You'll see:
```
✅ Deployment Complete!
WebSocket URL: wss://abc123.execute-api.eu-north-1.amazonaws.com/prod
Frontend Bucket: ai-classroom-frontend-123456789
```

## Step 2: Configure Frontend (1 minute)

Update `.env.local`:
```env
GEMINI_API_KEY=your-key-here
VITE_WS_URL=wss://abc123.execute-api.eu-north-1.amazonaws.com/prod
VITE_AWS_REGION=eu-north-1
```

## Step 3: Deploy Frontend (3 minutes)

```bash
# Install dependencies (if not done)
npm install

# Build and deploy
npm run build
./infrastructure/deploy-frontend.sh
```

## Step 4: Access Your App (1 minute)

Open the URL shown:
```
http://ai-classroom-frontend-{account-id}.s3-website.eu-north-1.amazonaws.com
```

## Done! 🎉

Your AI Classroom is now running on AWS with:
- ✅ Real-time chat with AI
- ✅ Text-to-speech (Polly)
- ✅ Whiteboard collaboration
- ✅ Code editor
- ✅ Video/audio calls (WebRTC)
- ✅ Response caching

## Test It

1. Open the app in 2 browser tabs
2. Join the same session
3. Send a message to AI
4. Draw on whiteboard
5. Start video call

## Troubleshooting

**WebSocket won't connect?**
- Check `.env.local` has correct VITE_WS_URL
- Rebuild: `npm run build && ./infrastructure/deploy-frontend.sh`

**AI not responding?**
- Check Lambda logs: `aws logs tail /aws/lambda/ai-classroom-ai-handler --follow --region eu-north-1`
- Verify Gemini API key is correct

**Audio not playing?**
- Check browser console for errors
- Verify S3 bucket policy allows public read

## What's Next?

See `IMPLEMENTATION_SUMMARY.md` for architecture details and `AWS_DEPLOYMENT.md` for complete documentation.

## Cleanup

To delete everything:
```bash
# Empty S3 buckets
aws s3 rm s3://ai-classroom-frontend-{account-id} --recursive --region eu-north-1
aws s3 rm s3://ai-classroom-audio-{account-id} --recursive --region eu-north-1

# Delete stack
aws cloudformation delete-stack --stack-name ai-classroom-stack --region eu-north-1
```

---

**Estimated Monthly Cost**: $0-5 for 5-8 users
**Region**: eu-north-1 (Stockholm)
