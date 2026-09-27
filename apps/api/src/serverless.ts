// Entry for serverless hosts (the Vercel Function in /api): same app as main.ts, without
// listen(); the host hands each request to the Fastify instance instead.
import 'reflect-metadata'

export { createApp } from './app'
