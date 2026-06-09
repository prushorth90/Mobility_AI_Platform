import { readFileSync } from 'fs'
import { resolve } from 'path'
import { closePool, query } from '../db/client.js'

async function run() {
  const sql = readFileSync(resolve(process.cwd(), 'backend/db/seed.sql'), 'utf8')
  await query(sql)
  console.log('Database seeded.')
}

run()
  .catch((error) => {
    console.error('Failed to seed database:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
