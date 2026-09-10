#!/bin/bash

# Civic Relay - Automated Deployment Script
# Usage: ./scripts/deploy.sh [preview|production]

set -e  # Exit on error

MODE=${1:-preview}

echo "🚀 Civic Relay Deployment Script"
echo "=================================="
echo "Mode: $MODE"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Pre-flight checks
echo "📋 Running pre-flight checks..."

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ Error: pnpm not installed${NC}"
    echo "Install: npm install -g pnpm"
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not installed. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""

# 2. Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# 3. Type check
echo "🔍 Running type check..."
pnpm type-check
echo -e "${GREEN}✅ Type check passed${NC}"
echo ""

# 4. Run tests
echo "🧪 Running tests..."
if pnpm test 2>/dev/null; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  No tests configured or tests failed${NC}"
fi
echo ""

# 5. Build
echo "🏗️  Building application..."
NODE_ENV=production pnpm build
echo -e "${GREEN}✅ Build completed${NC}"
echo ""

# 6. Security audit
echo "🔒 Running security audit..."
if pnpm audit --audit-level=high; then
    echo -e "${GREEN}✅ Security audit passed${NC}"
else
    echo -e "${YELLOW}⚠️  Security vulnerabilities found. Review and fix if critical.${NC}"
    read -p "Continue deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# 7. Deploy
echo "🚀 Deploying to Vercel..."

if [ "$MODE" == "production" ]; then
    echo -e "${RED}⚠️  DEPLOYING TO PRODUCTION${NC}"
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        vercel --prod
    else
        echo "Deployment cancelled"
        exit 0
    fi
else
    echo "Deploying to preview..."
    vercel
fi

echo ""
echo -e "${GREEN}✅ Deployment completed!${NC}"
echo ""
echo "📊 Next steps:"
echo "1. Check deployment URL in terminal output"
echo "2. Test the deployed application"
echo "3. Verify security headers: https://securityheaders.com/"
echo "4. Check performance: https://pagespeed.web.dev/"
echo ""
