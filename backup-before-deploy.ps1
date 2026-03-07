#!/usr/bin/env pwsh
# Backup Script - Create backup before deployment

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   💾 AI Classroom - Backup Script         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if git repository
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: Not a git repository" -ForegroundColor Red
    exit 1
}

# Get current status
$currentCommit = git rev-parse --short HEAD
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$tagName = "backup-$timestamp"

Write-Host "📍 Current commit: $currentCommit" -ForegroundColor Yellow
Write-Host "🏷️  Backup tag: $tagName" -ForegroundColor Yellow
Write-Host ""

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host ""
    git status --short
    Write-Host ""
    
    $commit = Read-Host "Do you want to commit these changes? (yes/no)"
    if ($commit -eq "yes") {
        $message = Read-Host "Enter commit message (or press Enter for default)"
        if (-not $message) {
            $message = "Backup before deployment - $timestamp"
        }
        
        Write-Host ""
        Write-Host "📝 Committing changes..." -ForegroundColor Cyan
        git add .
        git commit -m "$message"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Changes committed" -ForegroundColor Green
            $currentCommit = git rev-parse --short HEAD
        } else {
            Write-Host "   ❌ Commit failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  Proceeding without committing changes" -ForegroundColor Yellow
        Write-Host "   (Backup will only include committed changes)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "💾 Creating backup..." -ForegroundColor Cyan

# Create git tag
try {
    git tag -a "$tagName" -m "Backup before deployment - $timestamp"
    Write-Host "   ✅ Git tag created: $tagName" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Failed to create tag: $_" -ForegroundColor Red
    exit 1
}

# Optional: Download current S3 version
Write-Host ""
$downloadS3 = Read-Host "Do you want to download current S3 version? (yes/no)"
if ($downloadS3 -eq "yes") {
    Write-Host ""
    Write-Host "📥 Downloading from S3..." -ForegroundColor Cyan
    
    $backupDir = "backup-s3-$timestamp"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    try {
        aws s3 sync s3://ai-classroom-frontend-637423421920 "$backupDir" --region eu-north-1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ S3 backup saved to: $backupDir" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  S3 download failed (non-critical)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  S3 download failed: $_" -ForegroundColor Yellow
    }
}

# Log the backup
$logEntry = "$timestamp - Backup created - Tag: $tagName - Commit: $currentCommit"
Add-Content -Path "deployment-log.txt" -Value $logEntry

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ Backup Complete!                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Backup Details:" -ForegroundColor Cyan
Write-Host "   • Tag:    $tagName" -ForegroundColor Gray
Write-Host "   • Commit: $currentCommit" -ForegroundColor Gray
Write-Host "   • Time:   $timestamp" -ForegroundColor Gray
Write-Host ""
Write-Host "🔄 To restore this backup later:" -ForegroundColor Cyan
Write-Host "   git checkout $tagName" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor White
Write-Host "   .\push.ps1" -ForegroundColor White
Write-Host ""
Write-Host "📝 Or use the rollback script:" -ForegroundColor Cyan
Write-Host "   .\rollback.ps1" -ForegroundColor White
Write-Host ""
Write-Host "✅ You can now safely deploy!" -ForegroundColor Green
Write-Host ""
