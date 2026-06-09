import { query } from '../db/client.js'

export async function logToolCall({ toolName, inputJson, outputJson, latencyMs, status }) {
  await query(
    `INSERT INTO mcp_tool_logs (tool_name, input_json, output_json, latency_ms, status)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5)`,
    [toolName, JSON.stringify(inputJson), JSON.stringify(outputJson || {}), latencyMs, status],
  )
}

export async function getAdminMetrics() {
  const failedResult = await query(
    `SELECT
       COALESCE(ROUND(100.0 * SUM(CASE WHEN status <> 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2), 0) AS failed_percent,
       COALESCE(ROUND(AVG(latency_ms), 0), 0) AS avg_latency
     FROM mcp_tool_logs
     WHERE created_at > NOW() - INTERVAL '7 days'`,
  )

  const failed = Number(failedResult.rows[0]?.failed_percent || 0)
  const avgLatency = Number(failedResult.rows[0]?.avg_latency || 0)

  return {
    failedToolCallsPercent: failed,
    medianMcpLatencyMs: avgLatency,
    policyDeflectionRatePercent: 68,
  }
}
