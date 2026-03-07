#!/usr/bin/env pwsh
# Fix Lambda Functions - Redeploy with correct code

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🔧 Fixing Lambda Functions              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$REGION = "eu-north-1"

Write-Host "📦 Step 1: Installing Lambda dependencies..." -ForegroundColor Cyan
Set-Location lambda
if (-not (Test-Path "node_modules")) {
    npm install
} else {
    Write-Host "   ✅ Dependencies already installed" -ForegroundColor Green
}
Set-Location ..

Write-Host ""
Write-Host "📦 Step 2: Creating Lambda deployment packages..." -ForegroundColor Cyan

# Create dist directory
New-Item -ItemType Directory -Force -Path lambda\dist | Out-Null

# Package AI handler
Write-Host "   📦 Packaging ai-handler..." -ForegroundColor Gray
Set-Location lambda
if (Test-Path "dist\ai-handler.zip") {
    Remove-Item "dist\ai-handler.zip" -Force
}
Compress-Archive -Path ai-handler.mjs,package.json,node_modules -DestinationPath dist\ai-handler.zip -Force
Write-Host "   ✅ ai-handler.zip created" -ForegroundColor Green

# Package WebSocket handler
Write-Host "   📦 Packaging websocket-handler..." -ForegroundColor Gray
if (Test-Path "dist\websocket-handler.zip") {
    Remove-Item "dist\websocket-handler.zip" -Force
}
Compress-Archive -Path websocket-handler.mjs,package.json,node_modules -DestinationPath dist\websocket-handler.zip -Force
Write-Host "   ✅ websocket-handler.zip created" -ForegroundColor Green
Set-Location ..

Write-Host ""
Write-Host "📤 Step 3: Uploading Lambda code..." -ForegroundColor Cyan

# Update AI handler
Write-Host "   📤 Updating ai-classroom-ai-handler..." -ForegroundColor Gray
try {
    aws lambda update-function-code `
      --function-name ai-classroom-ai-handler `
      --zip-file fileb://lambda/dist/ai-handler.zip `
      --region eu-north-1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ ai-handler updated" -ForegroundColor Green
    } else {
        throw "Update failed"
    }
} catch {
    Write-Host "   ❌ Failed to update ai-handler: $_" -ForegroundColor Red
    exit 1
}

# Update WebSocket handler
Write-Host "   📤 Updating ai-classroom-websocket-handler..." -ForegroundColor Gray
try {
    aws lambda update-function-code `
      --function-name ai-classroom-websocket-handler `
      --zip-file fileb://lambda/dist/websocket-handler.zip `
      --region eu-north-1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ websocket-handler updated" -ForegroundColor Green
    } else {
        throw "Update failed"
    }
} catch {
    Write-Host "   ❌ Failed to update websocket-handler: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "⏳ Step 4: Waiting for Lambda functions to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "🧪 Step 5: Testing Lambda functions..." -ForegroundColor Cyan

# Test WebSocket handler
Write-Host "   🧪 Testing websocket-handler..." -ForegroundColor Gray
try {
    $testPayload = @{
        requestContext = @{
            connectionId = "test-connection"
            routeKey = "`$connect"
            domainName = "test.execute-api.eu-north-1.amazonaws.com"
            stage = "prod"
        }
        queryStringParameters = @{
            sessionId = "test-session"
            userId = "test-user"
        }
    } | ConvertTo-Json -Compress

    $result = aws lambda invoke `
      --function-name ai-classroom-websocket-handler `
      --payload $testPayload `
      --region $REGION `
      lambda-test-response.json 2>&1

    if ($LASTEXITCODE -eq 0) {
        $response = Get-Content lambda-test-response.json | ConvertFrom-Json
        if ($response.statusCode -eq 200) {
            Write-Host "   ✅ websocket-handler working!" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  websocket-handler returned: $($response.statusCode)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Could not test websocket-handler" -ForegroundColor Yellow
    }
    
    Remove-Item lambda-test-response.json -ErrorAction SilentlyContinue
} catch {
    Write-Host "   ⚠️  Test failed (non-critical): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Lambda Functions Fixed!              ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   • ai-handler:        ✅ Updated" -ForegroundColor Gray
Write-Host "   • websocket-handler: ✅ Updated" -ForegroundColor Gray
Write-Host ""
Write-Host "🧪 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Test WebSocket connection:" -ForegroundColor White
Write-Host "      Open test-websocket.html in browser" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Or deploy frontend and test:" -ForegroundColor White
Write-Host "      .\push.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "💡 Check Lambda logs:" -ForegroundColor Cyan
Write-Host "   aws logs tail /aws/lambda/ai-classroom-websocket-handler --follow --region eu-north-1" -ForegroundColor Gray
Write-Host ""
