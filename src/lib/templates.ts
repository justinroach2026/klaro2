import type { IndustryCode } from '../store';

export interface SOPTemplate {
   title: string;
   description: string;
   tags: string[];
   icon: string;
   content: string; // Pre-filled markdown SOP content
   starterQuestions?: string[]; // Curated questions to open the interview (see getStarterQuestions)
}

const RE = (t: string, d: string, tags: string[], icon: string, content: string): SOPTemplate => ({ title: t, description: d, tags, icon, content });

export const INDUSTRY_TEMPLATES: Record<IndustryCode, SOPTemplate[]> = {
   tech: [
      RE('Software Deployment Process', 'CI/CD pipeline, staging, and production release steps.', ['devops', 'deployment'], '🚀',
         `## Software Deployment Process

### Purpose
Ensure all code releases follow a safe, repeatable deployment pipeline from development to production.

### Scope
All engineering teams deploying to staging and production environments.

### Steps

1. **Code Freeze & Branch Cut**
   - Create a release branch from \`main\` (e.g. \`release/v2.4.0\`)
   - Notify the team via Slack/Teams that code freeze is in effect

2. **Automated Testing**
   - CI pipeline runs unit tests, integration tests, and linting
   - All tests must pass with >90% code coverage before proceeding
   - Security scans (SAST/DAST) must show no critical vulnerabilities

3. **Staging Deployment**
   - Deploy to the staging environment automatically via CI/CD
   - QA team performs smoke tests and regression testing
   - Product owner signs off on staging

4. **Production Deployment**
   - Schedule deployment during the agreed maintenance window
   - Enable feature flags for gradual rollout (10% → 50% → 100%)
   - Monitor error rates, latency, and system health dashboards

5. **Post-Deployment Verification**
   - Run production smoke tests
   - Verify key user journeys (login, checkout, API responses)
   - Confirm rollback plan is ready if metrics degrade

6. **Rollback Procedure**
   - If error rate exceeds 1%, immediately revert to the previous version
   - Notify stakeholders and create a post-mortem ticket

### Responsible Parties
- **Engineering Lead**: Approves release
- **DevOps**: Manages pipeline and infrastructure
- **QA**: Signs off on staging`),

      RE('Incident Response Plan', 'How to handle production outages and service disruptions.', ['security', 'ops'], '🚨',
         `## Incident Response Plan

### Purpose
Provide a structured approach to identifying, responding to, and recovering from production incidents.

### Severity Levels
| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 - Critical | Full service outage, data loss | 15 minutes |
| P2 - Major | Degraded service, partial outage | 30 minutes |
| P3 - Minor | Non-critical bug, workaround exists | 4 hours |

### Steps

1. **Detection & Alerting**
   - Monitoring tools (Datadog/PagerDuty) trigger an alert
   - On-call engineer acknowledges within the response SLA

2. **Triage & Communication**
   - Assess severity level using the table above
   - Open an incident channel (e.g. #incident-2024-001)
   - Post initial status update to stakeholders

3. **Investigation & Mitigation**
   - Identify root cause using logs, metrics, and traces
   - Apply immediate mitigation (rollback, feature flag, scaling)
   - Document all actions taken in the incident channel

4. **Resolution & Recovery**
   - Deploy a permanent fix once root cause is confirmed
   - Verify all systems are back to normal operation
   - Close the incident channel with a summary

5. **Post-Mortem (within 48 hours)**
   - Document: What happened, timeline, root cause, impact
   - Identify action items to prevent recurrence
   - Share learnings with the wider team`),

      RE('New Employee Onboarding', 'Dev environment setup, access provisioning, and team introductions.', ['hr', 'onboarding'], '👋',
         `## New Employee Onboarding (Engineering)

### Purpose
Ensure new team members are set up and productive within their first week.

### Pre-Start (HR/IT)
- [ ] Laptop configured with company image
- [ ] Email and Slack/Teams account created
- [ ] GitHub/GitLab access granted
- [ ] VPN and SSO credentials provisioned
- [ ] Welcome pack sent (handbook, org chart, key contacts)

### Day 1
1. **Welcome & Orientation** (9:00 - 10:00)
   - Meet line manager, team introduction
   - Office tour / remote workspace setup guide
2. **IT Setup** (10:00 - 12:00)
   - Install IDE, Docker, Node.js, and project dependencies
   - Clone repositories and run local dev environment
   - Verify access to CI/CD, monitoring, and documentation tools
3. **Company Overview** (14:00 - 15:00)
   - Product walkthrough and architecture overview
   - Review coding standards and PR guidelines

### Week 1
- [ ] Shadow a senior developer on a feature
- [ ] Complete a small "starter task" (labelled good-first-issue)
- [ ] Attend all team ceremonies (standup, planning, retro)
- [ ] 1:1 with line manager on Friday to review first week

### Week 2-4
- [ ] Contribute to a real feature with code review support
- [ ] Complete mandatory training (security awareness, data privacy)
- [ ] 30-day check-in with manager and HR`),

      RE('Code Review Guidelines', 'Standards for reviewing pull requests and ensuring code quality.', ['engineering', 'quality'], '🔍',
         `## Code Review Guidelines

### Purpose
Maintain code quality, share knowledge, and catch bugs before they reach production.

### Submitting a PR
1. Keep PRs small (< 400 lines of changed code)
2. Write a clear description: what, why, and how to test
3. Link the related ticket/issue
4. Ensure all CI checks pass before requesting review
5. Add screenshots for UI changes

### Reviewing a PR
1. **Correctness**: Does the code do what it claims?
2. **Readability**: Can another developer understand this in 6 months?
3. **Security**: Are there SQL injection, XSS, or auth bypass risks?
4. **Performance**: Any N+1 queries, unnecessary re-renders, or memory leaks?
5. **Tests**: Are new features covered by tests?
6. **Style**: Does it follow our coding standards?

### Approval & Merging
- Minimum **2 approvals** required for production code
- Use **squash merge** to keep a clean git history
- Delete the branch after merging`),

      RE('Data Backup & Recovery', 'Scheduled backups, disaster recovery, and data restoration.', ['ops', 'security'], '💾',
         `## Data Backup & Recovery

### Purpose
Protect against data loss through regular backups and tested recovery procedures.

### Backup Schedule
| Data Type | Frequency | Retention | Storage |
|-----------|-----------|-----------|---------|
| Database (PostgreSQL) | Every 6 hours | 30 days | AWS S3 / GCS |
| File storage | Daily | 90 days | Separate region |
| Config & secrets | On change | Indefinite | Vault / KMS |

### Steps
1. **Automated Backups**: Run via cron job or managed service
2. **Verification**: Weekly test restore to a staging environment
3. **Encryption**: All backups encrypted at rest (AES-256)
4. **Monitoring**: Alert if any backup job fails

### Recovery Procedure
1. Identify the scope of data loss
2. Select the most recent clean backup
3. Restore to an isolated environment first
4. Verify data integrity before switching to production
5. Document the incident and update backup procedures if needed`),

      RE('Client Data Handling (GDPR)', 'How to collect, store, and delete user data compliantly.', ['compliance', 'privacy'], '🔒',
         `## Client Data Handling (GDPR/Privacy)

### Purpose
Ensure all personal data is collected, stored, processed, and deleted in compliance with GDPR and local privacy laws.

### Data Collection
- Only collect data that is strictly necessary (data minimisation)
- Obtain explicit consent before collecting personal data
- Display a clear privacy notice explaining what data is collected and why

### Data Storage
- Store personal data encrypted at rest and in transit
- Use access controls — only authorised personnel can view PII
- Log all access to personal data for audit purposes

### Data Subject Rights
| Right | Response Time | Action |
|-------|--------------|--------|
| Access (SAR) | 30 days | Export user's data in machine-readable format |
| Rectification | 30 days | Correct inaccurate data |
| Erasure | 30 days | Delete all personal data (right to be forgotten) |
| Portability | 30 days | Provide data in JSON/CSV format |

### Data Retention
- Delete inactive user data after 24 months
- Anonymise analytics data after 12 months
- Maintain audit logs for 7 years (legal requirement)`),
   ],

   real_estate: [
      RE('Property Listing Process', 'Photography, descriptions, portal uploads, and marketing.', ['sales', 'marketing'], '🏠',
         `## Property Listing Process

### Purpose
Ensure every property is listed professionally and consistently across all marketing channels.

### Steps

1. **Initial Property Assessment**
   - Visit the property for a market appraisal
   - Confirm asking price / rental price with the owner
   - Sign the listing agreement (sole or multi-agency)

2. **Photography & Media**
   - Schedule professional photography (minimum 15 high-quality images)
   - Create a floor plan (2D and 3D if available)
   - Record a video walkthrough for premium listings
   - Capture drone footage for large or unique properties

3. **Description & Details**
   - Write a compelling property description (min. 200 words)
   - Include: bedrooms, bathrooms, sqm/sqft, parking, garden, EPC rating
   - Highlight unique selling points and local amenities
   - Translate for international markets if applicable

4. **Portal & Website Upload**
   - Upload to Rightmove / Zoopla / Idealista / local portals
   - Publish on your company website with SEO-optimised URL
   - Share on social media (Facebook, Instagram, LinkedIn)

5. **Vendor Communication**
   - Send the live listing link to the property owner for approval
   - Schedule weekly feedback reports on viewings and enquiries`),

      RE('Tenant Screening & Onboarding', 'Background checks, references, deposit handling, and lease signing.', ['lettings', 'compliance'], '📝',
         `## Tenant Screening & Onboarding

### Purpose
Ensure all tenants are properly vetted and onboarded in compliance with local letting regulations.

### Screening Steps

1. **Application Form**
   - Collect full name, ID, employment details, and rental history
   - Obtain written consent for background checks

2. **Reference Checks**
   - Previous landlord reference (payment history, property condition)
   - Employer reference (salary verification, employment status)
   - Credit check via approved provider (Experian/Equifax)

3. **Right to Rent Check** (UK specific)
   - Verify passport or biometric residence permit
   - Record document reference numbers and check date
   - Retain copies for 12 months after tenancy ends

4. **Affordability Assessment**
   - Rent should not exceed 35-40% of gross monthly income
   - If borderline, request a guarantor

### Onboarding

5. **Lease Signing**
   - Issue AST (Assured Shorthold Tenancy) or local equivalent
   - Both parties sign; provide tenant with a copy within 14 days

6. **Deposit Protection**
   - Register deposit with a government-approved scheme within 30 days
   - Provide tenant with the scheme's prescribed information

7. **Move-In**
   - Conduct a detailed inventory with photographs
   - Provide keys, alarm codes, and utility meter readings
   - Issue the "How to Rent" guide (UK) or local equivalent`),

      RE('Property Viewing Protocol', 'Scheduling, preparation, conducting viewings, and follow-up.', ['sales', 'client-services'], '🚪',
         `## Property Viewing Protocol

### Purpose
Deliver a professional, safe, and effective viewing experience that maximises offers.

### Steps

1. **Scheduling**
   - Confirm viewing time with vendor/tenant (24-hour notice minimum)
   - Send confirmation to the prospective buyer/tenant with address and parking info
   - Block time in the shared calendar

2. **Preparation**
   - Notify the current occupant to prepare the property (tidy, lights on, pets secured)
   - Print property details and floor plan to bring
   - Check EPC, any known issues, and local amenities info

3. **Conducting the Viewing**
   - Arrive 5 minutes early to open up and check presentation
   - Greet the viewer, introduce yourself, and confirm their requirements
   - Follow a logical tour route (outside → hallway → living → kitchen → bedrooms → garden)
   - Highlight key features but allow the viewer to explore
   - Answer questions honestly — disclose known material issues

4. **Safety**
   - Never attend a viewing alone for the first time with an unknown party
   - Log all viewing appointments in the office system
   - Carry a charged mobile phone

5. **Follow-Up (within 24 hours)**
   - Call/email the viewer for feedback
   - Report feedback to the vendor/landlord
   - If interested, arrange a second viewing or begin offer/application process`),

      RE('Rent Collection & Arrears', 'Payment tracking, reminders, and arrears escalation process.', ['finance', 'lettings'], '💷',
         `## Rent Collection & Arrears Management

### Purpose
Ensure rent is collected on time and arrears are managed professionally and legally.

### Payment Setup
- Set up standing order or direct debit at tenancy start
- Rent due on the 1st of each month (or as per lease)
- Issue rent receipts or statements monthly

### Arrears Escalation Process
| Day | Action |
|-----|--------|
| Day 1 | Rent is due — check payment received |
| Day 3 | Friendly reminder via email/SMS |
| Day 7 | Phone call to discuss and agree a payment plan |
| Day 14 | Formal letter — first warning |
| Day 21 | Contact guarantor (if applicable) |
| Day 30 | Issue Section 8 notice (UK) or local legal notice |
| Day 60+ | Refer to solicitor for possession proceedings |

### Record Keeping
- Log all communications in the tenant's file
- Keep copies of all notices served
- Record any agreed payment plans in writing`),

      RE('Property Maintenance Request', 'Tenant reports, contractor dispatch, and completion sign-off.', ['maintenance', 'operations'], '🔧',
         `## Property Maintenance Request Process

### Purpose
Handle tenant maintenance requests promptly and keep the property in good condition.

### Steps

1. **Tenant Reports Issue**
   - Tenant submits request via portal, email, or phone
   - Log the request with: date, property, description, photos, urgency

2. **Triage & Priority**
   | Priority | Examples | Response Time |
   |----------|----------|---------------|
   | Emergency | Gas leak, flood, no heating in winter | 4 hours |
   | Urgent | Broken lock, leaking roof, no hot water | 24 hours |
   | Routine | Dripping tap, cracked tile, painting | 5 working days |

3. **Notify Property Owner**
   - Get landlord approval for repairs over the agreed threshold (e.g. £250)
   - For emergencies, proceed immediately and notify afterwards

4. **Dispatch Contractor**
   - Select from the approved contractor list
   - Provide access details and tenant contact info
   - Confirm appointment time with the tenant

5. **Completion & Sign-Off**
   - Contractor confirms work complete with photos
   - Tenant confirms satisfaction
   - File the invoice and update the maintenance log

6. **Cost Recovery**
   - If damage caused by tenant, recover costs from deposit or invoice directly
   - Update the property's maintenance history`),

      RE('Compliance Checks (EPC, Gas, EICR)', 'Scheduling certificates, record keeping, and renewal reminders.', ['compliance', 'safety'], '✅',
         `## Compliance Certificate Management

### Purpose
Ensure all rental properties have valid safety certificates as required by law.

### Required Certificates
| Certificate | Frequency | Penalty for Non-Compliance |
|------------|-----------|---------------------------|
| Gas Safety (CP12) | Annual | Up to £6,000 fine (UK) |
| EPC (Energy Performance) | Every 10 years | £5,000 fine, cannot let legally |
| EICR (Electrical) | Every 5 years | Up to £30,000 fine (UK) |
| Legionella Risk Assessment | Every 2 years | Variable |
| Smoke & CO Alarms | Annual check | £5,000 fine |

### Process
1. **Set Calendar Reminders** — 60 days before expiry
2. **Book Certified Inspector** — use Gas Safe / NICEIC registered engineers
3. **Provide Access** — coordinate with tenant for inspection date
4. **Review Report** — address any remedial actions immediately
5. **File & Share** — save certificate digitally, provide copy to tenant
6. **Update Tracker** — mark renewal date in the compliance dashboard`),
   ],

   healthcare: [
      RE('Patient Intake Process', 'Registration, insurance verification, and initial assessment.', ['admin', 'patient-care'], '📋',
         `## Patient Intake Process

### Purpose
Register new patients efficiently while collecting all required medical and administrative information.

### Steps
1. **Pre-Registration** — Patient completes forms online or in waiting room (name, DOB, address, emergency contact, insurance details)
2. **ID & Insurance Verification** — Check photo ID and verify insurance coverage / eligibility
3. **Medical History** — Record allergies, current medications, past surgeries, family history
4. **Consent Forms** — Patient signs consent for treatment, data processing (GDPR), and communication preferences
5. **Triage Assessment** — Nurse records vitals (BP, heart rate, temperature, weight)
6. **Assign to Clinician** — Route to appropriate department based on complaint
7. **File Creation** — Create or update electronic health record (EHR)`),

      RE('Medication Administration', 'Prescribing, dispensing, and recording medication safely.', ['clinical', 'safety'], '💊',
         `## Medication Administration

### Purpose
Ensure medication is prescribed, dispensed, and administered safely following the "5 Rights" principle.

### The 5 Rights
1. **Right Patient** — Verify patient identity (name + DOB)
2. **Right Drug** — Confirm the medication matches the prescription
3. **Right Dose** — Check dosage against body weight and allergies
4. **Right Route** — Oral, IV, IM, topical, etc.
5. **Right Time** — Administer at the prescribed time/interval

### Steps
1. Doctor writes/updates prescription in EHR
2. Pharmacist reviews for drug interactions and allergies
3. Nurse verifies the 5 Rights at the bedside
4. Administer medication and observe for immediate reactions
5. Record administration in the MAR (Medication Administration Record)
6. Report any adverse reactions immediately`),

      RE('Infection Control Protocol', 'Hand hygiene, PPE usage, and sterilisation procedures.', ['safety', 'compliance'], '🧤',
         `## Infection Control Protocol

### Purpose
Prevent the spread of healthcare-associated infections (HAIs).

### Hand Hygiene (WHO 5 Moments)
1. Before touching a patient
2. Before a clean/aseptic procedure
3. After body fluid exposure risk
4. After touching a patient
5. After touching patient surroundings

### PPE Requirements
| Scenario | Gloves | Mask | Gown | Eye Protection |
|----------|--------|------|------|----------------|
| Routine care | ✅ | ❌ | ❌ | ❌ |
| Droplet precautions | ✅ | ✅ | ✅ | ❌ |
| Airborne precautions | ✅ | N95 | ✅ | ✅ |
| Contact with blood/fluids | ✅ | ✅ | ✅ | ✅ |

### Sterilisation
- All reusable instruments autoclaved at 134°C for 3 minutes
- Single-use items disposed in clinical waste (yellow bags)
- Surfaces cleaned with approved disinfectant between patients`),

      RE('Medical Records Management', 'Creating, updating, and archiving patient records.', ['compliance', 'records'], '📁',
         `## Medical Records Management

### Purpose
Maintain accurate, secure, and compliant patient records.

### Standards
- All entries must be dated, timed, and signed (electronic signature acceptable)
- Never alter or delete a record — use amendments with explanations
- Records must be stored for minimum 8 years (adults) or until age 25 (children)

### Access Control
- Role-based access: clinicians see full records, admin sees demographics only
- All access logged for audit purposes
- Patient can request their records (Subject Access Request) — respond within 30 days

### Digital Security
- EHR system must be encrypted at rest and in transit
- Two-factor authentication required for all clinical systems
- Regular backups with tested recovery procedures`),

      RE('Emergency Response Plan', 'Code Blue, evacuation, and critical incident procedures.', ['emergency', 'safety'], '🚑',
         `## Emergency Response Plan

### Code System
| Code | Meaning | Response |
|------|---------|----------|
| Code Blue | Cardiac/respiratory arrest | Crash team to location |
| Code Red | Fire | Evacuate using RACE protocol |
| Code Black | Bomb threat | Follow lockdown procedure |
| Code Orange | Mass casualty | Activate surge capacity plan |

### RACE Protocol (Fire)
1. **R**escue — Remove patients from immediate danger
2. **A**larm — Pull the fire alarm and call emergency services
3. **C**ontain — Close doors and windows to limit spread
4. **E**xtinguish or Evacuate — Use extinguisher if safe, otherwise evacuate`),

      RE('Staff Credentialling & Training', 'Verifying qualifications and ongoing professional development.', ['hr', 'compliance'], '🎓',
         `## Staff Credentialling & Training

### Purpose
Ensure all clinical staff hold valid credentials and maintain ongoing professional development.

### Pre-Employment
- [ ] Verify medical degree / nursing registration
- [ ] Check professional body registration (GMC, NMC, etc.)
- [ ] DBS / background check
- [ ] Occupational health clearance
- [ ] Reference checks (minimum 2)

### Ongoing Requirements
- Annual appraisal with line manager
- Mandatory training renewed annually: BLS, fire safety, safeguarding, infection control
- Revalidation with professional body (every 3-5 years)
- CPD portfolio maintained with minimum required hours`),
   ],

   hospitality: [
      RE('Guest Check-In / Check-Out', 'Front desk procedures and welcome protocol.', ['front-desk', 'guest-services'], '🏨',
         `## Guest Check-In / Check-Out

### Check-In
1. Greet with a smile: "Welcome to [Hotel Name]"
2. Confirm reservation (name, dates, room type)
3. Verify ID and collect payment / pre-authorisation
4. Issue key cards and explain Wi-Fi, breakfast times, amenities
5. Offer luggage assistance and escort to room for VIP guests
6. Log check-in time in the PMS (Property Management System)

### Check-Out
1. Ask about their stay and note any feedback
2. Present the folio for review
3. Process payment (deduct deposit if applicable)
4. Issue invoice/receipt
5. Offer to book future stays or arrange transport
6. Update room status to "dirty" for housekeeping`),

      RE('Housekeeping Standards', 'Room cleaning checklist and inspection process.', ['operations', 'quality'], '🧹',
         `## Housekeeping Standards

### Daily Room Clean (Occupied)
- [ ] Make bed with fresh pillowcases
- [ ] Clean and sanitise bathroom (toilet, sink, shower, mirror)
- [ ] Replace used towels, replenish toiletries
- [ ] Empty bins, vacuum/mop floors
- [ ] Dust surfaces, wipe TV remote and light switches
- [ ] Check minibar and replenish
- [ ] Report any maintenance issues immediately

### Full Turnover Clean (Check-Out)
- All items from daily clean PLUS:
- [ ] Strip and remake bed with fresh linens
- [ ] Deep clean bathroom including grout
- [ ] Check under bed and in all drawers for lost property
- [ ] Reset room amenities (menus, stationery, welcome card)
- [ ] Inspect for damage and report

### Inspection
- Supervisor inspects 100% of check-out rooms before releasing
- Random spot-check 20% of daily cleans`),

      RE('Food Safety & Hygiene (HACCP)', 'Temperature logs, allergen management, and kitchen cleanliness.', ['kitchen', 'compliance'], '🍽️',
         `## Food Safety & Hygiene (HACCP)

### Temperature Controls
| Item | Required Temp | Check Frequency |
|------|--------------|-----------------|
| Fridge | 1-5°C | Twice daily |
| Freezer | -18°C or below | Twice daily |
| Hot holding | 63°C or above | Every 2 hours |
| Cooking temp (poultry) | 75°C core | Every batch |

### Allergen Management
- All 14 major allergens clearly marked on menus
- Separate preparation areas for allergen-free meals
- Staff trained to handle allergen enquiries
- "If in doubt, don't serve it" policy

### Kitchen Hygiene
- Handwashing: before food prep, after breaks, after raw meat
- Colour-coded chopping boards (red=raw meat, green=salad, blue=fish)
- Clean-as-you-go policy enforced
- Deep clean schedule: weekly (extraction hoods), monthly (behind equipment)`),

      RE('Guest Complaint Resolution', 'Escalation paths and service recovery.', ['guest-services', 'management'], '💬',
         `## Guest Complaint Resolution

### LEARN Framework
1. **L**isten — Let the guest speak without interrupting
2. **E**mpathise — "I understand how frustrating that must be"
3. **A**pologise — Sincere apology even if it's not your fault
4. **R**esolve — Offer a solution and timeline
5. **N**otify — Log the complaint and inform management

### Escalation Matrix
| Severity | Example | Authority | Compensation Limit |
|----------|---------|-----------|-------------------|
| Minor | Slow service, missing amenity | Front desk | Complimentary drink |
| Moderate | Room issue, noise complaint | Duty Manager | Room upgrade or discount |
| Serious | Health/safety, billing error | General Manager | Full refund consideration |

### Follow-Up
- Contact guest within 24 hours to confirm resolution
- Record in CRM for pattern analysis
- Review recurring complaints in monthly management meeting`),

      RE('Event Setup & Breakdown', 'Conference/banquet preparation and post-event cleanup.', ['events', 'operations'], '🎪',
         `## Event Setup & Breakdown

### Pre-Event (48 hours before)
1. Confirm final numbers, dietary requirements, and AV needs with client
2. Create room layout plan and assign staff roles
3. Test all AV equipment (projector, microphones, speakers)

### Setup (Day of event)
1. Arrange tables and chairs per layout plan
2. Set up AV, signage, and registration desk
3. Prepare F&B (water stations, coffee breaks, main service)
4. Brief all event staff on timings and client contacts
5. Final walkthrough with event coordinator

### During Event
- Dedicated event contact on-site at all times
- F&B service timed to the agenda
- Monitor room temperature, lighting, and sound levels

### Breakdown (After event)
1. Client farewell and collect feedback
2. Clear all food and beverage items
3. Store or pack client materials
4. Reset room to default configuration
5. Complete event report (attendance, issues, feedback)`),

      RE('Fire Safety & Evacuation', 'Fire drill procedures and guest safety.', ['safety', 'compliance'], '🔥',
         `## Fire Safety & Evacuation

### Prevention
- Fire doors kept closed and unobstructed at all times
- Extinguishers inspected monthly, serviced annually
- All staff complete fire safety training within first week
- Fire drills conducted quarterly

### RACE Protocol
1. **Rescue** — Remove anyone in immediate danger
2. **Alert** — Activate fire alarm, call emergency services
3. **Contain** — Close doors to prevent fire spreading
4. **Evacuate** — Guide guests to assembly point via nearest safe exit

### Staff Responsibilities
- Reception: Call fire brigade, grab guest list, direct guests
- Housekeeping: Check rooms on assigned floors, assist mobility-impaired guests
- Kitchen: Turn off gas and electrical equipment, evacuate via service exit
- Management: Coordinate at assembly point, take roll call, liaise with fire brigade`),
   ],

   manufacturing: [
      RE('Production Line Setup', 'Machine calibration, changeover procedures, and quality checkpoints per ISO 9001.', ['production', 'quality'], '⚙️',
         `# Production Line Setup

## Purpose

Ensure production lines are correctly configured, calibrated, and validated before each production run to minimise waste, downtime, and non-conforming output. Aligns with **ISO 9001:2015** Clause 8.5.1 (Control of Production).

---

## Scope

All production supervisors, machine operators, and quality control personnel involved in line setup and changeover.

---

## Pre-Setup Planning

- Review the **Production Work Order** (PWO) including:
    - Product code, specification revision, and quantity
    - Bill of Materials (BOM) and required raw materials
    - Tooling and fixture requirements
    - Special process instructions or customer-specific requirements
- Confirm raw material availability and batch/lot traceability
- Verify tooling is clean, undamaged, and within calibration date

---

## Setup Procedure

1. **Lockout/Tagout (LOTO)**
    - Isolate energy sources before any mechanical adjustment
    - Attach personal lock and tag per OSHA 29 CFR 1910.147

2. **Machine Configuration**
    - Install tooling, dies, or moulds per the setup sheet
    - Set parameters: speed, pressure, temperature, feed rate
    - Calibrate measuring instruments (calipers, gauges, sensors)

3. **Material Loading**
    - Load raw materials, verify batch numbers against the PWO
    - Check material certificates of conformity (CoC)

4. **Trial Run — First Article Inspection (FAI)**
    - Produce **5 sample units**
    - QC inspects dimensions, visual quality, and functionality
    - All 5 must pass before full production is authorised
    - Record FAI results on the **First Article Inspection Report**

---

## Quality Checkpoints

| Checkpoint | Frequency | Responsibility |
|---|---|---|
| First Article Inspection | Start of each run | QC Inspector |
| In-Process Inspection | Every 30 minutes | Operator + QC |
| Statistical Process Control (SPC) | Hourly | QC Inspector |
| Final Inspection | Before packaging | QC Inspector |

---

## Documentation

- Log setup time, adjustments, and FAI results in the **Production Log**
- Record any non-conformances on a **Non-Conformance Report (NCR)**
- Retain setup records for a minimum of **3 years** for audit purposes

---

## Responsible Parties

- **Production Supervisor**: Authorises line start
- **Machine Operator**: Performs setup and changeover
- **QC Inspector**: Conducts FAI and in-process checks
`),

      RE('Quality Inspection (QC)', 'Incoming, in-process, and final inspection per ISO 2859 AQL standards.', ['quality', 'compliance'], '✅',
         `# Quality Inspection (QC)

## Purpose

Ensure all materials, work-in-progress, and finished goods meet defined quality specifications through systematic inspection at each production stage. Based on **ISO 2859-1** (AQL sampling) and **ISO 9001:2015** Clause 8.6.

---

## Scope

All incoming materials, in-process production, and finished goods across all product lines.

---

## Inspection Types

| Type | When | Sample Size | Accept/Reject Criteria |
|---|---|---|---|
| Incoming Inspection | On receipt of materials | AQL Level II (General) | Per material specification |
| In-Process Inspection | During production | Every 30 minutes | Per product drawing/spec |
| Final Inspection | Before dispatch | 100% or AQL Level II | Zero critical defects |

---

## Incoming Material Inspection

1. Check delivery note matches the **Purchase Order (PO)**
2. Verify supplier **Certificate of Conformity (CoC)**
3. Take AQL sample from the delivery batch
4. Inspect against the approved material specification:
    - Dimensions (±tolerances)
    - Visual quality (surface finish, colour, damage)
    - Functional tests (if applicable)
5. **Pass** → Label as "Approved", move to designated storage
6. **Fail** → Quarantine immediately, raise a **Supplier Non-Conformance Report (SNCR)**

---

## In-Process Inspection

1. Operator performs self-check every **30 minutes**
2. QC Inspector conducts independent checks per the **Inspection Plan**
3. Record measurements on the **SPC Chart** (Statistical Process Control)
4. If out of tolerance:
    - Stop production immediately
    - Quarantine suspect product
    - Notify Production Supervisor
    - Investigate root cause before restarting

---

## Final Inspection

1. Compare finished goods against the **product drawing and specification**
2. Measure all critical dimensions
3. Perform visual inspection for cosmetic defects
4. Conduct functional/performance tests (if required)
5. Record results on the **Final Inspection Report**:
    - **Pass** → Label as "Approved for Dispatch"
    - **Fail** → Quarantine, raise **NCR**, initiate corrective action

---

## Non-Conformance Management

- All non-conformances recorded in the **NCR Log**
- Root cause analysis using **8D methodology** or **5 Whys**
- Corrective actions verified for effectiveness within 30 days
- NCR trends reviewed monthly in the **Quality Management Review**

---

## Responsible Parties

- **QC Inspector**: Conducts inspections and raises NCRs
- **Production Supervisor**: Supports investigations
- **Quality Manager**: Owns the QMS and signs off corrective actions
`),

      RE('Equipment Maintenance Schedule', 'Preventive, predictive, and breakdown maintenance with LOTO procedures.', ['maintenance', 'ops'], '🔧',
         `# Equipment Maintenance Schedule

## Purpose

Maximise equipment uptime and lifespan through a structured preventive and predictive maintenance programme. Aligns with **Total Productive Maintenance (TPM)** principles.

---

## Maintenance Types

| Type | Description | Frequency |
|---|---|---|
| Autonomous | Operator-level care (clean, inspect, lubricate) | Daily |
| Preventive (PM) | Scheduled servicing per OEM recommendations | Weekly / Monthly |
| Predictive (PdM) | Condition-based monitoring (vibration, thermal) | Continuous |
| Corrective | Breakdown repair | As needed |

---

## Daily Autonomous Maintenance (Operator)

- [ ] Visual inspection of machine and surrounding area
- [ ] Check lubrication levels and top up if needed
- [ ] Clean debris from work area and machine surfaces
- [ ] Listen for unusual sounds, vibrations, or smells
- [ ] Report any anomalies on the **Daily Machine Check Sheet**

---

## Preventive Maintenance Schedule

| Frequency | Tasks |
|---|---|
| Weekly | Belt tension, filter inspection, coolant levels |
| Monthly | Full calibration, wear parts measurement, alignment check |
| Quarterly | Electrical inspections, hydraulic fluid analysis |
| Annually | Major overhaul, safety certification, OEM service |

---

## Breakdown Procedure

1. **Operator** reports fault and immediately performs **LOTO** (Lockout/Tagout)
2. **Maintenance Team** assesses and estimates repair time
3. **Spare parts** ordered if not in stock (check critical spares inventory)
4. Repair completed, machine tested under no-load conditions
5. **Production Supervisor** authorises machine release back to production
6. Breakdown logged in the **CMMS** (Computerised Maintenance Management System) with:
    - Fault description and root cause
    - Parts used and labour time
    - Recommendations to prevent recurrence

---

## Key Performance Indicators

| KPI | Target |
|---|---|
| Overall Equipment Effectiveness (OEE) | ≥85% |
| Mean Time Between Failures (MTBF) | Increase quarter-on-quarter |
| Mean Time To Repair (MTTR) | ≤2 hours |
| PM Completion Rate | ≥95% |

---

## Responsible Parties

- **Machine Operator**: Daily autonomous checks
- **Maintenance Technician**: PM, PdM, and corrective repairs
- **Maintenance Manager**: Scheduling, KPI tracking, budget
`),

      RE('Warehouse Receiving & Shipping', 'Goods-in verification, storage, and dispatch with full traceability.', ['logistics', 'warehouse'], '📦',
         `# Warehouse Receiving & Shipping

## Purpose

Ensure all incoming materials are verified and stored correctly, and all outgoing goods are picked, packed, and dispatched accurately with full traceability.

---

## Receiving Procedure

1. **Delivery Arrival**
    - Check the delivery note / packing list against the **Purchase Order (PO)**
    - Verify supplier, item codes, quantities, and batch/lot numbers

2. **Physical Inspection**
    - Inspect outer packaging for transit damage
    - Open and inspect a sample of goods (or 100% for high-value items)
    - Reject and photograph any damaged or non-conforming items
    - Note rejected items on the delivery note and notify procurement

3. **Booking In**
    - Label each pallet/container with:
        - PO number, batch/lot number, date received
    - Update the **Warehouse Management System (WMS)**
    - Put away in the designated storage location (bin/rack)
    - Items requiring QC hold → move to **Inspection Area**

---

## Storage Standards

- **FIFO** (First In, First Out) method enforced for all stock
- Hazardous materials stored per **COSHH** regulations (separate, ventilated, bunded)
- Temperature-sensitive items stored in climate-controlled areas
- Maximum stack heights clearly marked
- Aisles kept clear at all times

---

## Shipping / Dispatch Procedure

1. **Pick** items per the Sales Order / Dispatch Note
2. **Verify** picked items against the order (scan barcodes or manual check)
3. **Pack** securely with appropriate protection (bubble wrap, dunnage, palletise)
4. **Weigh** and apply the shipping label
5. **Generate documentation**:
    - Dispatch note / packing list
    - Commercial invoice (for export)
    - Customs paperwork (CN22/CN23, export declarations)
6. **Load** onto vehicle; driver signs the **Proof of Dispatch (POD)**
7. **Update** WMS to reflect stock movements

---

## Responsible Parties

- **Warehouse Operative**: Receiving, put-away, picking, packing
- **Warehouse Supervisor**: Oversees operations, resolves discrepancies
- **Transport Coordinator**: Arranges collections and manages carrier relationships
`),

      RE('Health & Safety Induction', 'New worker orientation, PPE requirements, and RIDDOR reporting.', ['safety', 'hr'], '⛑️',
         `# Health & Safety Induction

## Purpose

Ensure every new worker understands the site-specific safety rules, hazards, PPE requirements, and emergency procedures before commencing work. Compliant with the **Health and Safety at Work Act 1974** and **Management of Health & Safety at Work Regulations 1999**.

---

## Before Starting Work

- [ ] Watch the H&S induction video / presentation
- [ ] Read and sign the H&S acknowledgement form
- [ ] Issued PPE: hard hat, safety boots, hi-vis vest, ear protection, safety glasses, gloves
- [ ] Shown emergency exits, fire assembly point, and first aid stations
- [ ] Introduced to the designated First Aider and H&S representative
- [ ] Briefed on site-specific hazards (chemicals, machinery, confined spaces, etc.)

---

## Key Safety Rules

1. **PPE** must be worn at all times in production and warehouse areas
2. **No mobile phones** in production areas (distraction hazard)
3. **Report all accidents, incidents, and near-misses** within 1 hour
4. **LOTO** (Lockout/Tagout) procedure must be followed before any maintenance
5. **Manual handling**: maximum lifting weight of **25 kg** — use mechanical aids above this
6. **Housekeeping**: keep work areas clean, aisles clear, spills cleaned immediately
7. **No horseplay** — disciplinary action will follow
8. **Visitors** must be escorted at all times and wear appropriate PPE

---

## Accident & Near-Miss Reporting

| Type | Action Required | Timeframe |
|---|---|---|
| Minor injury (first aid only) | Complete the Accident Report Form | Within 1 hour |
| Major injury (hospital visit) | Report to H&S Manager, complete form | Immediately |
| RIDDOR-reportable | Notify the HSE (UK) | Within 15 days |
| Fatality or specified injury | Notify the HSE (UK) | Immediately |
| Near-miss (no injury) | Complete a Near-Miss Report | Within 1 hour |

---

## Emergency Procedures

- **Fire**: Follow the RACE protocol (Rescue, Alert, Contain, Evacuate)
- **Chemical spill**: Evacuate the area, do not attempt cleanup unless trained
- **Medical emergency**: Call the First Aider, dial 999/112 if serious
- **Gas leak**: Evacuate immediately, do not use electrical switches

---

## Responsible Parties

- **H&S Manager**: Delivers induction, maintains records
- **Line Manager**: Ensures all team members are inducted before starting
- **All Employees**: Follow the rules and report hazards
`),

      RE('Inventory Stock Take', 'ABC analysis, cycle counting procedures, and stock reconciliation.', ['inventory', 'finance'], '📊',
         `# Inventory Stock Take

## Purpose

Maintain accurate stock records through regular cycle counting, reconcile physical stock with the Warehouse Management System (WMS), and identify discrepancies for investigation. Supports **IAS 2 (Inventories)** compliance.

---

## ABC Classification & Count Schedule

| Class | Value | % of SKUs | Count Frequency |
|---|---|---|---|
| A-items | High value (80% of total value) | ~20% | Monthly |
| B-items | Medium value (15% of total value) | ~30% | Quarterly |
| C-items | Low value (5% of total value) | ~50% | Annually |

---

## Count Procedure

1. **Preparation**
    - Schedule the count and notify warehouse team
    - Freeze inventory movements in the WMS for the count zone
    - Print count sheets (or prepare handheld scanners)
    - Clear the area of any un-booked deliveries or returns

2. **Counting**
    - **Two-person team**: one counts, one records/verifies
    - Count all items in the designated zone — no skipping
    - Record the **physical quantity**, location, and batch/lot number
    - Do not adjust system quantities during the count

3. **Reconciliation**
    - Compare physical counts to WMS system quantities
    - Flag all discrepancies for investigation

4. **Investigation** (for discrepancies >2%)
    - Check recent transactions: receipts, picks, returns, transfers
    - Review CCTV if theft is suspected
    - Interview warehouse operatives for explanations
    - Document findings

5. **Adjustment**
    - Supervisor approves all stock adjustments
    - Adjust the WMS with a clear reason code
    - Finance reviews adjustments above the materiality threshold

6. **Filing**
    - File count records, discrepancy reports, and adjustment approvals
    - Retain for a minimum of **7 years** for audit purposes

---

## Responsible Parties

- **Warehouse Supervisor**: Plans and oversees the count
- **Count Teams**: Conduct physical counts
- **Finance**: Reviews and approves adjustments
- **Auditor**: Reviews count accuracy during annual audit
`),
   ],

   professional: [
      RE('Client Onboarding', 'Engagement letters, KYC checks, and project kickoff.', ['client-services', 'compliance'], '🤝', `## Client Onboarding\n\n### Steps\n1. **Conflict Check** — Screen against existing client database\n2. **KYC/AML** — Verify identity, source of funds, and beneficial ownership\n3. **Engagement Letter** — Draft scope, fees, and terms; obtain signed copy\n4. **Matter Opening** — Create matter in practice management system\n5. **Team Assignment** — Assign partner, associate, and support staff\n6. **Kickoff Meeting** — Introduce the team, confirm scope, agree on communication cadence\n7. **File Setup** — Create digital file structure, grant access permissions`),
      RE('Billing & Invoicing', 'Time tracking, invoice generation, and payment follow-up.', ['finance', 'admin'], '💰', `## Billing & Invoicing\n\n### Time Recording\n- All billable time recorded daily in 6-minute increments (0.1 hours)\n- Narrative must describe the work performed\n- Non-billable time also recorded for resource planning\n\n### Invoice Process\n1. Partner reviews and approves WIP (work in progress) monthly\n2. Finance generates draft invoices by the 5th of each month\n3. Partner reviews and approves final invoices\n4. Invoices sent to client via email with payment details\n5. Payment terms: 30 days from invoice date\n\n### Collections\n- Aged 30+ days: friendly reminder email\n- Aged 60+ days: partner calls the client\n- Aged 90+ days: escalate to managing partner, consider suspend work`),
      RE('Document Review & Approval', 'Drafting, review, sign-off, and filing.', ['legal', 'quality'], '📝', `## Document Review & Approval\n\n### Workflow\n1. **Draft** — Associate prepares initial draft\n2. **Self-Review** — Author reviews for errors, formatting, and completeness\n3. **Peer Review** — Second associate reviews for accuracy\n4. **Partner Review** — Partner reviews and provides final edits\n5. **Client Approval** — Send to client for review and sign-off\n6. **Filing** — Save final executed version in document management system\n\n### Version Control\n- Use document management system (DMS) versioning\n- Never overwrite a previous version\n- Final versions marked as "FINAL" or locked`),
      RE('Conflict of Interest Check', 'Screening new clients and matters.', ['compliance', 'legal'], '⚖️', `## Conflict of Interest Check\n\n### When Required\n- Before accepting any new client\n- Before opening a new matter for an existing client\n- When a new party is added to a matter\n\n### Process\n1. Submit conflict check request (parties, matter description)\n2. Search client/matter database for matches\n3. Search personal interest declarations\n4. If conflict found → escalate to Ethics Partner\n5. If clear → approve and file the check result\n6. Retain conflict check records for 7 years`),
      RE('Staff Performance Review', 'Annual appraisals and development plans.', ['hr', 'management'], '📈', `## Staff Performance Review\n\n### Annual Cycle\n| Month | Activity |\n|-------|----------|\n| January | Set objectives for the year |\n| June | Mid-year review and feedback |\n| November | Self-assessment submitted |\n| December | Formal review meeting |\n\n### Review Meeting Agenda\n1. Review objectives — what was achieved?\n2. Discuss strengths and development areas\n3. Feedback from peers and clients\n4. Set objectives for next year\n5. Agree on training/development plan\n6. Discuss career progression and aspirations`),
      RE('Data Retention & Destruction', 'Archiving policies and secure disposal.', ['compliance', 'records'], '🗄️', `## Data Retention & Destruction\n\n### Retention Periods\n| Document Type | Retention Period |\n|--------------|------------------|\n| Client files (general) | 6 years after matter closed |\n| Tax records | 7 years |\n| Employee records | 6 years after leaving |\n| Financial records | 7 years |\n| Contracts | 6 years after expiry |\n\n### Destruction Process\n1. Review files due for destruction quarterly\n2. Partner approval required before destruction\n3. Paper: cross-cut shredding by approved vendor\n4. Digital: secure deletion with certificate of destruction\n5. Log all destroyed files in the destruction register`),
   ],

   education: [
      RE('Student Enrolment', 'Application processing and class allocation.', ['admin', 'student-services'], '🎒', `## Student Enrolment\n\n### Steps\n1. Receive application (online form or paper)\n2. Verify identity and previous qualifications\n3. Assess eligibility and entry requirements\n4. Issue offer letter (conditional or unconditional)\n5. Student accepts offer and pays deposit/fees\n6. Allocate to class/programme and issue timetable\n7. Send welcome pack with IT setup instructions`),
      RE('Lesson Planning Framework', 'Curriculum mapping, objectives, and assessment.', ['academic', 'teaching'], '📚', `## Lesson Planning Framework\n\n### Template\n- **Subject/Module**: [Name]\n- **Learning Objectives**: What students will be able to do by the end\n- **Starter** (10 mins): Hook activity to engage\n- **Main Activity** (30 mins): Core teaching and practice\n- **Plenary** (10 mins): Assessment of learning, Q&A\n- **Differentiation**: Support for struggling learners, extension for advanced\n- **Resources**: Handouts, slides, equipment needed\n- **Assessment**: How you'll check learning (quiz, observation, homework)`),
      RE('Safeguarding & Child Protection', 'DBS checks, reporting concerns, and training.', ['compliance', 'safety'], '🛡️', `## Safeguarding & Child Protection\n\n### Staff Requirements\n- Enhanced DBS check before starting\n- Safeguarding training within first week, refreshed annually\n- Know the Designated Safeguarding Lead (DSL) by name\n\n### Reporting a Concern\n1. Listen to the child — don't promise confidentiality\n2. Record exactly what was said (use their words)\n3. Report to the DSL immediately (same day)\n4. DSL decides whether to refer to local authority/police\n5. Do NOT investigate yourself\n6. All records kept securely and confidentially`),
      RE('Exam Administration', 'Scheduling, invigilation, and results.', ['academic', 'admin'], '📝', `## Exam Administration\n\n### Preparation\n1. Set exam timetable and book rooms 6 weeks in advance\n2. Arrange reasonable adjustments for SEN students (extra time, separate room)\n3. Print papers and store securely until exam day\n4. Brief invigilators on rules and procedures\n\n### On Exam Day\n1. Set up room (desks 1.25m apart, clock visible, no posters)\n2. Verify student identity at the door\n3. Read exam instructions aloud\n4. Start timer and record start/finish times\n5. Handle any incidents (illness, rule breaking) per policy\n\n### After Exam\n1. Collect all papers and count against attendance\n2. Secure scripts and deliver to marking team\n3. Process results and issue within agreed timeframe`),
      RE('Parent Communication Protocol', 'Reports, meetings, and complaint handling.', ['communication', 'admin'], '✉️', `## Parent Communication Protocol\n\n### Channels\n| Type | Method | Frequency |\n|------|--------|-----------|\n| General updates | Newsletter/app | Weekly |\n| Progress reports | Written report | Termly |\n| Concerns | Phone/email | As needed |\n| Formal meetings | Face-to-face | Annual (min) |\n\n### Parent-Teacher Meeting\n1. Schedule in advance (email + app notification)\n2. Prepare student progress summary\n3. Start with positives, then discuss areas for improvement\n4. Agree on action points for home and school\n5. Record meeting notes and share with parent`),
      RE('IT Equipment Loan Process', 'Device issuing, acceptable use, and return.', ['it', 'admin'], '💻', `## IT Equipment Loan\n\n### Issuing\n1. Student/staff submits loan request\n2. Sign acceptable use policy (AUP)\n3. Record device serial number, condition, and date issued\n4. Configure device with required software and security settings\n5. Issue device and charger\n\n### During Loan\n- Device remains school property\n- No unauthorised software installation\n- Report damage or loss within 24 hours\n- IT support available via helpdesk\n\n### Return\n1. Inspect device for damage\n2. Factory reset to remove personal data\n3. Update inventory system\n4. Charge any repair costs if damaged beyond normal wear`),
   ],

   retail: [
      RE('Point of Sale (POS) Operations', 'Transaction processing and end-of-day reconciliation.', ['sales', 'finance'], '🛒', `## POS Operations\n\n### Opening\n1. Count float and verify against log (£150 standard float)\n2. Log in to POS terminal\n3. Check receipt paper and card terminal connection\n\n### Processing Sales\n1. Scan items or enter SKU manually\n2. Apply discounts/promotions as per current campaign\n3. Process payment (cash, card, contactless, gift card)\n4. Issue receipt (paper or digital)\n\n### End of Day\n1. Run Z-report (end of day sales total)\n2. Count cash drawer and reconcile against Z-report\n3. Bag cash for safe deposit\n4. Clean and cover terminal\n5. Report any discrepancies to manager immediately`),
      RE('Stock Replenishment', 'Reorder triggers and shelf stocking.', ['inventory', 'operations'], '📦', `## Stock Replenishment\n\n### Reorder Process\n1. POS system flags items below minimum stock level\n2. Review suggested orders weekly (or daily for fast-movers)\n3. Approve purchase order and send to supplier\n4. Receive delivery and verify against PO\n5. Update inventory system and put stock away\n\n### Shelf Stocking\n- FIFO method: First In, First Out (oldest stock to front)\n- Check expiry dates and remove expired items\n- Face up products for neat presentation\n- Maximum shelf height: items reachable without a ladder`),
      RE('Customer Returns & Exchanges', 'Return policy and refund processing.', ['customer-service', 'sales'], '🔄', `## Returns & Exchanges\n\n### Policy\n- Returns accepted within 30 days with proof of purchase\n- Items must be unused, with original packaging and tags\n- Sale items: exchange or credit note only\n- Faulty items: full refund regardless of timeline\n\n### Process\n1. Check receipt / transaction lookup in POS\n2. Inspect item condition\n3. Process refund to original payment method\n4. Issue exchange or credit note if applicable\n5. Return item to stock (if resaleable) or mark for write-off\n6. Record reason for return in system for trend analysis`),
      RE('Visual Merchandising Standards', 'Display setup and seasonal changeovers.', ['marketing', 'operations'], '🎨', `## Visual Merchandising\n\n### Window Displays\n- Changed every 2 weeks (or per campaign schedule)\n- Must tell a story: theme, colour palette, focal point\n- Include price points for at least 3 items\n- Lighting checked and adjusted for time of day\n\n### In-Store Layout\n- Power wall (first wall customers see): feature new arrivals\n- Eye-level shelving: highest margin products\n- End caps: promotional items or bundles\n- Signage: clear pricing, consistent brand fonts and colours\n\n### Seasonal Changeover\n1. Plan layout 4 weeks before season launch\n2. Order POS materials and signage\n3. Brief staff on key products and talking points\n4. Execute changeover overnight or during quiet hours\n5. Take photos and share with area manager for approval`),
      RE('Loss Prevention & Security', 'Anti-theft measures and incident reporting.', ['security', 'operations'], '🔐', `## Loss Prevention\n\n### Preventive Measures\n- Greet every customer entering the store (deters theft)\n- Security tags on all items above £20\n- CCTV monitored during trading hours\n- High-value items behind counter or in locked cabinets\n- Regular stock audits (cycle counting)\n\n### If Theft Suspected\n1. Do NOT confront the individual\n2. Observe and note description (clothing, features, direction)\n3. Alert security or manager discreetly\n4. Let security/police handle the situation\n5. Complete incident report with CCTV timestamp\n6. Preserve CCTV footage for police request`),
      RE('Online Order Fulfilment', 'Pick, pack, ship, and click-and-collect.', ['ecommerce', 'logistics'], '🚚', `## Online Order Fulfilment\n\n### Pick & Pack\n1. Print pick list from the order management system\n2. Pick items from shelves, scan to verify correct SKU\n3. Pack securely with branded packaging and packing slip\n4. Weigh and apply shipping label\n5. Hand over to courier or place in collection area\n\n### Click & Collect\n1. Pick and pack as above\n2. Label with customer name and order number\n3. Store in designated collection area\n4. Send "ready for collection" notification to customer\n5. Verify customer ID at collection point\n6. If not collected in 7 days, return to stock and refund`),
   ],

   construction: [
      RE('Site Induction & Safety Briefing', 'New worker orientation and PPE.', ['safety', 'hr'], '🦺', `## Site Induction\n\n### Before Access\n- [ ] Valid CSCS card verified\n- [ ] Site-specific induction completed\n- [ ] H&S booklet signed\n- [ ] PPE checked: helmet, boots, hi-vis, gloves, eye/ear protection\n- [ ] Emergency procedures understood\n\n### Induction Content\n1. Site layout, access points, and restricted areas\n2. Emergency exits and assembly points\n3. First aiders and nearest hospital\n4. Working hours and break times\n5. Reporting accidents and near-misses\n6. Environmental controls (dust, noise, waste management)`),
      RE('Permit to Work System', 'Hot works, confined spaces, and height permits.', ['safety', 'compliance'], '📋', `## Permit to Work\n\n### Types\n| Permit | Required For |\n|--------|--------------|\n| Hot Works | Welding, cutting, grinding |\n| Confined Spaces | Tanks, pits, manholes |\n| Working at Height | Scaffolding, roofwork, ladders > 2m |\n| Excavation | Digging > 300mm deep |\n| Electrical | Work on live or isolated systems |\n\n### Process\n1. Contractor requests permit from site manager\n2. Risk assessment and method statement (RAMS) reviewed\n3. Site manager inspects area and approves permit\n4. Permit displayed at work location\n5. Work completed within permit timeframe\n6. Area inspected after work completed (especially hot works — 60-min fire watch)\n7. Permit closed and signed off`),
      RE('Material Procurement & Delivery', 'Supplier selection and goods receiving.', ['procurement', 'logistics'], '🏗️', `## Material Procurement\n\n### Ordering\n1. Site manager raises material requisition\n2. QS/procurement checks budget and approves\n3. Select supplier (from approved list or 3 quotes)\n4. Issue purchase order with delivery date and site address\n5. Confirm delivery slot to avoid site congestion\n\n### Receiving\n1. Check delivery note against PO\n2. Inspect materials for damage or defects\n3. Reject and note any non-conforming items\n4. Store in designated laydown area\n5. Update material tracker and notify site team`),
      RE('Daily Site Inspection', 'Safety walk, progress check, and snag list.', ['quality', 'safety'], '👷', `## Daily Site Inspection\n\n### Checklist\n- [ ] Perimeter security intact (hoarding, gates locked)\n- [ ] Scaffolding inspected and tagged\n- [ ] Excavations shored and fenced\n- [ ] All workers wearing correct PPE\n- [ ] Welfare facilities clean and stocked\n- [ ] Fire extinguishers accessible and in date\n- [ ] Waste separated correctly (general, recyclable, hazardous)\n\n### Progress Check\n1. Walk each active zone\n2. Compare progress against programme\n3. Note any delays and causes\n4. Update progress photos\n5. Raise any quality issues on the snag list`),
      RE('Project Handover & Close-Out', 'Snagging, inspections, and client handover.', ['project-management', 'quality'], '🔑', `## Project Handover\n\n### Pre-Handover\n1. Complete snagging inspection (compile defects list)\n2. Rectify all snags and re-inspect\n3. Obtain all sign-offs: building control, fire safety, utilities\n4. Compile O&M manuals (operation & maintenance documentation)\n5. Collate all certificates (electrical, gas, structural)\n\n### Handover Meeting\n1. Walk the client through the completed works\n2. Demonstrate building systems (HVAC, fire alarm, security)\n3. Hand over keys, fobs, and access codes\n4. Provide warranty information and defects contact\n5. Sign practical completion certificate\n\n### Defects Period (typically 12 months)\n- Client reports defects to contractor\n- Contractor rectifies within agreed SLA\n- Final certificate issued at end of defects period`),
      RE('Accident & Near-Miss Reporting', 'Incident forms and corrective actions.', ['safety', 'compliance'], '⚠️', `## Accident & Near-Miss Reporting\n\n### Immediate Actions\n1. Ensure the injured person is safe and getting first aid\n2. Secure the scene to prevent further incidents\n3. Notify the site manager immediately\n\n### Reporting\n1. Complete the accident/incident report form within 1 hour\n2. Take photographs of the scene\n3. Collect witness statements\n4. For RIDDOR-reportable incidents: notify HSE within 15 days (UK)\n5. For fatalities or major injuries: notify HSE immediately\n\n### Investigation\n1. Root cause analysis (5 Whys method)\n2. Identify corrective and preventive actions\n3. Implement changes and communicate to all site personnel\n4. Review and update risk assessments\n5. Close out actions and verify effectiveness`),
   ],

   other: [
      RE('Employee Onboarding', 'Contracts, IT setup, and first-week schedule.', ['hr', 'onboarding'], '👋', `## Employee Onboarding\n\n### Pre-Start\n- [ ] Employment contract signed\n- [ ] IT equipment ordered and configured\n- [ ] Email account and system access created\n- [ ] Desk/workspace prepared\n- [ ] Welcome email sent with Day 1 agenda\n\n### Day 1\n1. Welcome and introductions\n2. IT login and systems walkthrough\n3. Company policies and handbook review\n4. H&S briefing and fire drill info\n5. Lunch with the team\n\n### Week 1\n- [ ] Complete mandatory online training\n- [ ] 1:1 with manager to set expectations\n- [ ] Meet key stakeholders\n- [ ] Buddy assigned for support\n- [ ] End-of-week check-in`),
      RE('Customer Complaint Handling', 'Logging, investigation, and resolution.', ['customer-service', 'quality'], '💬', `## Customer Complaint Handling\n\n### Steps\n1. **Log** — Record complaint with date, customer details, and description\n2. **Acknowledge** — Respond within 24 hours confirming receipt\n3. **Investigate** — Gather facts, speak to relevant staff\n4. **Resolve** — Propose a fair resolution to the customer\n5. **Follow Up** — Check customer is satisfied after 7 days\n6. **Analyse** — Review complaints monthly for recurring patterns\n\n### Escalation\n- Unresolved after 48 hours → escalate to line manager\n- Unresolved after 7 days → escalate to senior management\n- If legal or regulatory → involve compliance team immediately`),
      RE('Purchase Requisition', 'Request submission, approval, and payment.', ['finance', 'procurement'], '🛍️', `## Purchase Requisition\n\n### Process\n1. Requester submits purchase request (item, quantity, estimated cost, justification)\n2. Line manager approves if within budget authority\n3. Finance reviews orders above threshold (e.g. £1,000)\n4. Procurement sources supplier and obtains quotes\n5. Purchase order issued to supplier\n6. Goods received and checked against PO\n7. Invoice matched to PO and goods receipt (3-way match)\n8. Payment processed within agreed terms (typically 30 days)`),
      RE('Office Opening & Closing', 'Security checks and daily setup.', ['operations', 'security'], '🔑', `## Office Opening & Closing\n\n### Opening\n1. Disarm alarm system using your personal code\n2. Check all areas for anything unusual\n3. Turn on lights, HVAC, and shared equipment\n4. Check meeting rooms are tidy and set up\n5. Unlock main entrance at business hours\n\n### Closing\n1. Walk all areas — ensure everyone has left\n2. Close and lock all windows\n3. Turn off lights, HVAC, and non-essential equipment\n4. Lock all entry/exit doors\n5. Arm the alarm system\n6. Log closing time and any issues in the security book`),
      RE('Data Backup Procedure', 'Scheduled backups and disaster recovery testing.', ['it', 'security'], '💾', `## Data Backup\n\n### Schedule\n| Type | Frequency | Retention |\n|------|-----------|----------|\n| Full backup | Weekly (Sunday) | 90 days |\n| Incremental | Daily | 30 days |\n| Database | Every 6 hours | 30 days |\n\n### Process\n1. Automated backup runs per schedule\n2. Verify backup completed successfully (check logs)\n3. Test restore monthly (to isolated environment)\n4. Encrypt all backups at rest\n5. Store offsite copy in a different region\n\n### Disaster Recovery\n- RTO (Recovery Time Objective): 4 hours\n- RPO (Recovery Point Objective): 6 hours\n- Test full DR scenario twice per year`),
      RE('Health & Safety Risk Assessment', 'Hazard identification and control measures.', ['safety', 'compliance'], '⛑️', `## Risk Assessment\n\n### 5-Step Process\n1. **Identify Hazards** — Walk the workplace, review incident reports\n2. **Identify Who's at Risk** — Staff, visitors, contractors, vulnerable persons\n3. **Evaluate the Risk** — Likelihood × Severity = Risk Rating\n4. **Record Control Measures** — What you're doing to reduce risk\n5. **Review** — Annually or after any incident/change\n\n### Risk Matrix\n| | Low Severity | Medium | High |\n|---|---|---|---|\n| **Likely** | Medium | High | Critical |\n| **Possible** | Low | Medium | High |\n| **Unlikely** | Low | Low | Medium |\n\n### Control Hierarchy (ERIC-PD)\n1. **E**liminate the hazard\n2. **R**educe the risk\n3. **I**solate people from the hazard\n4. **C**ontrol with safe systems of work\n5. **P**PE as last resort\n6. **D**iscipline — enforce the rules`),
   ],
};

