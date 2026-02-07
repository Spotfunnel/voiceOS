#!/usr/bin/env node
/**
 * Boundary Enforcement Check
 * 
 * Ensures public site doesn't import dashboard/database code,
 * and dashboards don't import public site code.
 * 
 * Run: node scripts/check-boundaries.js
 * CI: npm run lint:boundaries
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const ROOT = path.join(__dirname, '..');

const FORBIDDEN_IMPORTS_PUBLIC = [
  { pattern: /@supabase/, message: 'Public site cannot import Supabase' },
  { pattern: /supabase(?!\.com)/, message: 'Public site cannot import Supabase' },
  { pattern: /apps\/web/, message: 'Public site cannot import from dashboard app' },
  { pattern: /\.\.\/\.\.\/web/, message: 'Public site cannot import from dashboard app' },
  { pattern: /admin_control_panel/, message: 'Public site cannot import admin control panel' },
  { pattern: /customer_dashboard/, message: 'Public site cannot import customer dashboard' },
  { pattern: /prisma/, message: 'Public site cannot import database ORM' },
  { pattern: /typeorm/, message: 'Public site cannot import database ORM' },
  { pattern: /['"]pg['"]/, message: 'Public site cannot import pg database client' },
  { pattern: /\/server\/session/, message: 'Public site cannot import session logic' },
  { pattern: /\/contexts\//, message: 'Public site cannot import dashboard contexts' },
];

const FORBIDDEN_IMPORTS_WEB = [
  { pattern: /apps\/public-site/, message: 'Dashboard cannot import from public site' },
  { pattern: /\.\.\/\.\.\/public-site/, message: 'Dashboard cannot import from public site' },
];

function checkFile(filePath, forbiddenRules, context) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let hasViolation = false;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
        forbiddenRules.forEach(({ pattern, message }) => {
          if (pattern.test(line)) {
            console.error(`\n❌ BOUNDARY VIOLATION`);
            console.error(`   File: ${filePath}:${idx + 1}`);
            console.error(`   Context: ${context}`);
            console.error(`   Reason: ${message}`);
            console.error(`   Line: ${trimmed}\n`);
            hasViolation = true;
          }
        });
      }
    });

    return hasViolation;
  } catch (err) {
    // Skip files that can't be read
    return false;
  }
}

async function main() {
  console.log('🔍 Checking boundary enforcement...\n');
  
  let violations = 0;

  // Check public site
  console.log('Checking apps/public-site/...');
  const publicFiles = await glob('apps/public-site/**/*.{ts,tsx,js,jsx}', {
    cwd: ROOT,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  });
  
  for (const file of publicFiles) {
    const fullPath = path.join(ROOT, file);
    if (checkFile(fullPath, FORBIDDEN_IMPORTS_PUBLIC, 'Public site must not import dashboard/db')) {
      violations++;
    }
  }

  // Check web app
  console.log('Checking apps/web/...');
  const webFiles = await glob('apps/web/**/*.{ts,tsx,js,jsx}', {
    cwd: ROOT,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  });
  
  for (const file of webFiles) {
    const fullPath = path.join(ROOT, file);
    if (checkFile(fullPath, FORBIDDEN_IMPORTS_WEB, 'Dashboard must not import public site')) {
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n❌ Boundary checks FAILED with ${violations} violation(s).\n`);
    console.error('Fix violations above before committing.\n');
    process.exit(1);
  } else {
    console.log('\n✅ Boundary checks PASSED. No violations found.\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Error running boundary checks:', err);
  process.exit(1);
});
