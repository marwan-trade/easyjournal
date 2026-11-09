// Construction du site : un bundle JS + un CSS, copiés avec index.html et les assets dans dist/.
import { build, context } from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });

const options = {
  entryPoints: { app: 'src/main.jsx' },
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch,
  target: ['es2022', 'chrome110', 'safari16', 'firefox110'],
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Surveillance active. Sers le dossier dist/ avec un serveur statique.');
} else {
  await build(options);
}