// ---------------------------------------------------------------------------
// Starter questions — curated openers the AI interviewer works through to help
// the user get going. Keyed by template title; industry fallbacks below cover
// custom (no-template) processes.
// ---------------------------------------------------------------------------

const TEMPLATE_STARTER_QUESTIONS: Record<string, string[]> = {
   // --- Tech ---
   'Software Deployment Process': [
      'How does code currently get from a developer\'s machine to production — what tools and environments are involved?',
      'Who has to approve a release before it goes live, and how do they sign off?',
      'What happens today when a deployment goes wrong — is there a rollback procedure?',
      'How often do you deploy, and are there any windows when deployments are not allowed?',
   ],
   'Incident Response Plan': [
      'How do you currently find out that something is broken — monitoring alerts, customer reports, or both?',
      'Who gets called first when there is an outage, and how do you reach them out of hours?',
      'How do you decide how serious an incident is, and does that change who gets involved?',
      'What do you do after an incident is resolved — is there a review or write-up?',
   ],
   'New Employee Onboarding': [
      'Walk me through a new hire\'s first day — what needs to be ready before they arrive?',
      'What accounts, tools, and access does a new team member need, and who sets those up?',
      'Who is responsible for training the new person, and how long does ramp-up usually take?',
      'What do new hires most often get stuck on in their first month?',
   ],
   'Code Review Guidelines': [
      'What does a developer do when their code is ready for review — where do reviews happen?',
      'Who is allowed to approve changes, and how many approvals do you require?',
      'What are the most common problems reviewers catch — and what should always block a merge?',
      'How quickly do you expect reviews to be done, and what happens when they pile up?',
   ],
   'Data Backup & Recovery': [
      'What data would hurt most if you lost it, and where does it live today?',
      'How are backups currently made — automatically or manually, and how often?',
      'Have you ever had to restore from a backup? How did that go?',
      'How quickly would you need to be back up and running after a data loss?',
   ],
   'Client Data Handling (GDPR)': [
      'What personal data do you collect from clients, and where is it stored?',
      'Who in the team can access client data, and is that access ever reviewed?',
      'What would you do today if a client asked you to delete everything you hold on them?',
      'Have you defined how long you keep client data before deleting it?',
   ],

   // --- Real estate ---
   'Property Listing Process': [
      'Walk me through what happens from the moment an owner says "sell my property" to the listing going live.',
      'What information and documents do you collect from the owner before listing?',
      'Who takes the photos and writes the description, and where does the listing get published?',
      'What legal checks or paperwork must be complete before you can advertise a property?',
   ],
   'Tenant Screening & Onboarding': [
      'What checks do you run on a prospective tenant before offering a contract?',
      'What documents does a tenant need to provide, and who verifies them?',
      'How do you handle the deposit — where is it held and how is that documented?',
      'What happens on move-in day — inventory, keys, meter readings?',
   ],
   'Property Viewing Protocol': [
      'How do viewings get booked, and who confirms them with the owner or current tenant?',
      'What does the agent prepare before a viewing — keys, access, property details?',
      'What safety rules do you have for agents showing properties alone?',
      'How do you follow up with the prospect and the owner after a viewing?',
   ],
   'Rent Collection & Arrears': [
      'How is rent collected today, and on what day is it due?',
      'How quickly do you notice a missed payment, and what is the first thing you do?',
      'What are the escalation steps when a tenant falls further behind?',
      'At what point do you involve lawyers or start formal proceedings?',
   ],
   'Property Maintenance Request': [
      'How do tenants report a problem today — phone, email, an app?',
      'How do you decide whether something is an emergency or can wait?',
      'Which contractors do you use, and who approves the cost of a repair?',
      'How do you confirm the work was done properly and close the request?',
   ],
   'Compliance Checks (EPC, Gas, EICR)': [
      'Which safety and energy certificates do your properties need in your market?',
      'How do you currently track when each certificate expires?',
      'Who books the inspections and holds the relationship with the engineers?',
      'What do you do when a property fails an inspection?',
   ],

   // --- Healthcare ---
   'Patient Intake Process': [
      'What happens from the moment a new patient contacts you to their first appointment?',
      'What information and consents must be collected before a patient can be seen?',
      'How do you verify insurance or payment details, and who does that?',
      'What system do you record patient details in, and who has access?',
   ],
   'Medication Administration': [
      'Who is authorised to administer medication in your setting?',
      'How do you verify the right patient gets the right medication and dose?',
      'How are administrations recorded, and what happens if a dose is missed?',
      'What is the procedure when a medication error occurs?',
   ],
   'Infection Control Protocol': [
      'What are the highest infection risks in your setting day to day?',
      'What hygiene routines do staff follow between patients?',
      'How do you handle a suspected infectious patient — isolation, reporting, cleaning?',
      'How is compliance checked, and who is your infection control lead?',
   ],
   'Medical Records Management': [
      'Where are patient records kept, and are any still on paper?',
      'Who can view or edit a record, and how are changes tracked?',
      'How do you handle a patient requesting a copy of their records?',
      'How long do you retain records, and how are old ones destroyed?',
   ],
   'Emergency Response Plan': [
      'What kinds of emergencies are most likely in your practice or facility?',
      'Who takes charge in an emergency, and how are roles assigned?',
      'Where is emergency equipment kept, and who checks it?',
      'How do staff practise — do you run drills?',
   ],
   'Staff Credentialling & Training': [
      'What licences or registrations must each clinical role hold?',
      'How do you check credentials when hiring, and how do you track expiry dates?',
      'What mandatory training must staff refresh, and how often?',
      'What happens if someone\'s credential lapses?',
   ],

   // --- Hospitality ---
   'Guest Check-In / Check-Out': [
      'Walk me through what happens when a guest arrives at your front desk.',
      'What details do you verify at check-in, and what do you hand the guest?',
      'How does check-out work — payment, key return, feedback?',
      'How do you handle early arrivals, late check-outs, and no-shows?',
   ],
   'Housekeeping Standards': [
      'What does a full room clean include, step by step?',
      'How do housekeepers know which rooms to clean and in what order?',
      'Who inspects rooms after cleaning, and against what checklist?',
      'How do you handle lost property found in rooms?',
   ],
   'Food Safety & Hygiene (HACCP)': [
      'What food do you prepare on site, and what are the riskiest steps?',
      'How do you monitor fridge and cooking temperatures, and where is that logged?',
      'How do you prevent cross-contamination, especially for allergens?',
      'What checks happen when deliveries arrive from suppliers?',
   ],
   'Guest Complaint Resolution': [
      'What do guests complain about most often?',
      'What is front-line staff allowed to offer a guest to fix a problem, without asking a manager?',
      'When must a complaint be escalated, and to whom?',
      'How do you record complaints and spot repeat problems?',
   ],
   'Event Setup & Breakdown': [
      'What types of events do you host, and what does a typical setup involve?',
      'How far in advance is the event plan confirmed, and who owns it?',
      'Who is on the setup team, and how do they know the layout?',
      'What has to happen after the event before the space is back to normal?',
   ],
   'Fire Safety & Evacuation': [
      'What fire detection and fighting equipment do you have, and who checks it?',
      'Who are your fire marshals, and what are their duties in an evacuation?',
      'How do you account for guests during an evacuation, including those needing assistance?',
      'When did you last run a fire drill, and what did you learn?',
   ],

   // --- Manufacturing ---
   'Production Line Setup': [
      'Walk me through starting a production line at the beginning of a shift.',
      'What settings, tooling, or materials change between different products?',
      'What checks confirm the line is producing good parts before a full run?',
      'What are the most common setup mistakes, and what do they cost you?',
   ],
   'Quality Inspection (QC)': [
      'At what points in production do you inspect — incoming, in-process, final?',
      'What do inspectors measure or look for, and with what equipment?',
      'What happens to a part or batch that fails inspection?',
      'How are inspection results recorded and reported?',
   ],
   'Equipment Maintenance Schedule': [
      'Which machines are most critical — the ones that stop everything when they fail?',
      'What maintenance is done on a schedule versus only when something breaks?',
      'Who performs maintenance, and how is it logged?',
      'How do operators report a machine that seems off before it fails?',
   ],
   'Warehouse Receiving & Shipping': [
      'What happens when a delivery arrives — who checks it and against what?',
      'How is stock put away and located later?',
      'Walk me through picking and packing an outbound order.',
      'How do you handle damaged goods or quantity mismatches?',
   ],
   'Health & Safety Induction': [
      'What are the biggest hazards a new worker faces in your facility?',
      'What must a new worker complete before they can work unsupervised?',
      'What PPE is required in each area, and who provides it?',
      'How do workers report hazards or near-misses?',
   ],
   'Inventory Stock Take': [
      'How often do you count stock, and is it everything at once or cycle counts?',
      'Who counts, and how do you make sure counts are accurate?',
      'What do you do when the count doesn\'t match the system?',
      'Does production or shipping stop during a count?',
   ],

   // --- Professional services ---
   'Client Onboarding': [
      'What happens between a client saying "yes" and work actually starting?',
      'What checks must you run on a new client before engaging — conflicts, identity, anti-money-laundering?',
      'What goes into your engagement letter, and who approves it?',
      'How is the team introduced to the client and the work kicked off?',
   ],
   'Billing & Invoicing': [
      'How is billable work tracked today, and by whom?',
      'Who reviews and approves an invoice before it goes to the client?',
      'What are your payment terms, and how do you chase late payers?',
      'How do you handle disputes over an invoice?',
   ],
   'Document Review & Approval': [
      'What kinds of documents need formal review before they leave the firm?',
      'Who reviews what — is there a hierarchy of sign-offs?',
      'How do you track versions and make sure the right one is sent?',
      'Where are final documents stored, and who can access them?',
   ],
   'Conflict of Interest Check': [
      'When do you run conflict checks — every new client, every new matter?',
      'What do you actually search, and who runs the search?',
      'What happens when a potential conflict is found?',
      'How are check results recorded and for how long?',
   ],
   'Staff Performance Review': [
      'How often do formal reviews happen, and who conducts them?',
      'What is discussed — objectives, feedback, development, pay?',
      'How do you gather input from colleagues and clients?',
      'What happens after the review — how are agreed actions followed up?',
   ],
   'Data Retention & Destruction': [
      'What types of records do you hold, and are there legal minimum retention periods in your field?',
      'How do you find files that are due for destruction?',
      'Who must approve destroying a file?',
      'How are paper and digital files actually destroyed, and is that certified?',
   ],

   // --- Education ---
   'Student Enrolment': [
      'How do prospective students apply, and what happens to an application first?',
      'What entry requirements or documents do you verify?',
      'How does an applicant become an enrolled student — offer, acceptance, payment?',
      'What information does a new student receive before their first day?',
   ],
   'Lesson Planning Framework': [
      'How do teachers plan lessons today — is there a shared template?',
      'How do lessons link back to the curriculum or scheme of work?',
      'How do you plan for students who need extra support or extra challenge?',
      'How is learning checked during and after a lesson?',
   ],
   'Safeguarding & Child Protection': [
      'Who is your Designated Safeguarding Lead, and does every member of staff know?',
      'What must a staff member do the moment a child discloses something concerning?',
      'What vetting do staff and volunteers go through before starting?',
      'How and where are safeguarding concerns recorded?',
   ],
   'Exam Administration': [
      'What exams do you run, and who oversees them?',
      'How do you arrange extra time or adjustments for students who need them?',
      'How are exam papers kept secure before and after the exam?',
      'What happens if there is an incident during an exam — illness, suspected cheating?',
   ],
   'Parent Communication Protocol': [
      'What channels do you use to communicate with parents, and for what?',
      'How quickly do you commit to responding to a parent\'s concern?',
      'How are parent-teacher meetings scheduled and documented?',
      'How do you handle a parent complaint that isn\'t resolved by the teacher?',
   ],
   'IT Equipment Loan Process': [
      'What devices do you lend out, and to whom?',
      'What does a borrower agree to before receiving a device?',
      'How do you track who has what, and when it is due back?',
      'What happens when a device comes back damaged — or doesn\'t come back?',
   ],

   // --- Retail ---
   'Point of Sale (POS) Operations': [
      'Walk me through opening a till at the start of the day.',
      'What payment methods do you accept, and what goes wrong most often at the till?',
      'How does end-of-day cashing up work, and who checks it?',
      'What does a cashier do when the till doesn\'t balance?',
   ],
   'Stock Replenishment': [
      'How do you know when to reorder a product — system alerts or someone noticing?',
      'Who places orders with suppliers, and who approves them?',
      'What happens when a delivery arrives — checking, booking in, shelving?',
      'How do you rotate stock and handle products close to expiry?',
   ],
   'Customer Returns & Exchanges': [
      'What is your returns policy — time limit, receipt required, condition?',
      'What can shop-floor staff decide themselves, and when must a manager step in?',
      'How is a refund actually processed at the till?',
      'What happens to returned items — back on the shelf, repaired, written off?',
   ],
   'Visual Merchandising Standards': [
      'Who decides how displays look — head office plans or store discretion?',
      'How often do window and in-store displays change?',
      'What rules do you have about pricing, signage, and product placement?',
      'How is a completed display checked or approved?',
   ],
   'Loss Prevention & Security': [
      'Where do you lose most stock today — theft, damage, admin errors?',
      'What should a staff member do if they suspect someone is stealing?',
      'What security measures do you have — tags, CCTV, locked cabinets?',
      'How are incidents recorded and reported?',
   ],
   'Online Order Fulfilment': [
      'Where do online orders come in, and who picks them up?',
      'Walk me through picking, packing, and dispatching an order.',
      'How does click-and-collect work in your store?',
      'What happens with an order you can\'t fulfil — out of stock, address problems?',
   ],

   // --- Construction ---
   'Site Induction & Safety Briefing': [
      'What must a new worker or visitor complete before setting foot on site?',
      'What does your induction cover, and who delivers it?',
      'What cards, tickets, or qualifications do you verify?',
      'How do you record who has been inducted on each site?',
   ],
   'Permit to Work System': [
      'Which activities on your sites require a permit before work starts?',
      'Who issues permits, and what do they check first?',
      'How long is a permit valid, and what closes it out?',
      'What happens if work is found happening without a permit?',
   ],
   'Material Procurement & Delivery': [
      'Who decides what materials to order, and who approves the spend?',
      'How do you choose suppliers — approved list, quotes, relationships?',
      'What happens when a delivery arrives on site?',
      'How do you handle wrong, damaged, or late deliveries?',
   ],
   'Daily Site Inspection': [
      'Who walks the site each day, and when?',
      'What do they check — safety, progress, quality, security?',
      'How are issues found on the walk recorded and assigned?',
      'How do you track that raised issues actually get fixed?',
   ],
   'Project Handover & Close-Out': [
      'What must be finished and signed off before you hand a project to the client?',
      'How do you manage the snag list — who inspects, who fixes, who re-checks?',
      'What documents and certificates go to the client at handover?',
      'How do you handle defects the client reports after handover?',
   ],
   'Accident & Near-Miss Reporting': [
      'What should a worker do in the first minutes after an accident on site?',
      'How are accidents and near-misses reported, and on what form or system?',
      'Which incidents must be reported to the authorities in your country?',
      'How do you investigate what went wrong and stop it happening again?',
   ],

   // --- Other / general ---
   'Employee Onboarding': [
      'Walk me through a new employee\'s first day — what needs to be ready before they arrive?',
      'What paperwork, accounts, and equipment does a new starter need, and who arranges them?',
      'Who trains the new person, and what must they learn in the first week?',
      'How do you check in on how a new starter is settling in?',
   ],
   'Customer Complaint Handling': [
      'How do complaints reach you today — phone, email, in person, reviews?',
      'Who logs a complaint, and where is it recorded?',
      'What can front-line staff resolve themselves, and what must be escalated?',
      'How do you make sure the customer hears back, and how fast?',
   ],
   'Purchase Requisition': [
      'How does someone in your company request something to be bought?',
      'Who can approve purchases, and are there spending limits per role?',
      'How do you choose suppliers and confirm prices?',
      'How is the invoice matched to what was ordered and received?',
   ],
   'Office Opening & Closing': [
      'Who opens the office, and what do they do first?',
      'What security steps happen at closing — alarms, locks, equipment?',
      'What should the opener do if something looks wrong on arrival?',
      'Who holds keys and alarm codes, and how is that tracked?',
   ],
   'Data Backup Procedure': [
      'What data would hurt most if you lost it, and where does it live today?',
      'How are backups made now — automatically or manually, and how often?',
      'Has anyone ever tested restoring from a backup?',
      'How quickly would the business need to be running again after a data loss?',
   ],
   'Health & Safety Risk Assessment': [
      'What are the main hazards in your workplace day to day?',
      'Who could be harmed — staff, visitors, contractors, the public?',
      'What are you already doing to control those risks?',
      'When were your risk assessments last reviewed, and who owns them?',
   ],
};

