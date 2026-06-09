export function chunkText(text, chunkSize = 500, overlap = 100) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return []
  }

  const chunks = []
  let start = 0
  let index = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const slice = normalized.slice(start, end)
    chunks.push({
      chunkIndex: index,
      content: slice,
    })

    index += 1
    if (end === normalized.length) {
      break
    }

    start = Math.max(0, end - overlap)
  }

  return chunks
}
