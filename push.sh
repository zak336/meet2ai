#!/bin/bash
# Quick Deploy Script - Like "git push" for AWS
set -e

echo "🚀 Deploying to AWS..."

# Build
echo "📦 Building..."
npm run build

# Deploy to S3
echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://ai-classroom-frontend-637423421920 --delete --region eu-north-1

echo "✅ Deployed successfully!"
echo "🌐 URL: http://ai-classroom-frontend-637423421920.s3-website.eu-north-1.amazonaws.com"
