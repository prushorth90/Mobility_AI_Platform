import { createHash } from 'crypto'
import { config } from '../config.js'

const LOCAL_DIMENSIONS = 256

function normalizeVector(vec) {
  const magnitude = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0))
  if (!magnitude) {
    return vec
  }
  return vec.map((value) => value / magnitude)
}

function localEmbedding(text) {
  const vector = Array.from({ length: LOCAL_DIMENSIONS }, () => 0)
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest()
    const bucket = digest.readUInt16BE(0) % LOCAL_DIMENSIONS
    const weight = 1 + (token.length % 7)
    vector[bucket] += weight
  }

  return normalizeVector(vector)
}

async function openAiEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.embeddings.openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.embeddings.model,
      input: text,
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI embeddings request failed: ${response.status}`)
  }

  const payload = await response.json()
  return payload.data[0].embedding
}

export async function buildEmbedding(text) {
  if (config.embeddings.provider === 'openai' && config.embeddings.openAiApiKey) {
    try {
      return await openAiEmbedding(text)
    } catch {
      return localEmbedding(text)
    }
  }

  return localEmbedding(text)
}
