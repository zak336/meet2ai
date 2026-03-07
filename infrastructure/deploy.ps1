# PowerShell Deployment Script for Windows
$ErrorActionPreference = "Stop"

Write-Host "🚀 AI Classroom - AWS Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Configuration
$REGION = "eu-north-1"
$STACK_NAME = "ai-classroom-stack"
$GEMINI_API_KEY = $env:GEMINI_API_KEY

if (-not $GEMINI_API_KEY) {
    Write-Host "❌ Error: GEMINI_API_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Usage: `$env:GEMINI_API_KEY='your_key'; .\deploy.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Step 1: Installing Lambda dependencies..." -ForegroundColor Green
Set-Location lambda
npm install
Set-Location ..

Write-Host "📦 Step 2: Packaging Lambda functions..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path lambda\dist | Out-Null

# Create zip for ai-handler
Set-Location lambda
Compress-Archive -Path ai-handler.mjs,node_modules,package.json -DestinationPath dist\ai-handler.zip -Force
Compress-Archive -Path websocket-handler.mjs,node_modules,package.json -DestinationPath dist\websocket-handler.zip -Force
Set-Location ..

Write-Host "☁️  Step 3: Deploying CloudFormation stack..." -ForegroundColor Green
aws cloudformation deploy `
  --template-file infrastructure/cloudformation.yaml `
  --stack-name $STACK_NAME `
  --parameter-overrides GeminiApiKey=$GEMINI_API_KEY `
  --capabilities CAPABILITY_NAMED_IAM `
  --region $REGION

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ CloudFormation deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Step 4: Uploading Lambda code..." -ForegroundColor Green

aws lambda update-function-code `
  --function-name ai-classroom-ai-handler `
  --zip-file fileb://lambda/dist/ai-handler.zip `
  --region $REGION

aws lambda update-function-code `
  --function-name ai-classroom-websocket-handler `
  --zip-file fileb://lambda/dist/websocket-handler.zip `
  --region $REGION

Write-Host "📋 Step 5: Getting outputs..." -ForegroundColor Green

$WS_URL = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' `
  --output text

$FRONTEND_BUCKET = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' `
  --output text

$FRONTEND_URL = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' `
  --output text

Write-Host ""
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
Write-Host "WebSocket URL: $WS_URL" -ForegroundColor Cyan
Write-Host "Frontend Bucket: $FRONTEND_BUCKET" -ForegroundColor Cyan
Write-Host "Frontend URL: $FRONTEND_URL" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update .env.local with:" -ForegroundColor White
Write-Host "   VITE_WS_URL=$WS_URL" -ForegroundColor Gray
Write-Host "   VITE_AWS_REGION=$REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Build and deploy frontend:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host "   aws s3 sync dist/ s3://$FRONTEND_BUCKET --delete --region $REGION" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Access your app at: $FRONTEND_URL" -ForegroundColor White
