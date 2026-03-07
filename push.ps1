# Quick Deploy Script - Like "git push" for AWS
Write-Host "Deploying to AWS..." -ForegroundColor Cyan

# Build
Write-Host "Building..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Deploy to S3
Write-Host "Uploading to S3..." -ForegroundColor Yellow
aws s3 sync dist/ s3://ai-classroom-frontend-637423421920 --delete --region eu-north-1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployed successfully!" -ForegroundColor Green
    Write-Host "URL: http://ai-classroom-frontend-637423421920.s3-website.eu-north-1.amazonaws.com" -ForegroundColor Cyan
} else {
    Write-Host "Deploy failed!" -ForegroundColor Red
    exit 1
}
