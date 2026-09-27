// Bundles the compiled API (dist/serverless.js) into one CommonJS file for serverless hosts.
// Why: Vercel's function runtime can't require() ES-module-only packages from CommonJS (it replaces
// Node's module loader), and several dependencies are ES-module-only. Bundling converts them into
// the one file, so nothing ES-module-only is required at run time.
// Kept external: native code, and optional NestJS integrations this API doesn't use (Nest loads
// them only if installed).
import { build } from 'esbuild'

await build({
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist/serverless.bundle.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'warning',
  external: [
    '@node-rs/argon2', // native binaries
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
