# 🔧 Lambda Function Fix

## ❌ Problem Identified

The Lambda functions are failing with:
```
Error: Cannot find module 'websocket-handler'
```

## 🔍 Root Cause

The CloudFormation template deployed Lambda functions with **placeholder code** instead of the actual code from `lambda/websocket-handler.mjs` and `lambda/ai-handler.mjs`.

The deployment script (`deploy.ps1`) does upload the correct code afterwards, but there's a packaging issue.

## ✅ Solution

Run the fix script to properly package and upload the Lambda code:

```powershell
.\fix-lambda.ps1
```

This will:
1. ✅ Install Lambda dependencies
2. ✅ Create proper zip packages with all files
3. ✅ Upload to both Lambda functions
4. ✅ Test the functions
5. ✅ Verify they work

**Time**: ~1-2 minutes

## 📋 What the Fix Does

### Before (Broken):
```
Lambda Function
├── Placeholder code (from CloudFormation)
└── ❌ Missing: websocket-handler.mjs
```

### After (Fixed):
```
Lambda Function
├── ✅ websocket-handler.mjs (actual code)
├── ✅ ai-handler.mjs (actual code)
├── ✅ package.json
└── ✅ node_modules/ (dependencies)
```

## 🚀 Quick Fix

```powershell
# Run the fix script
.\fix-lambda.ps1

# Wait for completion (~1-2 minutes)

# Test WebSocket connection
# Open test-websocket.html in browser
```

## 🧪 Verify the Fix

### Method 1: Check Logs
```powershell
# Watch Lambda logs
aws logs tail /aws/lambda/ai-classroom-websocket-handler --follow --region eu-north-1
```

You should see:
- ✅ No more "Cannot find module" errors
- ✅ "WebSocket connected" messages
- ✅ Successful invocations

### Method 2: Test WebSocket
```powershell
# Open test tool
Start-Process "test-websocket.html"
```

Click "Connect" - should show:
- ✅ "Connected to AWS WebSocket!"

### Method 3: Test in App
```powershell
# Deploy frontend
.\push.ps1

# Open app
Start-Process "https://d2a1z182a2prw4.cloudfront.net"
```

Check browser console:
- ✅ "✅ WebSocket connected - AWS backend active"

## 🔄 If Fix Doesn't Work

### Option 1: Redeploy Everything
```powershell
# Set API key
$env:GEMINI_API_KEY="AIzaSyAEKJc0MlcbbhBbwDij6UEqMQVezwCQfxg"

# Redeploy infrastructure
.\infrastructure\deploy.ps1
```

### Option 2: Manual Lambda Update
```powershell
# Package Lambda
cd lambda
npm install
Compress-Archive -Path websocket-handler.mjs,ai-handler.mjs,package.json,node_modules -DestinationPath dist/lambda.zip -Force
cd ..

# Upload
aws lambda update-function-code --function-name ai-classroom-websocket-handler --zip-file fileb://lambda/dist/lambda.zip --region eu-north-1
aws lambda update-function-code --function-name ai-classroom-ai-handler --zip-file fileb://lambda/dist/lambda.zip --region eu-north-1
```

### Option 3: Check Handler Configuration
```powershell
# Verify handler is set correctly
aws lambda get-function-configuration --function-name ai-classroom-websocket-handler --region eu-north-1 --query 'Handler'
```

Should return: `"websocket-handler.handler"`

If it returns something else, update it:
```powershell
aws lambda update-function-configuration --function-name ai-classroom-websocket-handler --handler websocket-handler.handler --region eu-north-1
```

## 📊 Expected Results After Fix

### Lambda Logs (Before Fix):
```
❌ Error: Cannot find module 'websocket-handler'
❌ Runtime.ImportModuleError
```

### Lambda Logs (After Fix):
```
✅ WebSocket event: {"requestContext":{"connectionId":"..."}}
✅ Action: chat, SessionId: session-123
✅ AI response sent
```

### Browser Console (Before Fix):
```
❌ WebSocket connection failed
⚠️ Using fallback mode
```

### Browser Console (After Fix):
```
✅ WebSocket connected
✅ AWS backend active
🔊 Playing Polly audio
```

## 💡 Why This Happened

The CloudFormation template uses `ZipFile` for initial deployment, which creates a placeholder function. The deployment script then uploads the real code, but the packaging wasn't including all necessary files properly.

The fix script ensures:
1. All dependencies are installed
2. All files are included in the zip
3. The zip is properly structured
4. Lambda can find the handler

## 🎯 Bottom Line

**Run this command to fix everything:**

```powershell
.\fix-lambda.ps1
```

**Then test:**

```powershell
# Open test tool
Start-Process "test-websocket.html"
```

**If it connects ✅, you're good to go!**

If it still doesn't work, the fallback mode ensures your app still functions perfectly with direct Gemini API calls.

---

## 🆘 Still Having Issues?

If the fix doesn't work:

1. **Check AWS credentials**:
   ```powershell
   aws sts get-caller-identity
   ```

2. **Check Lambda exists**:
   ```powershell
   aws lambda list-functions --region eu-north-1 --query 'Functions[?starts_with(FunctionName, `ai-classroom`)].FunctionName'
   ```

3. **Check CloudFormation stack**:
   ```powershell
   aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].StackStatus'
   ```

4. **Redeploy everything**:
   ```powershell
   $env:GEMINI_API_KEY="AIzaSyAEKJc0MlcbbhBbwDij6UEqMQVezwCQfxg"
   .\infrastructure\deploy.ps1
   ```

Remember: Even if AWS Lambda doesn't work, your app will still function perfectly with the fallback mode! 🛡️
