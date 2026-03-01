import { cpSync, mkdirSync } from 'node:fs';
import * as esbuild from 'esbuild';
import { postcssPlugin } from './postcss-plugin';

const isProduction = process.env.NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

const common: esbuild.BuildOptions = {
  bundle: true,
  minify: isProduction,
  sourcemap: !isProduction,
  target: ['chrome120'],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
  logLevel: 'info',
};

mkdirSync('dist', { recursive: true });

if (isWatch) {
  // Watch mode: use esbuild contexts
  const [bgCtx, contentCtx, inpageCtx, popupCtx] = await Promise.all([
    esbuild.context({
      ...common,
      entryPoints: ['src/entrypoints/background.ts'],
      outfile: 'dist/background.js',
      format: 'esm',
    }),
    esbuild.context({
      ...common,
      entryPoints: ['src/entrypoints/content.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),
    esbuild.context({
      ...common,
      entryPoints: ['src/entrypoints/inpage.ts'],
      outfile: 'dist/inpage.js',
      format: 'iife',
    }),
    esbuild.context({
      ...common,
      entryPoints: ['src/entrypoints/popup.tsx'],
      outfile: 'dist/popup.js',
      format: 'esm',
      plugins: [postcssPlugin()],
      loader: { '.tsx': 'tsx', '.ts': 'ts', '.svg': 'dataurl' },
    }),
  ]);

  await Promise.all([bgCtx.watch(), contentCtx.watch(), inpageCtx.watch(), popupCtx.watch()]);
  console.log('[megawallet] watching for changes...');
} else {
  // One-shot build
  await Promise.all([
    esbuild.build({
      ...common,
      entryPoints: ['src/entrypoints/background.ts'],
      outfile: 'dist/background.js',
      format: 'esm',
    }),
    esbuild.build({
      ...common,
      entryPoints: ['src/entrypoints/content.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),
    esbuild.build({
      ...common,
      entryPoints: ['src/entrypoints/inpage.ts'],
      outfile: 'dist/inpage.js',
      format: 'iife',
    }),
    esbuild.build({
      ...common,
      entryPoints: ['src/entrypoints/popup.tsx'],
      outfile: 'dist/popup.js',
      format: 'esm',
      plugins: [postcssPlugin()],
      loader: { '.tsx': 'tsx', '.ts': 'ts', '.svg': 'dataurl' },
    }),
  ]);
}

// Copy static assets to dist
cpSync('public/manifest.json', 'dist/manifest.json');
cpSync('public/popup.html', 'dist/popup.html');
cpSync('public/icons', 'dist/icons', { recursive: true });

console.log('[megawallet] build complete');
