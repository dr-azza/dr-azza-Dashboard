/* global URL */
// Bundles the compiled API (dist/serverless.js) into one CommonJS file for serverless hosts.
// Why: Vercel's function runtime can't require() ES-module-only packages from CommonJS (it replaces
// Node's module loader), and several dependencies are ES-module-only. Bundling converts them into
// the one file, so nothing ES-module-only is required at run time. Other hosts (Render, local) run
// the unbundled build on Node 22+, whose loader handles those packages.
//
// Kept external (they must resolve from node_modules at run time; Vercel traces them):
// - native code, and packages that read files next to themselves (bundling would move __dirname);
// - optional NestJS integrations this API doesn't use: Nest requires them only if installed.
// CI starts the bundle with require(esm) off and answers a request, so a missing external or a new
// ES-module-only dependency fails CI, not the live site.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist/serverless.bundle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  // Smaller to parse on every cold start; names kept for Nest (as .swcrc keepClassNames).
  minify: true,
  keepNames: true,
  // Enabled at run time by api/index.js, so logged stack traces point at the source.
  sourcemap: true,
  logLevel: 'warning',
  external: [
    '@node-rs/argon2', // native binaries
    'swagger-ui-dist', // API docs UI (non-production): serves its own files by path
    'class-transformer',
    'class-transformer/*',
    'class-validator',
    '@fastify/view',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/platform-express', // this API runs on Fastify
  ],
})
