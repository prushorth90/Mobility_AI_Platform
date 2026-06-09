import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { closePool } from './db/client.js'
import { saveCommutePlan } from './repositories/commuteRepository.js'
import { getEmployeeProfile, getShiftSchedule } from './repositories/employeeRepository.js'
import { getAdminMetrics, logToolCall } from './repositories/toolLogRepository.js'
import { buildPolicyIndex, searchPolicies } from './services/ragService.js'

const app = express()
const PORT = config.port

app.use(cors())
app.use(express.json())

const siteConfig = {
  FRE: {
    name: 'Fremont Factory',
    avgCommuteSpeedMph: 33,
    parkingBufferMinutes: 14,
    chargerDensity: 'High',
  },
  AUS: {
    name: 'Austin Gigafactory',
    avgCommuteSpeedMph: 42,
    parkingBufferMinutes: 11,
    chargerDensity: 'Medium',
  },
  REN: {
    name: 'Reno Gigafactory',
    avgCommuteSpeedMph: 48,
    parkingBufferMinutes: 9,
    chargerDensity: 'Low',
  },
}

const mcpTools = [
  'get_employee_profile(employee_id)',
  'get_shift_schedule(employee_id)',
  'get_vehicle_status(user_id)',
  'find_nearby_chargers(location)',
  'search_people_policy(query)',
  'generate_commute_plan(employee_id, shift_id)',
  'submit_parking_request(employee_id, site_id)',
]

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function createClockLabel(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function calculatePlan({ site, shiftTime, distanceMiles, batteryPercent, trafficMultiplier }) {
  const selectedSite = siteConfig[site]

  if (!selectedSite) {
    throw new Error('Invalid site code')
  }

  const commuteMinutes = (distanceMiles / selectedSite.avgCommuteSpeedMph) * 60 * trafficMultiplier
  const routeEnergyUse = distanceMiles * 0.35
  const reserveTarget = site === 'REN' ? 20 : 16
  const needsChargeStop = batteryPercent - routeEnergyUse < reserveTarget
  const chargeGain = needsChargeStop ? 24 : 0
  const arrivalBattery = clamp(Math.round(batteryPercent - routeEnergyUse + chargeGain), 3, 100)

  const [hourString, minuteString] = shiftTime.split(':')
  const shiftDate = new Date()
  shiftDate.setHours(Number(hourString), Number(minuteString), 0, 0)

  const leaveDate = new Date(
    shiftDate.getTime() - (commuteMinutes + selectedSite.parkingBufferMinutes) * 60_000,
  )

  const weatherPenalty = trafficMultiplier > 1.3 ? 12 : 5
  const lowBatteryPenalty = batteryPercent < 35 ? 18 : 7
  const parkingPenalty = selectedSite.parkingBufferMinutes > 12 ? 14 : 8
  const riskScore = clamp(
    Math.round((weatherPenalty + lowBatteryPenalty + parkingPenalty + distanceMiles / 3) / 1.5),
    8,
    100,
  )

  const chargingStop = needsChargeStop
    ? `${selectedSite.name} corridor Supercharger (12 min top-up)`
    : 'No stop required; direct route recommended'

  const parkingRecommendation =
    selectedSite.parkingBufferMinutes > 12
      ? 'South Lot B - leave 4 min walk buffer'
      : 'Main Employee Deck - standard entry flow'

  const routeSummary = `~${Math.round(commuteMinutes)} min drive, ${selectedSite.chargerDensity.toLowerCase()} charger density, traffic factor ${trafficMultiplier.toFixed(2)}x`

  return {
    leaveBy: createClockLabel(leaveDate),
    arrivalBattery,
    chargingStop,
    riskScore,
    parkingRecommendation,
    routeSummary,
  }
}

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', service: 'peopleops-backend', ts: new Date().toISOString() })
})

app.get('/api/mcp-tools', (_, res) => {
  res.json({ tools: mcpTools })
})

app.get('/api/admin-metrics', (_, res) => {
  getAdminMetrics()
    .then((kpis) => {
      res.json({
        siteRisk: [
          { site: 'Fremont Risk', value: 72 },
          { site: 'Austin Risk', value: 51 },
          { site: 'Reno Risk', value: 63 },
        ],
        kpis,
      })
    })
    .catch(() => {
      res.status(500).json({ error: 'Could not load admin metrics' })
    })
})

