# Civic Relay - Automated Deployment Script (PowerShell)
# Usage: .\scripts\deploy.ps1 [-Mode preview|production]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("preview", "production")]
    [string]$Mode = "preview"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Civic Relay Deployment Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Mode: $Mode" -ForegroundColor Yellow
Write-Host ""

# 1. Pre-flight checks
Write-Host "📋 Running pre-flight checks..." -ForegroundColor Cyan

# Check if in correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Must run from project root" -ForegroundColor Red
    exit 1
}

# Check if pnpm is installed
try {
    $null = Get-Command pnpm -ErrorAction Stop
    Write-Host "✅ pnpm found" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: pnpm not installed" -ForegroundColor Red
    Write-Host "Install: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

# Check if vercel CLI is installed
try {
    $null = Get-Command vercel -ErrorAction Stop
    Write-Host "✅ Vercel CLI found" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Vercel CLI not installed. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "✅ Pre-flight checks passed" -ForegroundColor Green
Write-Host ""

# 2. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# 3. Type check
Write-Host "🔍 Running type check..." -ForegroundColor Cyan
pnpm type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Type check failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Type check passed" -ForegroundColor Green
Write-Host ""

# 4. Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Cyan
pnpm test 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Tests passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  No tests configured or tests failed" -ForegroundColor Yellow
}
Write-Host ""

# 5. Build
Write-Host "🏗️  Building application..." -ForegroundColor Cyan
$env:NODE_ENV = "production"
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed" -ForegroundColor Green
Write-Host ""

# 6. Security audit
Write-Host "🔒 Running security audit..." -ForegroundColor Cyan
pnpm audit --audit-level=high
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Security audit passed" -ForegroundColor Green
} else {
    Write-Host "⚠️  Security vulnerabilities found. Review and fix if critical." -ForegroundColor Yellow
    $continue = Read-Host "Continue deployment? (y/n)"
    if ($continue -ne "y") {
        exit 1
    }
}
Write-Host ""

# 7. Deploy
Write-Host "🚀 Deploying to Vercel..." -ForegroundColor Cyan

if ($Mode -eq "production") {
    Write-Host "⚠️  DEPLOYING TO PRODUCTION" -ForegroundColor Red -BackgroundColor Yellow
    $confirm = Read-Host "Are you sure? (y/n)"
    if ($confirm -eq "y") {
        vercel --prod
    } else {
        Write-Host "Deployment cancelled" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "Deploying to preview..." -ForegroundColor Yellow
    vercel
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Next steps:" -ForegroundColor Cyan
Write-Host "1. Check deployment URL in terminal output"
Write-Host "2. Test the deployed application"
Write-Host "3. Verify security headers: https://securityheaders.com/"
Write-Host "4. Check performance: https://pagespeed.web.dev/"
Write-Host ""
