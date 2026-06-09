import { query } from '../db/client.js'

export async function getEmployeeProfile(employeeId) {
  const result = await query(
    `SELECT id, name, site, role, shift_id, parking_eligibility, vehicle_connected, home_location
     FROM employees
     WHERE id = $1`,
    [employeeId],
  )

  return result.rows[0] || null
}

export async function getShiftSchedule(employeeId) {
  const result = await query(
    `SELECT s.id, s.site, s.start_time, s.end_time, s.team
     FROM employees e
     JOIN shifts s ON e.shift_id = s.id
     WHERE e.id = $1`,
    [employeeId],
  )

  return result.rows[0] || null
}
