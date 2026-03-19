# Department Supervisor Overview Mockup — JSX + Mock Data Reference

> **Purpose:** A compact, implementation-facing reference for the **current JSX prototype** (the running canvas mock) and its **mock-data contract/fixtures**, so another AI/dev system can understand and extend it quickly.

---

## 1) What this file is (and isn’t)

### This is
- A “how the prototype works” guide:
  - Component structure
  - State variables
  - Derived calculations
  - UI behaviors
  - Mock data inputs/shape

### This isn’t
- A full product spec (see **Dev Requirements vNext.1** / **Design Reference** for intent).

---

## 2) Source artifacts to copy with this doc

1) **JSX prototype code** (canvas React component)
   - The current code includes:
     - helper functions (`cn`, `clamp`, formatters)
     - demo clock + settings
     - chart + table + popovers

2) **API-contract fixtures JSON**
   - `department_overview_api_contract_fixtures.json`
   - Contains request→response fixtures for:
     - Department view
     - Workstation view (Bench 1..N)
     - Every report interval

3) **Design docs**
   - “Department Overview (Supervisor) — Dev Requirements vNext.1”
   - “Department Supervisor Overview Prototype — Design Reference”

---

## 3) Component architecture

### 3.1 Top-level component
- Single page component: `DepartmentSupervisorOverviewHiFi`.
- Main regions:
  1) Sticky header
  2) KPI area (Plan + Current)
  3) Content row: Cycle chart + Blocked
  4) Workstations table

### 3.2 Shared helpers
- `cn(...classes)` — lightweight className joiner (Tailwind).
- `clamp(n, min, max)`
- Time formatting:
  - `fmtTimeOfDay(minutes)`
  - `intervalLabel(startHour, index, intervalMinutes)`
- `ordinal(n)` for rank pill.

### 3.3 Popovers
- `HelpEye` component uses a subdued **Info** icon (lucide), with reduced opacity.
- Popovers include concise **developer-friendly formulas**.

---

## 4) State variables and demo behavior

### 4.1 Primary state
- `goalUnits` (editable input)
- `shiftHours` (settings)
- `intervalMinutes` (settings)
- `asOfInterval` (demo clock index)
- `cycleView` (`dept` or a bench view)

### 4.2 Demo clock
- Report time is **end-of-interval**.
- Arrow behavior:
  - Up: `asOfInterval += 1`
  - Down: `asOfInterval -= 1`
  - Clamped to 0..(intervalCount-1)

**Formula (shown in popover):**
- `reportTime = min(shiftEnd, shiftStart + (asOfInterval + 1) * intervalMinutes)`

### 4.3 Interval count
- `intervalCount = ceil((shiftHours * 60) / intervalMinutes)`

---

## 5) UI requirements by region

### 5.1 Header
- Warehouse + Department context (display-only for mock)
- Filters (placeholder)
- Report time (demo clock)
- Settings icon button

### 5.2 KPI panels
Two side-by-side panels:

**Plan panel**
- Goal (editable)
- Planned throughput
  - main: dept units/hr
  - sub-caption: per-bench units/hr/bench
- Department takt
  - main: dept takt seconds
  - sub-caption: Target cycle/bench seconds

**Current panel**
- Out (so far)
- Gap vs goal plan + state badge
- Dept cycle (current): Avg + Slow

**Popovers must include (concise):**
- Throughput: `goalUnits / shiftHours`, `/ benchCount`
- Takt: `(shiftHours * 3600) / goalUnits`
- Target cycle/bench: `deptTakt * benchCount`
- Cycle mode options:
  - Work-only: `completedAt - startedAt`
  - Include-wait: `completedAt - queuedAt`
  - Avg=P50, Slow=P90

### 5.3 Cycle Time vs Target chart
- Chart type: overlapping bars
  - `Slow` bar behind (gray, with opacity)
  - `Avg` bar in front (primary)
  - Negative bar gap for overlap
- View selector:
  - Department
  - Bench 1..N
- **No future** actuals:
  - For intervals after `asOfInterval`, values are `null`
- Target line:
  - Green dashed line with a **white outlined** dashed line behind it
  - Target label uses **outlined text** (white stroke + green fill) via `OutlinedLabel`

