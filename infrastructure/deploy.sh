#!/bin/bash
set -e

echo "🚀 AI Classroom - AWS Deployment Script"
echo "========================================"

# Configuration
REGION="eu-north-1"
STACK_NAME="ai-classroom-stack-v2"
GEMINI_API_KEY="${GEMINI_API_KEY}"

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ Error: GEMINI_API_KEY environment variable not set"
  echo "Usage: GEMINI_API_KEY=your_key ./deploy.sh"
  exit 1
fi

echo "📦 Step 1: Installing Lambda dependencies..."
cd lambda
npm install
cd ..

echo "📦 Step 2: Packaging Lambda functions..."
mkdir -p lambda/dist

# Check if zip is available, if not use PowerShell
if command -v zip &> /dev/null; then
  cd lambda
  zip -r dist/ai-handler.zip ai-handler.mjs node_modules package.json
  zip -r dist/websocket-handler.zip websocket-handler.mjs node_modules package.json
  cd ..
else
  echo "Using PowerShell to create zip files..."
  powershell -Command "Compress-Archive -Path lambda/ai-handler.mjs,lambda/node_modules,lambda/package.json -DestinationPath lambda/dist/ai-handler.zip -Force"
  powershell -Command "Compress-Archive -Path lambda/websocket-handler.mjs,lambda/node_modules,lambda/package.json -DestinationPath lambda/dist/websocket-handler.zip -Force"
fi

echo "☁️  Step 3: Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file infrastructure/cloudformation.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides GeminiApiKey=$GEMINI_API_KEY \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $REGION

echo "📤 Step 4: Uploading Lambda code..."
STACK_INFO=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION)

AI_FUNCTION=$(echo $STACK_INFO | jq -r '.Stacks[0].Outputs[] | select(.OutputKey=="AIHandlerFunction") | .OutputValue' || echo "ai-classroom-ai-handler")
WS_FUNCTION=$(echo $STACK_INFO | jq -r '.Stacks[0].Outputs[] | select(.OutputKey=="WebSocketHandlerFunction") | .OutputValue' || echo "ai-classroom-websocket-handler")

aws lambda update-function-code \
  --function-name ai-classroom-ai-handler \
  --zip-file fileb://lambda/dist/ai-handler.zip \
  --region $REGION

aws lambda update-function-code \
  --function-name ai-classroom-websocket-handler \
  --zip-file fileb://lambda/dist/websocket-handler.zip \
  --region $REGION

echo "📋 Step 5: Getting outputs..."
WS_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketURL`].OutputValue' \
  --output text)

FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

FRONTEND_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
  --output text)

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo "WebSocket URL: $WS_URL"
echo "Frontend Bucket: $FRONTEND_BUCKET"
echo "Frontend URL: $FRONTEND_URL"
echo ""
echo "📝 Next steps:"
echo "1. Update .env.local with:"
echo "   VITE_WS_URL=$WS_URL"
echo "   VITE_AWS_REGION=$REGION"
echo ""
echo "2. Build and deploy frontend:"
echo "   npm run build"
echo "   aws s3 sync dist/ s3://$FRONTEND_BUCKET --delete --region $REGION"
echo ""
echo "3. Access your app at: $FRONTEND_URL"
