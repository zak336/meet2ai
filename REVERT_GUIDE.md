# 🔄 Revert Guide - Safe Rollback Procedures

## ✅ Why It's Safe to Deploy

1. **Git tracks all changes** - You can always go back
2. **S3 stores old versions** - Previous builds are kept
3. **Only frontend changes** - Backend (Lambda) stays the same
4. **No data loss** - DynamoDB and cache are separate

## 🚀 Before You Deploy - Create Backup

```powershell
# 1. Commit current state to git
git add .
git commit -m "Backup before AWS integration test"

# 2. Create a backup tag
git tag -a backup-$(Get-Date -Format "yyyy-MM-dd-HHmm") -m "Backup before deployment"

# 3. Download current S3 version (optional)
aws s3 sync s3://ai-classroom-frontend-637423421920 ./backup-s3 --region eu-north-1
```

## 🔄 Revert Methods

### Method 1: Git Revert (Recommended)

If the new version doesn't work, revert the code and redeploy:

```powershell
# 1. Check git history
git log --oneline -5

# 2. Revert to previous commit
git revert HEAD
# Or go back to specific commit:
# git reset --hard <commit-hash>

# 3. Rebuild and redeploy
npm run build
.\push.ps1
```

**Time to revert**: ~2-3 minutes

### Method 2: S3 Version Restore

S3 keeps previous versions of files:

```powershell
# 1. List previous versions
aws s3api list-object-versions --bucket ai-classroom-frontend-637423421920 --prefix index.html --region eu-north-1

# 2. Restore specific version
aws s3api copy-object --bucket ai-classroom-frontend-637423421920 --copy-source ai-classroom-frontend-637423421920/index.html?versionId=<version-id> --key index.html --region eu-north-1

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E1443GJZ27XXP6 --paths "/*" --region eu-north-1
```

**Time to revert**: ~1-2 minutes + CloudFront propagation (5-10 min)

### Method 3: Quick Rollback Script

I'll create an automated rollback script for you:

```powershell
# Save this as rollback.ps1
# Reverts to last git commit and redeploys

Write-Host "🔄 Starting rollback..." -ForegroundColor Yellow

# Revert git changes
git reset --hard HEAD~1

# Rebuild
Write-Host "📦 Building..." -ForegroundColor Cyan
npm run build

# Deploy
Write-Host "🚀 Deploying previous version..." -ForegroundColor Cyan
.\push.ps1

Write-Host "✅ Rollback complete!" -ForegroundColor Green
Write-Host "Check: https://d2a1z182a2prw4.cloudfront.net" -ForegroundColor Cyan
```

**Time to revert**: ~2-3 minutes (automated)

## 🧪 Test Before Full Deployment

### Option 1: Test Locally First

```powershell
# Run dev server locally
npm run dev

# Test at http://localhost:5173
# If it works locally, it will work on AWS
```

### Option 2: Deploy to Test Environment

If you want to be extra safe, create a test stack:

```powershell
# Deploy separate test stack
aws cloudformation create-stack --stack-name ai-classroom-test --template-body file://infrastructure/cloudformation.yaml --parameters ParameterKey=GeminiApiKey,ParameterValue=$env:GEMINI_API_KEY --capabilities CAPABILITY_IAM --region eu-north-1

# Test on test stack first
# Then deploy to production
```

## 📊 What Changes When You Deploy

### Files That Change:
- ✅ `dist/` folder contents (built files)
- ✅ S3 bucket contents (static files)
- ✅ CloudFront cache (cleared automatically)

### What DOESN'T Change:
- ❌ Lambda functions (no changes)
- ❌ DynamoDB tables (no changes)
- ❌ API Gateway (no changes)
- ❌ CloudFormation stack (no changes)

**This means**: Only frontend code changes, backend stays the same!

## 🛡️ Safety Checklist

Before deploying, verify:

```powershell
# ✅ Check build succeeds
npm run build

# ✅ Check no TypeScript errors
npm run build 2>&1 | Select-String "error"

# ✅ Check git is clean or committed
git status

# ✅ Check AWS credentials work
aws sts get-caller-identity

# ✅ Check CloudFormation stack exists
aws cloudformation describe-stacks --stack-name ai-classroom-stack --region eu-north-1 --query 'Stacks[0].StackStatus'
```

If all checks pass ✅, it's safe to deploy!

## 🚨 Emergency Rollback (Instant)

If something goes wrong immediately after deployment:

```powershell
# 1. Stop CloudFront from serving new version
aws cloudfront create-invalidation --distribution-id E1443GJZ27XXP6 --paths "/*" --region eu-north-1

# 2. Revert git
git reset --hard HEAD~1

# 3. Redeploy old version
npm run build
.\push.ps1
```

**Total time**: ~3-5 minutes

## 📝 Deployment Log

Keep a log of deployments:

```powershell
# Before each deployment, log it
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commit = git rev-parse --short HEAD
Add-Content -Path "deployment-log.txt" -Value "$timestamp - Deploying commit $commit"

# After deployment
Add-Content -Path "deployment-log.txt" -Value "$timestamp - Deployment complete"
```

## 🎯 Recommended Deployment Process

```powershell
# 1. Backup current state
git add .
git commit -m "Pre-deployment backup"
git tag backup-$(Get-Date -Format "yyyyMMdd-HHmm")

# 2. Test locally
npm run dev
# Test in browser, verify everything works

# 3. Build
npm run build
# Check for errors

# 4. Deploy
.\push.ps1

# 5. Test deployed version
Start-Process "https://d2a1z182a2prw4.cloudfront.net"
# Open browser console, check for errors

# 6. If something is wrong, rollback:
# git reset --hard HEAD~1
# npm run build
# .\push.ps1
```

## 💡 Pro Tips

1. **Always commit before deploying**
   ```powershell
   git add .
   git commit -m "Before deployment"
   ```

2. **Test in incognito/private window**
   - Avoids cache issues
   - Fresh session

3. **Check browser console immediately**
   - Look for errors
   - Verify WebSocket connection

4. **Keep deployment log**
   - Track what was deployed when
   - Easier to debug issues

## 🔍 Verify Deployment Success

After deploying, check these:

```powershell
# 1. Check S3 upload timestamp
aws s3 ls s3://ai-classroom-frontend-637423421920/ --region eu-north-1 | Select-String "index.html"

# 2. Check CloudFront invalidation status
aws cloudfront list-invalidations --distribution-id E1443GJZ27XXP6 --region eu-north-1

# 3. Test the URL
curl https://d2a1z182a2prw4.cloudfront.net -I
```

## ✅ Bottom Line

**It's VERY safe to deploy because:**

1. ✅ Git tracks everything - instant revert
2. ✅ Only frontend changes - backend unchanged
3. ✅ S3 keeps versions - can restore
4. ✅ No database changes - no data loss
5. ✅ Rollback takes 2-3 minutes
6. ✅ Local testing available first

**You can confidently deploy and revert if needed!**

---

## 🚀 Ready to Deploy?

```powershell
# Create backup
git add .
git commit -m "Backup before AWS integration test"

# Deploy
.\push.ps1

# If it doesn't work, rollback:
# git reset --hard HEAD~1
# npm run build
# .\push.ps1
```

**Deploy with confidence!** 🎓✨