app.get('/api/employee/:employeeId/profile', async (req, res) => {
  const started = Date.now()
  const employeeId = String(req.params.employeeId || '')

  try {
    const profile = await getEmployeeProfile(employeeId)
    await logToolCall({
      toolName: 'get_employee_profile',
      inputJson: { employeeId },
      outputJson: { found: Boolean(profile) },
      latencyMs: Date.now() - started,
      status: 'success',
    })

    if (!profile) {
      return res.status(404).json({ error: 'Employee not found' })
    }

    return res.json({ profile })
  } catch {
    await logToolCall({
      toolName: 'get_employee_profile',
      inputJson: { employeeId },
      outputJson: {},
      latencyMs: Date.now() - started,
      status: 'failed',
    })

    return res.status(500).json({ error: 'Could not load employee profile' })
  }
})

app.get('/api/employee/:employeeId/shift', async (req, res) => {
  const started = Date.now()
  const employeeId = String(req.params.employeeId || '')

  try {
    const shift = await getShiftSchedule(employeeId)
    await logToolCall({
      toolName: 'get_shift_schedule',
      inputJson: { employeeId },
      outputJson: { found: Boolean(shift) },
      latencyMs: Date.now() - started,
      status: 'success',
    })

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' })
    }

    return res.json({ shift })
  } catch {
    await logToolCall({
      toolName: 'get_shift_schedule',
      inputJson: { employeeId },
      outputJson: {},
      latencyMs: Date.now() - started,
      status: 'failed',
    })

    return res.status(500).json({ error: 'Could not load shift schedule' })
  }
})

app.post('/api/commute-plan', (req, res) => {
  const started = Date.now()
  ;(async () => {
    const payload = req.body

    const site = String(payload.site || '')
    const shiftTime = String(payload.shiftTime || '')
    const distanceMiles = Number(payload.distanceMiles)
    const batteryPercent = Number(payload.batteryPercent)
    const trafficMultiplier = Number(payload.trafficMultiplier)

    if (!siteConfig[site] || !/^\d{2}:\d{2}$/.test(shiftTime)) {
      return res.status(400).json({ error: 'Invalid site or shift time' })
    }

    if (
      Number.isNaN(distanceMiles) ||
      Number.isNaN(batteryPercent) ||
      Number.isNaN(trafficMultiplier)
    ) {
      return res.status(400).json({ error: 'Invalid numeric fields' })
    }

    const plan = calculatePlan({
      site,
      shiftTime,
      distanceMiles: clamp(distanceMiles, 2, 120),
      batteryPercent: clamp(batteryPercent, 5, 100),
      trafficMultiplier: clamp(trafficMultiplier, 1, 1.8),
    })

    await saveCommutePlan({
      employeeId: payload.employeeId,
      shiftId: payload.shiftId,
      estimatedArrivalTime: null,
      chargingStop: plan.chargingStop,
      arrivalBatteryPercent: plan.arrivalBattery,
      riskScore: plan.riskScore,
      planJson: {
        ...plan,
        input: {
          site,
          shiftTime,
          distanceMiles,
          batteryPercent,
          trafficMultiplier,
        },
      },
    })

    await logToolCall({
      toolName: 'generate_commute_plan',
      inputJson: payload,
      outputJson: plan,
      latencyMs: Date.now() - started,
      status: 'success',
    })

    return res.json({ plan })
  })().catch(async () => {
    await logToolCall({
      toolName: 'generate_commute_plan',
      inputJson: req.body || {},
      outputJson: {},
      latencyMs: Date.now() - started,
      status: 'failed',
    })

    res.status(500).json({ error: 'Could not generate commute plan' })
  })
})

app.post('/api/policy-search', async (req, res) => {
  const started = Date.now()
  const query = String(req.body?.query || '').trim()

  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }

  try {
    const ragResult = await searchPolicies(query)
    await logToolCall({
      toolName: 'search_people_policy',
      inputJson: { query },
      outputJson: { resultCount: ragResult.results.length },
      latencyMs: Date.now() - started,
      status: 'success',
    })

    return res.json(ragResult)
  } catch {
    await logToolCall({
      toolName: 'search_people_policy',
      inputJson: { query },
      outputJson: {},
      latencyMs: Date.now() - started,
      status: 'failed',
    })

    return res.status(500).json({ error: 'Could not complete policy retrieval' })
  }
})

app.post('/api/rag/reindex', async (_, res) => {
  try {
    const stats = await buildPolicyIndex()
    return res.json({ status: 'ok', ...stats })
  } catch {
    return res.status(500).json({ error: 'Could not build policy index' })
  }
})

app.listen(PORT, () => {
  console.log(`PeopleOps backend listening on http://localhost:${PORT}`)
})

process.on('SIGINT', async () => {
  await closePool()
  process.exit(0)
})
