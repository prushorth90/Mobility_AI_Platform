import { query } from '../db/client.js'

export async function listPolicyDocuments() {
  const result = await query(
    `SELECT id, policy_code, title, department, content, updated_at
     FROM policy_documents
     ORDER BY policy_code`,
  )

  return result.rows
}

export async function replaceDocumentChunks(documentId, chunks) {
  await query('DELETE FROM policy_chunks WHERE document_id = $1', [documentId])

  for (const chunk of chunks) {
    await query(
      `INSERT INTO policy_chunks (document_id, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [documentId, chunk.chunkIndex, chunk.content, JSON.stringify(chunk.embedding)],
    )
  }
}

export async function listAllChunksWithDocuments() {
  const result = await query(
    `SELECT
       c.id,
       c.document_id,
       c.chunk_index,
       c.content,
       c.embedding,
       d.policy_code,
       d.title,
       d.department
     FROM policy_chunks c
     JOIN policy_documents d ON d.id = c.document_id`,
  )

  return result.rows
}
