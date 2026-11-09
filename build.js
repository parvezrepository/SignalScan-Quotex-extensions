/**
 * SignalScan - ESBuild Production Bundler
 * Compiles modular content scripts into a single, high-performance, minified IIFE bundle.
 * Run with: node build.js
 */

import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function build() {
  console.log('⚡ Building SignalScan Production Bundle...');
  const startTime = Date.now();

  try {
    // 1. Read CSS content to enable zero-flash inlined styling in Shadow DOM
    const cssPath = path.join(__dirname, 'content', 'styles.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

    // 2. Read MHB Logo as Base64 for instant zero-latency loading
    const logoPath = path.join(__dirname, 'icons', 'mhb-logo.jpg');
    const logoBase64 = fs.existsSync(logoPath) ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}` : '';

    // 3. Build Content Script Bundle
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'content', 'content.js')],
      outfile: path.join(__dirname, 'content', 'bundle.js'),
      bundle: true,
      minify: true,
      format: 'iife',
      target: ['chrome100'],
      sourcemap: true,
      define: {
        '__INLINED_STYLES__': JSON.stringify(cssContent),
        '__MHB_LOGO__': JSON.stringify(logoBase64)
      }
    });

    console.log(`  ✓ Built content/bundle.js (${((fs.statSync(path.join(__dirname, 'content', 'bundle.js')).size) / 1024).toFixed(1)} KB)`);

    // 3. Verify Background Service Worker
    const bgPath = path.join(__dirname, 'background', 'service-worker.js');
    if (fs.existsSync(bgPath)) {
      console.log('  ✓ Verified background/service-worker.js');
    }

    console.log(`✨ Build completed successfully in ${Date.now() - startTime}ms!`);
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

build();

