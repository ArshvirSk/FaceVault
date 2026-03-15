/**
 * Central config — reads from environment variables.
 *
 * Set NEXT_PUBLIC_API_URL in .env.local (frontend) or as a system env var.
 * Defaults to localhost for local development.
 *
 * Examples:
 *   NEXT_PUBLIC_API_URL=http://192.168.1.42:8000   # another device on same LAN
 *   NEXT_PUBLIC_API_URL=https://facevault.example.com  # custom domain
 */
export const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8000'
