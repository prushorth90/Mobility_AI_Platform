import { query } from '../db/client.js'

export async function saveCommutePlan({ employeeId, shiftId, estimatedArrivalTime, chargingStop, arrivalBatteryPercent, riskScore, planJson }) {
  const result = await query(
    `INSERT INTO commute_plans (
      employee_id,
      shift_id,
      estimated_arrival_time,
      charging_stop,
      arrival_battery_percent,
      risk_score,
      plan_json
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    RETURNING id, created_at`,
    [
      employeeId || null,
      shiftId || null,
      estimatedArrivalTime || null,
      chargingStop || null,
      arrivalBatteryPercent ?? null,
      riskScore ?? null,
      JSON.stringify(planJson),
    ],
  )

  return result.rows[0]
}
