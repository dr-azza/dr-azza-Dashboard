import { z } from 'zod'

/** Environment contract. The API refuses to start if any value is missing or malformed. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  /** How long a staff session stays valid without activity. */
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  /** Local folder for uploaded files in development. Production will use object storage. */
  STORAGE_DIR: z.string().default('./storage'),
  /**
   * Where uploaded files live: a local folder, or the database (for hosts whose disk is wiped on
   * restart, such as free test deployments).
   */
  STORAGE_DRIVER: z.enum(['local', 'database']).default('local'),
  /**
   * Connections per API process. Serverless hosts run many small copies, so they use a few each
   * (and the database's pooled endpoint); a single long-running server can use more.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  /** Largest upload accepted; hosts with a smaller request limit (Vercel: 4.5 MB) set it lower. */
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(50 * 1024 * 1024)
    .optional(),
  /** Built web app to serve from the same origin (production); unset in development (Vite serves it). */
  WEB_DIST: z.string().optional(),
  /**
   * Proxies in front of the API whose X-Forwarded-For may be trusted (0 = none). Rate limits
   * key on the client IP, so trusting a header nobody sets lets clients pick their own IP.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  return parsed.data
}

/** Injection token for the validated environment. */
export const ENV = Symbol('ENV')
