import { config } from '../config.js'
import { listAllChunksWithDocuments, listPolicyDocuments, replaceDocumentChunks } from '../repositories/policyRepository.js'
import { chunkText } from './chunker.js'
import { buildEmbedding } from './embeddingService.js'

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (!normA || !normB) {
    return 0
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function buildGroundedAnswer(topChunks, query) {
  if (!topChunks.length) {
    return `No grounded policy evidence found for: ${query}`
  }

  const snippets = topChunks.slice(0, 2).map((chunk) => chunk.content)
  return snippets.join(' ')
}

export async function buildPolicyIndex() {
  const docs = await listPolicyDocuments()
  let chunkCount = 0

  for (const doc of docs) {
    const chunks = chunkText(doc.content, config.rag.chunkSize, config.rag.chunkOverlap)
    const chunksWithEmbeddings = []

    for (const chunk of chunks) {
      const embedding = await buildEmbedding(chunk.content)
      chunksWithEmbeddings.push({
        ...chunk,
        embedding,
      })
      chunkCount += 1
    }

    await replaceDocumentChunks(doc.id, chunksWithEmbeddings)
  }

  return {
    documentsIndexed: docs.length,
    chunksIndexed: chunkCount,
  }
}

export async function searchPolicies(query, topK = config.rag.topK) {
  const queryEmbedding = await buildEmbedding(query)
  const chunkRows = await listAllChunksWithDocuments()

  const scored = chunkRows
    .map((row) => ({
      ...row,
      score: cosineSimilarity(queryEmbedding, row.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  const results = scored.map((row) => ({
    id: row.policy_code,
    title: row.title,
    text: row.content,
    citation: {
      policyCode: row.policy_code,
      chunkIndex: row.chunk_index,
      score: Number(row.score.toFixed(4)),
    },
  }))

  return {
    groundedAnswer: buildGroundedAnswer(scored, query),
    results,
  }
}