export const INDUSTRY_STARTER_QUESTIONS: Record<IndustryCode, string[]> = {
   tech: [
      'What process would you like to document, and what triggers it — a request, an alert, a schedule?',
      'Which tools and systems are involved at each step?',
      'Who is responsible for each part, and where do handoffs happen?',
      'What goes wrong most often, and how do you recover?',
   ],
   healthcare: [
      'What process would you like to document, and who is involved — clinical staff, admin, patients?',
      'What must happen in what order, and which steps are safety-critical?',
      'What records or consents must be completed along the way?',
      'What regulations or clinical standards does this process have to meet?',
   ],
   hospitality: [
      'What process would you like to document, and where does it happen — front of house, kitchen, housekeeping?',
      'Walk me through it from the guest\'s perspective — what do they experience?',
      'Who on the team does each step, and during which shifts?',
      'What do you do when things go wrong — a complaint, a shortage, a no-show?',
   ],
   manufacturing: [
      'What process would you like to document, and where does it sit in production?',
      'What materials, machines, and settings are involved?',
      'What quality checks happen, and what do you do with failures?',
      'What are the safety requirements for anyone doing this work?',
   ],
   professional: [
      'What process would you like to document, and what triggers it — a new client, a deadline, a request?',
      'Who does each step, and who must review or approve?',
      'What documents are produced, and where are they stored?',
      'What compliance or regulatory rules shape how this must be done?',
   ],
   education: [
      'What process would you like to document, and who does it involve — students, staff, parents?',
      'When does it happen — daily, termly, at enrolment?',
      'What records must be kept, and who maintains them?',
      'Are there safeguarding or regulatory requirements to respect?',
   ],
   retail: [
      'What process would you like to document, and where does it happen — shop floor, stockroom, online?',
      'Walk me through it step by step as it happens on a normal day.',
      'Who is responsible for each part, and what can they decide themselves?',
      'What goes wrong most often, and how should staff handle it?',
   ],
   construction: [
      'What process would you like to document, and at what stage of a project does it happen?',
      'Who is involved — your own team, subcontractors, the client?',
      'What safety requirements and permits apply?',
      'What paperwork or records does it produce?',
   ],
   real_estate: [
      'What process would you like to document, and what triggers it — a new instruction, a tenant issue, a viewing?',
      'Walk me through it from start to finish as it works today.',
      'What documents and legal requirements are involved in your market?',
      'Who does each step, and where do delays usually happen?',
   ],
   other: [
      'What process would you like to document, and what makes it start?',
      'Walk me through it step by step as it works today.',
      'Who is responsible for each step, and what tools do they use?',
      'What goes wrong most often, and what should happen when it does?',
   ],
};

/**
 * Resolve the starter questions for an interview: the template's curated set
 * when one is selected, otherwise the industry-level fallback.
 */
export const getStarterQuestions = (
   template: SOPTemplate | null,
   industry: IndustryCode
): string[] =>
   (template && (template.starterQuestions ?? TEMPLATE_STARTER_QUESTIONS[template.title])) ||
   INDUSTRY_STARTER_QUESTIONS[industry] ||
   INDUSTRY_STARTER_QUESTIONS.other;
