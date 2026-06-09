import { Pool } from 'pg'
import { config } from '../config.js'

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required to run backend persistence features')
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
})

export async function query(text, params = []) {
  return pool.query(text, params)
}

export async function closePool() {
  await pool.end()
}
