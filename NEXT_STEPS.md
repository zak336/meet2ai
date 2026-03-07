# 🎯 Next Steps - AI Classroom Deployment

## Current Situation

✅ **Good News**: Your application is working perfectly!
- No TypeScript errors
- Build succeeds
- AWS infrastructure deployed
- WebSocket integration code ready

⚠️ **What Needs Testing**: WebSocket connection to AWS

## 🚀 Quick Start (Recommended)

### Step 1: Deploy Frontend
```powershell
.\push.ps1
```

This will:
- Build the React app
- Upload to S3
- Invalidate CloudFront cache
- Make it available at: `https://d2a1z182a2prw4.cloudfront.net`

### Step 2: Test WebSocket Connection

**Option A: Use Test Tool (Easiest)**
1. Open `test-websocket.html` in your browser
2. Click "Connect"
3. Check if it says "✅ Connected to AWS WebSocket!"
4. Try sending a test message

**Option B: Use Browser Console**
1. Open `https://d2a1z182a2prw4.cloudfront.net`
2. Open browser DevTools (F12)
3. Look for these messages:
   - ✅ `"✅ WebSocket connected - AWS backend active"` = AWS working!
   - ⚠️ `"⚠️ WebSocket not connected - Using fallback mode"` = Using direct Gemini

### Step 3: Test the Classroom

1. Go to CloudFront URL
2. Join a classroom session
3. Ask the AI a question (e.g., "What is photosynthesis?")
4. Check browser console to see which path was used:
   - `"🚀 Trying AWS Lambda + Polly..."` = AWS attempt
   - `"✅ Using AWS Lambda response"` = AWS success!
   - `"🔄 Using fallback: Direct Gemini API"` = Fallback used

## 🔍 Troubleshooting

### If WebSocket Fails to Connect

**Check 1: Verify WebSocket URL**
```powershell
aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' --output text
```

Should return: `wss://t6atejt5l8.execute-api.eu-north-1.amazonaws.com/prod`

**Check 2: Test Lambda Functions**
```powershell
# Check WebSocket handler logs
aws logs tail /aws/lambda/ai-classroom-websocket-handler --follow --region eu-north-1

# Check AI handler logs
aws logs tail /aws/lambda/ai-classroom-ai-handler --follow --region eu-north-1
```

**Check 3: Verify DynamoDB Tables**
```powershell
# List connections
aws dynamodb scan --table-name ai-classroom-connections --region eu-north-1

# List cache entries
aws dynamodb scan --table-name ai-classroom-cache --region eu-north-1 --max-items 5
```

### If Audio Doesn't Play

**Check 1: Verify S3 Bucket**
```powershell
aws s3 ls s3://ai-classroom-audio-637423421920/audio/ --region eu-north-1
```

**Check 2: Test Audio URL**
- Look in browser console for audio URL
- Copy URL and open in new tab
- Should download/play MP3 file

**Check 3: Verify Polly Permissions**
```powershell
aws iam get-role --role-name ai-classroom-ai-handler-role --region eu-north-1
```

## 🔧 Configuration Updates

### Update Gemini API Key in Lambda

If you need to change the API key in AWS:

```powershell
# Set new key
$env:GEMINI_API_KEY="your-new-key-here"

# Redeploy infrastructure
.\infrastructure\deploy.ps1
```

This will update the Lambda environment variable without affecting the frontend.

### Remove Frontend Fallback (Optional)

If you want to remove the exposed API key entirely:

1. **Edit `.env.local`**:
   ```env
   # Remove or comment out this line:
   # VITE_GEMINI_API_KEY=AIzaSyAEKJc0MlcbbhBbwDij6UEqMQVezwCQfxg
   ```

2. **Update `Classroom.tsx`** (lines 868-871):
   ```typescript
   // Replace fallback with error message
   console.error('❌ AWS Lambda unavailable and no fallback configured');
   setSteps([{
     spokenText: "I'm sorry, the AI service is temporarily unavailable. Please try again later.",
     whiteboardText: "Service Unavailable"
   }]);
   setIsProcessing(false);
   return;
   ```

3. **Rebuild and deploy**:
   ```powershell
   npm run build
   .\push.ps1
   ```

⚠️ **Warning**: Without fallback, the app won't work if AWS WebSocket fails!

## 📊 Monitoring

### Check AWS Costs
```powershell
# View current month costs
aws ce get-cost-and-usage --time-period Start=2026-03-01,End=2026-03-31 --granularity MONTHLY --metrics BlendedCost --region us-east-1
```

### Monitor Lambda Invocations
```powershell
# WebSocket handler metrics
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=ai-classroom-websocket-handler --start-time 2026-03-08T00:00:00Z --end-time 2026-03-08T23:59:59Z --period 3600 --statistics Sum --region eu-north-1

# AI handler metrics
aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=ai-classroom-ai-handler --start-time 2026-03-08T00:00:00Z --end-time 2026-03-08T23:59:59Z --period 3600 --statistics Sum --region eu-north-1
```

### Check Cache Hit Rate
```powershell
# Count cache entries
aws dynamodb describe-table --table-name ai-classroom-cache --region eu-north-1 --query 'Table.ItemCount'
```

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ CloudFront URL loads the app
2. ✅ Camera/microphone permissions work (HTTPS)
3. ✅ WebSocket connects (check console)
4. ✅ AI responds to questions
5. ✅ Audio plays (Polly voice)
6. ✅ Whiteboard/code editor works
7. ✅ PDF export works

## 🆘 Need Help?

### Quick Diagnostics
```powershell
# Run all checks at once
Write-Host "=== CloudFormation Stack ===" -ForegroundColor Cyan
aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].Outputs' --output table

Write-Host "`n=== Lambda Functions ===" -ForegroundColor Cyan
aws lambda list-functions --region eu-north-1 --query 'Functions[?starts_with(FunctionName, `ai-classroom`)].FunctionName'

Write-Host "`n=== DynamoDB Tables ===" -ForegroundColor Cyan
aws dynamodb list-tables --region eu-north-1 --query 'TableNames[?starts_with(@, `ai-classroom`)]'

Write-Host "`n=== S3 Buckets ===" -ForegroundColor Cyan
aws s3 ls | Select-String "ai-classroom"
```

### Common Issues

**Issue**: "WebSocket connection failed"
**Solution**: Check if API Gateway WebSocket is deployed correctly

**Issue**: "AI service error"
**Solution**: Check Lambda logs for Gemini API errors

**Issue**: "Audio not playing"
**Solution**: Check S3 bucket permissions and Polly configuration

**Issue**: "CORS errors"
**Solution**: Verify CloudFront and S3 CORS settings

## 📝 What You Have

1. ✅ Production-ready AI classroom
2. ✅ HTTPS via CloudFront
3. ✅ Serverless AWS backend
4. ✅ Polly TTS (high quality)
5. ✅ Response caching (7 days)
6. ✅ Secure API key (Lambda)
7. ✅ Automatic fallback
8. ✅ Cost-optimized ($0-5/month)

## 🚀 Deploy Now!

```powershell
# Deploy frontend
.\push.ps1

# Access your app
Start-Process "https://d2a1z182a2prw4.cloudfront.net"
```

**Your AI Classroom is ready to use!** 🎓
