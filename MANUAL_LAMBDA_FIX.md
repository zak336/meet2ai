# 🔧 Manual Lambda Fix - Step by Step

## Run These Commands One by One

### Step 1: Go to Lambda Directory
```powershell
cd lambda
```

### Step 2: Install Dependencies (if needed)
```powershell
npm install
```

### Step 3: Create Dist Directory
```powershell
New-Item -ItemType Directory -Force -Path dist
```

### Step 4: Package AI Handler
```powershell
Compress-Archive -Path ai-handler.mjs,package.json,node_modules -DestinationPath dist/ai-handler.zip -Force
```

### Step 5: Package WebSocket Handler
```powershell
Compress-Archive -Path websocket-handler.mjs,package.json,node_modules -DestinationPath dist/websocket-handler.zip -Force
```

### Step 6: Go Back to Root
```powershell
cd ..
```

### Step 7: Upload AI Handler
```powershell
aws lambda update-function-code --function-name ai-classroom-ai-handler --zip-file fileb://lambda/dist/ai-handler.zip --region eu-north-1
```

### Step 8: Upload WebSocket Handler
```powershell
aws lambda update-function-code --function-name ai-classroom-websocket-handler --zip-file fileb://lambda/dist/websocket-handler.zip --region eu-north-1
```

### Step 9: Wait a Few Seconds
```powershell
Start-Sleep -Seconds 5
```

### Step 10: Test WebSocket Handler
```powershell
aws lambda invoke --function-name ai-classroom-websocket-handler --payload '{"requestContext":{"connectionId":"test","routeKey":"$connect","domainName":"test.com","stage":"prod"},"queryStringParameters":{"sessionId":"test","userId":"test"}}' --region eu-north-1 test-response.json
```

### Step 11: Check Response
```powershell
Get-Content test-response.json
```

Should show: `{"statusCode":200,"body":"Connected"}`

### Step 12: Clean Up
```powershell
Remove-Item test-response.json
```

## ✅ All Done!

Now test the WebSocket connection:
```powershell
Start-Process "test-websocket.html"
```

Or deploy and test the full app:
```powershell
.\push.ps1
```
