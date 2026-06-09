import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT || 8080),
  databaseUrl: process.env.DATABASE_URL || '',
  rag: {
    chunkSize: Number(process.env.RAG_CHUNK_SIZE || 500),
    chunkOverlap: Number(process.env.RAG_CHUNK_OVERLAP || 100),
    topK: Number(process.env.RAG_TOP_K || 4),
  },
  embeddings: {
    provider: process.env.EMBEDDINGS_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'local'),
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    openAiApiKey: process.env.OPENAI_API_KEY || '',
  },
}
