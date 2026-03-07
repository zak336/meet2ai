#!/usr/bin/env pwsh
# Rollback Script - Revert to previous version and redeploy

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   🔄 AI Classroom - Rollback Script       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not a git repository" -ForegroundColor Red
    exit 1
}

# Show current commit
$currentCommit = git rev-parse --short HEAD
$currentMessage = git log -1 --pretty=%B
Write-Host "📍 Current commit: $currentCommit" -ForegroundColor Yellow
Write-Host "   Message: $currentMessage" -ForegroundColor Gray
Write-Host ""

# Show previous commit
$previousCommit = git rev-parse --short HEAD~1
$previousMessage = git log -1 --pretty=%B HEAD~1
Write-Host "⏮️  Previous commit: $previousCommit" -ForegroundColor Yellow
Write-Host "   Message: $previousMessage" -ForegroundColor Gray
Write-Host ""

# Confirm rollback
$confirm = Read-Host "Do you want to rollback to the previous commit? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Rollback cancelled" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔄 Starting rollback process..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Revert git changes
Write-Host "1️⃣  Reverting git changes..." -ForegroundColor Cyan
try {
    git reset --hard HEAD~1
    Write-Host "   ✅ Git reverted to: $previousCommit" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Git revert failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Clean and install dependencies
Write-Host "2️⃣  Checking dependencies..." -ForegroundColor Cyan
if (Test-Path "node_modules") {
    Write-Host "   ✅ Dependencies already installed" -ForegroundColor Green
} else {
    Write-Host "   📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host ""

# Step 3: Build
Write-Host "3️⃣  Building application..." -ForegroundColor Cyan
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "   ✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Build failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  Rollback incomplete. You may need to:" -ForegroundColor Yellow
    Write-Host "   1. Check for build errors" -ForegroundColor Yellow
    Write-Host "   2. Fix any issues" -ForegroundColor Yellow
    Write-Host "   3. Run: npm run build" -ForegroundColor Yellow
    Write-Host "   4. Run: .\push.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 4: Deploy
Write-Host "4️⃣  Deploying to AWS..." -ForegroundColor Cyan
try {
    & ".\push.ps1"
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }
    Write-Host "   ✅ Deployment successful" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  Build succeeded but deployment failed." -ForegroundColor Yellow
    Write-Host "   You can manually deploy with: .\push.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Rollback Complete!                   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "   • Reverted from: $currentCommit" -ForegroundColor Gray
Write-Host "   • Reverted to:   $previousCommit" -ForegroundColor Gray
Write-Host "   • Build:         ✅ Success" -ForegroundColor Gray
Write-Host "   • Deploy:        ✅ Success" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Your app is now live at:" -ForegroundColor Cyan
Write-Host "   https://d2a1z182a2prw4.cloudfront.net" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tip: Wait 2-3 minutes for CloudFront cache to clear" -ForegroundColor Yellow
Write-Host ""
