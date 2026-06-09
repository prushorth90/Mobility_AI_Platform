import { closePool } from '../db/client.js'
import { buildPolicyIndex } from '../services/ragService.js'

async function run() {
  const stats = await buildPolicyIndex()
  console.log('RAG index built:', stats)
}

run()
  .catch((error) => {
    console.error('Failed to rebuild RAG index:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closePool()
  })
