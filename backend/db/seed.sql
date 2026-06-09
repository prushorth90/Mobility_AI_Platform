INSERT INTO shifts (id, site, start_time, end_time, team)
VALUES
  ('SHIFT_FRE_0700', 'FRE', '07:00', '15:30', 'Manufacturing Operations'),
  ('SHIFT_AUS_0630', 'AUS', '06:30', '15:00', 'People Operations'),
  ('SHIFT_REN_0700', 'REN', '07:00', '15:30', 'Battery Manufacturing')
ON CONFLICT (id) DO UPDATE SET
  site = EXCLUDED.site,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  team = EXCLUDED.team;

INSERT INTO employees (id, name, site, role, shift_id, parking_eligibility, vehicle_connected, home_location)
VALUES
  ('EMP_1001', 'Alex Rivera', 'FRE', 'Production Associate', 'SHIFT_FRE_0700', TRUE, TRUE, 'San Jose, CA'),
  ('EMP_1002', 'Morgan Lee', 'AUS', 'PeopleOps Generalist', 'SHIFT_AUS_0630', TRUE, TRUE, 'Round Rock, TX'),
  ('EMP_1003', 'Jordan Kim', 'REN', 'Cell Assembly Engineer', 'SHIFT_REN_0700', TRUE, TRUE, 'Sparks, NV')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  site = EXCLUDED.site,
  role = EXCLUDED.role,
  shift_id = EXCLUDED.shift_id,
  parking_eligibility = EXCLUDED.parking_eligibility,
  vehicle_connected = EXCLUDED.vehicle_connected,
  home_location = EXCLUDED.home_location;

INSERT INTO policy_documents (policy_code, title, department, content)
VALUES
  (
    'PO-13.4',
    'Shift Arrival and Attendance',
    'People Operations',
    'Employees are expected to badge in by shift start time. A 10-minute planned arrival buffer is recommended for high-volume sites. Site leads may apply grace windows for severe weather disruptions when pre-approved before shift start.'
  ),
  (
    'PO-21.2',
    'Charging Reimbursement',
    'Facilities',
    'Eligible commute charging reimbursements require documented charging sessions on approved partner networks or Tesla-owned stations. Receipts must include station identifier, session duration, and vehicle profile id. Reimbursement claims must be submitted within 10 business days.'
  ),
  (
    'PO-9.7',
    'Parking Priority Rules',
    'Facilities',
    'Parking eligibility and lot assignment depend on shift window, role-critical badge status, and temporary accommodation requests. Overflow routing may direct employees to secondary lots when occupancy exceeds thresholds.'
  ),
  (
    'PO-33.1',
    'Onboarding Shuttle Access',
    'People Operations',
    'New hires may request temporary shuttle routing during onboarding weeks one through four. Pickup windows are assigned by site onboarding coordinators and subject to route capacity constraints. Missed routes should be logged in the commute portal for follow-up.'
  )
ON CONFLICT (policy_code) DO UPDATE SET
  title = EXCLUDED.title,
  department = EXCLUDED.department,
  content = EXCLUDED.content,
  updated_at = NOW();
