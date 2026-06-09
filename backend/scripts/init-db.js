import { readFileSync } from 'fs'
import { resolve } from 'path'
import { closePool, query } from '../db/client.js'

async function run() {
  const sql = readFileSync(resolve(process.cwd(), 'backend/db/schema.sql'), 'utf8')
  await query(sql)
  console.log('Database schema initialized.')
}

run()
  .catch((error) => {
    console.error('Failed to initialize schema:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
