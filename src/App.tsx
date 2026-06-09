import { useMemo, useState } from 'react'
import './App.css'

type SiteCode = 'FRE' | 'AUS' | 'REN'

type SiteConfig = {
  name: string
  avgCommuteSpeedMph: number
  parkingBufferMinutes: number
  chargerDensity: 'High' | 'Medium' | 'Low'
}

type PlanResult = {
  leaveBy: string
  arrivalBattery: number
  chargingStop: string
  riskScore: number
  parkingRecommendation: string
  routeSummary: string
}

const sites: Record<SiteCode, SiteConfig> = {
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

const policySnippets = [
  {
    id: 'PO-13.4',
    title: 'Shift Arrival and Attendance',
    text: 'Employees are expected to badge in by shift start time. A 10-minute planned arrival buffer is recommended for high-volume sites.',
  },
  {
    id: 'PO-21.2',
    title: 'Charging Reimbursement',
    text: 'Eligible commute charging reimbursements require documented charging sessions on approved partner networks or Tesla-owned stations.',
  },
  {
    id: 'PO-9.7',
    title: 'Parking Priority Rules',
    text: 'Parking eligibility and lot assignment depend on shift window, role-critical badge status, and temporary accommodation requests.',
  },
]

const mcpTools = [
  'get_employee_profile(employee_id)',
  'get_shift_schedule(employee_id)',
  'get_vehicle_status(user_id)',
  'find_nearby_chargers(location)',
  'search_people_policy(query)',
  'generate_commute_plan(employee_id, shift_id)',
  'submit_parking_request(employee_id, site_id)',
]

function toClockLabel(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function clampScore(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function App() {
  const [site, setSite] = useState<SiteCode>('FRE')
  const [shiftTime, setShiftTime] = useState('07:00')
  const [distanceMiles, setDistanceMiles] = useState(24)
  const [batteryPercent, setBatteryPercent] = useState(42)
  const [trafficMultiplier, setTrafficMultiplier] = useState(1.25)
  const [policyQuery, setPolicyQuery] = useState('Can I expense a charging stop on my way to shift?')

  const plan = useMemo<PlanResult>(() => {
    const selectedSite = sites[site]
    const commuteMinutes = (distanceMiles / selectedSite.avgCommuteSpeedMph) * 60 * trafficMultiplier
    const routeEnergyUse = distanceMiles * 0.35
    const reserveTarget = site === 'REN' ? 20 : 16
    const needsChargeStop = batteryPercent - routeEnergyUse < reserveTarget
    const chargeGain = needsChargeStop ? 24 : 0
    const arrivalBattery = clampScore(Math.round(batteryPercent - routeEnergyUse + chargeGain), 3, 100)

    const [hourString, minuteString] = shiftTime.split(':')
    const shiftDate = new Date()
    shiftDate.setHours(Number(hourString), Number(minuteString), 0, 0)

    const leaveDate = new Date(
      shiftDate.getTime() - (commuteMinutes + selectedSite.parkingBufferMinutes) * 60_000,
    )

    const weatherPenalty = trafficMultiplier > 1.3 ? 12 : 5
    const lowBatteryPenalty = batteryPercent < 35 ? 18 : 7
    const parkingPenalty = selectedSite.parkingBufferMinutes > 12 ? 14 : 8
    const riskScore = clampScore(
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
      leaveBy: toClockLabel(leaveDate),
      arrivalBattery,
      chargingStop,
      riskScore,
      parkingRecommendation,
      routeSummary,
    }
  }, [batteryPercent, distanceMiles, shiftTime, site, trafficMultiplier])

  const matchedPolicies = useMemo(() => {
    const query = policyQuery.toLowerCase()
    return policySnippets.filter((item) => {
      const haystack = `${item.title} ${item.text}`.toLowerCase()
      return query.split(' ').some((token) => token.length > 3 && haystack.includes(token))
    })
  }, [policyQuery])

  return (
    <main className="page-shell">
      <div className="bg-grid" />
      <section className="hero">
        <p className="eyebrow">Tesla PeopleOps Command Surface</p>
        <h1>Commute + Charging Copilot</h1>
        <p className="hero-subtitle">
          Plan shift arrival, battery safety, parking, and policy guidance from one internal dashboard.
        </p>
      </section>

      <section className="layout-grid">
        <article className="panel planner-panel">
          <h2>Employee Commute Planner</h2>
          <p className="panel-subtitle">Simulate tomorrow&apos;s commute using site constraints and battery state.</p>

          <div className="field-grid">
            <label>
              Site
              <select value={site} onChange={(event) => setSite(event.target.value as SiteCode)}>
                <option value="FRE">Fremont Factory</option>
                <option value="AUS">Austin Gigafactory</option>
                <option value="REN">Reno Gigafactory</option>
              </select>
            </label>

            <label>
              Shift Start
              <input
                type="time"
                value={shiftTime}
                onChange={(event) => setShiftTime(event.target.value)}
              />
            </label>

            <label>
              Distance (miles)
              <input
                type="number"
                min={2}
                max={120}
                value={distanceMiles}
                onChange={(event) => setDistanceMiles(Number(event.target.value))}
              />
            </label>

            <label>
              Current Battery (%)
              <input
                type="number"
                min={5}
                max={100}
                value={batteryPercent}
                onChange={(event) => setBatteryPercent(Number(event.target.value))}
              />
            </label>
          </div>

          <label className="slider-wrap">
            Traffic + Weather Pressure: <strong>{trafficMultiplier.toFixed(2)}x</strong>
            <input
              type="range"
              min={1}
              max={1.8}
              step={0.05}
              value={trafficMultiplier}
              onChange={(event) => setTrafficMultiplier(Number(event.target.value))}
            />
          </label>

          <div className="result-grid">
            <div className="metric-card">
              <span>Leave By</span>
              <strong>{plan.leaveBy}</strong>
            </div>
            <div className="metric-card">
              <span>Arrival Battery</span>
              <strong>{plan.arrivalBattery}%</strong>
            </div>
            <div className="metric-card wide">
              <span>Charging Plan</span>
              <strong>{plan.chargingStop}</strong>
            </div>
            <div className="metric-card wide">
              <span>Parking Recommendation</span>
              <strong>{plan.parkingRecommendation}</strong>
            </div>
            <div className="metric-card wide">
              <span>Route Summary</span>
              <strong>{plan.routeSummary}</strong>
            </div>
          </div>
        </article>

        <article className="panel risk-panel">
          <h2>Shift Arrival Risk</h2>
          <div className="risk-gauge" style={{ ['--risk' as string]: `${plan.riskScore}` }}>
            <span>{plan.riskScore}</span>
            <p>Composite risk score</p>
          </div>

          <ul className="risk-notes">
            <li>Battery threshold check adapts by site charging density.</li>
            <li>Parking ingress buffer included in leave-time recommendation.</li>
            <li>Traffic multiplier increases both commute and delay risk.</li>
          </ul>

          <h3>MCP Tool Surface</h3>
          <div className="tool-list">
            {mcpTools.map((tool) => (
              <code key={tool}>{tool}</code>
            ))}
          </div>
        </article>
      </section>

      <section className="layout-grid lower-grid">
        <article className="panel policy-panel">
          <h2>RAG PeopleOps Assistant</h2>
          <p className="panel-subtitle">Grounded answers with policy citations.</p>

          <textarea
            value={policyQuery}
            onChange={(event) => setPolicyQuery(event.target.value)}
            rows={4}
          />

          <div className="policy-results">
            {matchedPolicies.length > 0 ? (
              matchedPolicies.map((item) => (
                <div key={item.id} className="policy-card">
                  <p className="policy-id">{item.id}</p>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))
            ) : (
              <div className="policy-card">
                <p className="policy-id">NO MATCH</p>
                <h3>No grounded citation found</h3>
                <p>Escalate to PeopleOps and log an unresolved policy question through MCP.</p>
              </div>
            )}
          </div>
        </article>

        <article className="panel analytics-panel">
          <h2>Admin Snapshot</h2>
          <p className="panel-subtitle">Mock telemetry for unresolved requests and commute risk by site.</p>

          <div className="bars">
            <div className="bar-item">
              <span>Fremont Risk</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: '72%' }} />
              </div>
            </div>
            <div className="bar-item">
              <span>Austin Risk</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: '51%' }} />
              </div>
            </div>
            <div className="bar-item">
              <span>Reno Risk</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: '63%' }} />
              </div>
            </div>
          </div>

          <div className="kpi-row">
            <div>
              <p>Failed Tool Calls</p>
              <strong>2.4%</strong>
            </div>
            <div>
              <p>Median MCP Latency</p>
              <strong>220 ms</strong>
            </div>
            <div>
              <p>Policy Deflection Rate</p>
              <strong>68%</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