### 5.4 Blocked panel
- Total blocked (stub)
- Reason chips (stub)
- CTA button (stub)
- Popover includes:
  - `blockedTotal = count(items where status=Blocked as of reportTime)`

### 5.5 Workstations table
Columns:
- Workstation
  - Rank pill (1st..Nth)
  - Bench name
  - **Behind** badge (red capsule)
- Out
- Exit rate (current)
- Cycle (Avg/Slow)
- WIP
- Blocked
- Progress

**Exit rate (current)**
- Defined as last window completions normalized to units/hr.
  - `exitRateCurrent/hr = count(completions in (reportTime-interval, reportTime]) / (intervalMinutes/60)`

**Rank**
- Sort benches by exit rate (current) descending.

**Behind badge**
- Bench is Behind if `avgCycle > targetCyclePerBenchSeconds`.

**Progress bar semantics**
- Fill is progress toward **full-shift target**:
  - `progressPct = out / fullShiftTargetOut`
- Plan marker:
  - `planFrac = (asOfInterval + 1) / intervalCount`
  - marker position = `planFrac`
  - marker extends ~3px below gauge
  - marker is green with white outline
- Right-side label:
  - `Target: targetNow` where `targetNow = round(fullShiftTargetOut * planFrac)`
  - Label color matches marker (green).

---

## 6) Mock data requirements (API-contract matching)

### 6.1 Recommended approach
- Treat the UI as if it is consuming API responses.
- For the prototype, load fixture responses based on:
  - `departmentId`
  - `date`
  - `intervalMinutes`
  - `asOfInterval` (demo-only convenience)
  - `view` (`dept` or `workstation:ws-x`)

### 6.2 Fixture shape
The response matches the contract:
- `meta`
- `plan`
- `current`
- `cycleChart`
- `blocked`
- `workstations[]`

Key fields used by UI:
- `meta.intervalMinutes`, `meta.reportTime`, `meta.benchCount`, `meta.cycleMode`
- `plan.goalUnits`, `plan.targetCyclePerBenchSeconds`
- `current.outSoFar`, `current.gapVsPlan`, `current.state`, `current.cycleCurrent`
- `cycleChart.points[]` with `avgSeconds/slowSeconds` and `null` for future
- `workstations[]`:
  - `rank`, `out`, `fullShiftTargetOut`, `targetNow`, `exitRateCurrentPerHour`, `cycle.avgSeconds/slowSeconds`, `behind`

### 6.3 Mapping notes
- The UI currently computes some derived items (e.g., marker % positions) even when the API provides the absolute numbers.
- Prefer: API provides *raw-ish* aggregations; UI computes ranks/flags/markers.

---

## 7) Extensibility guidelines

### 7.1 Adding real data
- Replace fixture lookup with:
  - 1–3 generic analytics queries (interval series, current window, cumulative)
- Keep the UI-derived calculations consistent:
  - `targetCyclePerBenchSeconds`
  - marker `planFrac`
  - `targetNow`
  - rank by current exit rate

### 7.2 Supporting cycleMode config
- Thread `cycleMode` from UI setting → API param.
- Ensure cycle percentiles are computed consistently:
  - Avg=P50
  - Slow=P90

### 7.3 Non-60-minute intervals
- Ensure:
  - report time label formatting works
  - chart grouping works
  - current-window exit rate uses the configured interval length

### 7.4 Bench count changes
- Ensure:
  - targetCyclePerBench scales with benchCount
  - per-bench throughput scales with benchCount
  - view selector lists benches dynamically

---

## 8) “Do not break” invariants

- Report time is **end-of-interval**, not start.
- No future actuals shown beyond report time.
- Avg/Slow naming is consistent everywhere.
- Target line + label remain readable over dark bars (white outline).
- Progress marker is visible over both track and fill (white outline) and extends below gauge.
- Behind badge uses the same red capsule language as the Current badge.

---

## 9) Quick checklist for future edits

- If you add a new metric:
  - Update the relevant popover with a one-line formula.
  - Ensure it updates with `asOfInterval`.
- If you change the chart:
  - Keep target readability (outline).
  - Keep future values null.
- If you change progress semantics:
  - Keep fill = out/full-shift target.
  - Keep marker = planFrac, and targetNow label matches.

