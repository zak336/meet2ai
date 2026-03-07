#!/bin/bash
set -e

echo "🎨 Deploying Frontend to S3..."

REGION="eu-north-1"
STACK_NAME="ai-classroom-stack"

# Get bucket name from CloudFormation
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

if [ -z "$FRONTEND_BUCKET" ]; then
  echo "❌ Error: Could not find frontend bucket. Is the stack deployed?"
  exit 1
fi

echo "📦 Building frontend..."
npm run build

echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://$FRONTEND_BUCKET --delete --region $REGION

echo "✅ Frontend deployed!"
echo "URL: http://$FRONTEND_BUCKET.s3-website.$REGION.amazonaws.com"
