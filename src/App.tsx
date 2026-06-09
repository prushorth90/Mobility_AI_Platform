import { useEffect, useMemo, useState } from 'react'
import './App.css'

type SiteCode = 'FRE' | 'AUS' | 'REN'

type PlanResult = {
  leaveBy: string
  arrivalBattery: number
  chargingStop: string
  riskScore: number
  parkingRecommendation: string
  routeSummary: string
}

type PolicySnippet = {
  id: string
  title: string
  text: string
  citation?: {
    policyCode: string
    chunkIndex: number
    score: number
  }
}

type AdminMetrics = {
  siteRisk: Array<{ site: string; value: number }>
  kpis: {
    failedToolCallsPercent: number
    medianMcpLatencyMs: number
    policyDeflectionRatePercent: number
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

const fallbackPolicies: PolicySnippet[] = [
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

const fallbackTools = [
  'get_employee_profile(employee_id)',
  'get_shift_schedule(employee_id)',
  'get_vehicle_status(user_id)',
  'find_nearby_chargers(location)',
  'search_people_policy(query)',
  'generate_commute_plan(employee_id, shift_id)',
  'submit_parking_request(employee_id, site_id)',
]

function App() {
  const [site, setSite] = useState<SiteCode>('FRE')
  const [shiftTime, setShiftTime] = useState('07:00')
  const [distanceMiles, setDistanceMiles] = useState(24)
  const [batteryPercent, setBatteryPercent] = useState(42)
  const [trafficMultiplier, setTrafficMultiplier] = useState(1.25)
  const [policyQuery, setPolicyQuery] = useState('Can I expense a charging stop on my way to shift?')
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [planStatus, setPlanStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [policyResults, setPolicyResults] = useState<PolicySnippet[]>(fallbackPolicies)
  const [policyGroundedAnswer, setPolicyGroundedAnswer] = useState('')
  const [policyStatus, setPolicyStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [tools, setTools] = useState<string[]>(fallbackTools)
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [apiWarning, setApiWarning] = useState('')

  useEffect(() => {
    let active = true

    async function fetchPlan() {
      setPlanStatus('loading')
      try {
        const response = await fetch(`${apiBaseUrl}/api/commute-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            site,
            shiftTime,
            distanceMiles,
            batteryPercent,
            trafficMultiplier,
          }),
        })

        if (!response.ok) {
          throw new Error('Backend response was not ok')
        }

        const payload = (await response.json()) as { plan: PlanResult }
        if (active) {
          setPlan(payload.plan)
          setPlanStatus('ready')
          setApiWarning('')
        }
      } catch {
        if (active) {
          setPlanStatus('error')
          setApiWarning('Backend unavailable. Showing fallback data for some sections.')
        }
      }
    }

    fetchPlan()

    return () => {
      active = false
    }
  }, [batteryPercent, distanceMiles, shiftTime, site, trafficMultiplier])

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const timer = setTimeout(async () => {
      setPolicyStatus('loading')
      try {
        const response = await fetch(`${apiBaseUrl}/api/policy-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ query: policyQuery }),
        })

        if (!response.ok) {
          throw new Error('Policy search failed')
        }

        const payload = (await response.json()) as {
          groundedAnswer: string
          results: PolicySnippet[]
        }
        if (active) {
          setPolicyResults(payload.results)
          setPolicyGroundedAnswer(payload.groundedAnswer)
          setPolicyStatus('ready')
        }
      } catch {
        if (active) {
          setPolicyResults(fallbackPolicies)
          setPolicyGroundedAnswer('')
          setPolicyStatus('error')
        }
      }
    }, 250)

    return () => {
      active = false
      controller.abort()
      clearTimeout(timer)
    }
  }, [policyQuery])

  useEffect(() => {
    let active = true

    async function fetchMetadata() {
      try {
        const [toolResponse, metricsResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/mcp-tools`),
          fetch(`${apiBaseUrl}/api/admin-metrics`),
        ])

        if (!toolResponse.ok || !metricsResponse.ok) {
          throw new Error('Metadata fetch failed')
        }

        const toolPayload = (await toolResponse.json()) as { tools: string[] }
        const metricsPayload = (await metricsResponse.json()) as AdminMetrics

        if (active) {
          setTools(toolPayload.tools)
          setMetrics(metricsPayload)
        }
      } catch {
        if (active) {
          setMetrics({
            siteRisk: [
              { site: 'Fremont Risk', value: 72 },
              { site: 'Austin Risk', value: 51 },
              { site: 'Reno Risk', value: 63 },
            ],
            kpis: {
              failedToolCallsPercent: 2.4,
              medianMcpLatencyMs: 220,
              policyDeflectionRatePercent: 68,
            },
          })
        }
      }
    }

    fetchMetadata()

    return () => {
      active = false
    }
  }, [])

  const resolvedPlan = useMemo(() => {
    if (plan) {
      return plan
    }

    return {
      leaveBy: '--:--',
      arrivalBattery: 0,
      chargingStop: 'Start backend to generate plan',
      riskScore: 0,
      parkingRecommendation: 'Not available',
      routeSummary: 'Waiting for backend response',
    }
  }, [plan])

  const resolvedMetrics =
    metrics || {
      siteRisk: [
        { site: 'Fremont Risk', value: 72 },
        { site: 'Austin Risk', value: 51 },
        { site: 'Reno Risk', value: 63 },
      ],
      kpis: {
        failedToolCallsPercent: 2.4,
        medianMcpLatencyMs: 220,
        policyDeflectionRatePercent: 68,
      },
    }

  return (
    <main className="page-shell">
      <div className="bg-grid" />
      <section className="hero">
        <p className="eyebrow">Tesla PeopleOps Command Surface</p>
        <h1>Commute + Charging Copilot</h1>
        <p className="hero-subtitle">
          Plan shift arrival, battery safety, parking, and policy guidance from one internal dashboard.
        </p>
        {apiWarning ? <p className="status-badge warning">{apiWarning}</p> : null}
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
              <strong>{resolvedPlan.leaveBy}</strong>
            </div>
            <div className="metric-card">
              <span>Arrival Battery</span>
              <strong>{resolvedPlan.arrivalBattery}%</strong>
            </div>
            <div className="metric-card wide">
              <span>Charging Plan</span>
              <strong>{resolvedPlan.chargingStop}</strong>
            </div>
            <div className="metric-card wide">
              <span>Parking Recommendation</span>
              <strong>{resolvedPlan.parkingRecommendation}</strong>
            </div>
            <div className="metric-card wide">
              <span>Route Summary</span>
              <strong>{resolvedPlan.routeSummary}</strong>
            </div>
          </div>
          <p className="status-badge">Planner status: {planStatus}</p>
        </article>

        <article className="panel risk-panel">
          <h2>Shift Arrival Risk</h2>
          <div className="risk-gauge" style={{ ['--risk' as string]: `${resolvedPlan.riskScore}` }}>
            <span>{resolvedPlan.riskScore}</span>
            <p>Composite risk score</p>
          </div>

          <ul className="risk-notes">
            <li>Battery threshold check adapts by site charging density.</li>
            <li>Parking ingress buffer included in leave-time recommendation.</li>
            <li>Traffic multiplier increases both commute and delay risk.</li>
          </ul>

          <h3>MCP Tool Surface</h3>
          <div className="tool-list">
            {tools.map((tool) => (
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
          <p className="status-badge">Policy status: {policyStatus}</p>

          {policyGroundedAnswer ? (
            <div className="policy-answer">
              <p className="policy-id">GROUNDED ANSWER</p>
              <p>{policyGroundedAnswer}</p>
            </div>
          ) : null}

          <div className="policy-results">
            {policyResults.length > 0 ? (
              policyResults.map((item) => (
                <div key={item.id} className="policy-card">
                  <p className="policy-id">{item.id}</p>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  {item.citation ? (
                    <p className="policy-citation">
                      Citation: {item.citation.policyCode} chunk {item.citation.chunkIndex} | score{' '}
                      {item.citation.score}
                    </p>
                  ) : null}
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
            {resolvedMetrics.siteRisk.map((risk) => (
              <div key={risk.site} className="bar-item">
                <span>{risk.site}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${risk.value}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="kpi-row">
            <div>
              <p>Failed Tool Calls</p>
              <strong>{resolvedMetrics.kpis.failedToolCallsPercent}%</strong>
            </div>
            <div>
              <p>Median MCP Latency</p>
              <strong>{resolvedMetrics.kpis.medianMcpLatencyMs} ms</strong>
            </div>
            <div>
              <p>Policy Deflection Rate</p>
              <strong>{resolvedMetrics.kpis.policyDeflectionRatePercent}%</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
