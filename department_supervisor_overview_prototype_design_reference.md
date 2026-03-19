# Department Supervisor Overview Prototype — Design Reference

> **Objective:** Provide a single, referenceable document explaining the *design intent*, *information architecture*, *metric definitions*, *demo behaviors*, and *API/data-contract thinking* behind the Department Supervisor Overview prototype. Intended to be copied alongside the prototype code into another AI/dev system.

---

## 1) What this prototype is

A department-level supervisor view that lets a supervisor:
- Set a **department end-of-shift goal**.
- See **Plan vs Current** performance at a selected **Report time** (demo scrubber).
- Understand process health via **Cycle Time vs Target** (Avg/Slow) and **Blocked** signals.
- Compare workstations like a **horse race** (ranked by current exit rate).
- Quickly spot who is **Behind** and how far ahead/behind each bench is relative to plan.

This is intentionally *fast to read* and *action-oriented*:
- **KPIs answer:** “Are we on pace to hit the goal?”
- **Chart answers:** “Is cycle time stable and on target?”
- **Table answers:** “Which bench needs intervention right now?”

---

## 2) Key UX decisions and why

### 2.1 Plan vs Current split
We keep **Plan** and **Current** side-by-side so the supervisor always sees:
- The target pace required (Plan), and
- The live status (Current) at the same moment.

Each has its own subtle **Info** icon popover containing concise, developer-friendly formulas.

### 2.2 Report time “demo scrubber”
The header includes a Report time control (▲▼). This is primarily for demo/training:
- Lets you preview how KPIs/charts/tables evolve through the shift.
- **Report time is end-of-interval** (e.g., 3–4 shows 4:00).
- The UI must never show “future” actuals beyond report time.

### 2.3 Cycle chart uses overlapping bars (Avg/Slow)
We prefer overlapping bars over lines for cycle in this view because:
- It reads like a “period report” (per hour).
- It cleanly communicates typical vs tail time:
  - **Avg** (P50) = typical performance
  - **Slow** (P90) = tail / outliers

### 2.4 Single, coherent color language
- **Red** = Behind (bad / needs attention)
- **Green** = Target / plan marker
- Cycle chart target line is green with a **white outline** for readability over bars.
- Workstation progress marker uses the same green and also has a **white outline**, and extends below the gauge for visibility.

### 2.5 Horse race table (rank + Behind)
Supervisors often think in “who’s moving fastest right now.”
- Rank = **current exit rate (last interval window)**
- Behind badge = **avg cycle > target cycle per bench**

Progress bar shows **out/target**, and includes a **plan-to-time tick** so you can see ahead/behind at a glance.

---

## 3) Layout overview

### 3.1 Header
- Warehouse + Department context
- Filters (placeholder)
- Report time (demo) with ▲▼
- Settings icon (Shift hours, Interval minutes)

### 3.2 Plan panel (left)
Order:
1) Goal (editable)
2) Planned throughput (dept + per bench sub-caption)
3) Department takt (dept + target cycle/bench sub-caption)

### 3.3 Current panel (right)
Order:
1) Out (so far)
2) Gap vs goal plan + state badge (Ahead / On track / Behind)
3) Dept cycle (current) Avg + Slow

### 3.4 Cycle Time vs Target chart
- Overlapping bars: Slow (gray) behind; Avg (primary) in front
- View selector: Department vs Bench
- Vertical “now” marker for selected report interval
- Green target line with white outline + outlined label

### 3.5 Blocked panel
- Total blocked + reason chips + CTA stub

### 3.6 Workstations table
- Rank pill (1st..Nth) based on current exit rate
- Behind badge (red)
- Out
- Exit rate (current)
- Cycle (Avg/Slow)
- WIP
- Blocked
- Progress:
  - fill = out/full-shift target
  - green plan tick with white outline, extends ~3px below bar
  - right-side label “Target: {targetNow}” in matching green

---

## 4) Metric definitions and formulas

### 4.1 Report time and interval
- `intervalCount = ceil((shiftHours * 60) / intervalMinutes)`
- `asOfInterval` is 0..(intervalCount-1)
- **Report time (end-of-interval):**
  - `reportTime = min(shiftEnd, shiftStart + (asOfInterval + 1) * intervalMinutes)`

### 4.2 Plan metrics
- `plannedThroughputDeptPerHour = goalUnits / shiftHours`
- `plannedThroughputPerBenchPerHour = plannedThroughputDeptPerHour / benchCount`
- `deptTaktSeconds = (shiftHours * 3600) / goalUnits`
- `targetCyclePerBenchSeconds = deptTaktSeconds * benchCount`

> **Why target cycle/bench?** In a parallel bench setup, each bench’s pace benchmark is department takt scaled by benchCount.

### 4.3 Current metrics
- `outSoFar = count(completions <= reportTime)`
- `plannedOutSoFar = round(goalUnits * planFrac)`
  - where `planFrac = (asOfInterval + 1) / intervalCount`
- `gapVsPlan = outSoFar - plannedOutSoFar`
- `state = Ahead | On track | Behind` (thresholded)

### 4.4 Cycle time modes (configurable)
The product should support both definitions:
- **Work-only:** `cycleSeconds = completedAt - startedAt`
- **Include-waiting:** `cycleSeconds = completedAt - queuedAt` (arrived-at-bench)

Aggregation per interval:
- **Avg** = `P50(cycleSeconds)`
- **Slow** = `P90(cycleSeconds)`

Scope:
- **Bench-level:** filter units completed by a given workstation within interval.
- **Department-level:** pool all units completed across benches within interval.

### 4.5 Exit rate (current)
- Current window is the most recent interval ending at reportTime:
  - `exitRateCurrentPerHour = count(completions in (reportTime-intervalMinutes, reportTime]) / (intervalMinutes/60)`

### 4.6 Workstation progress
- Full-shift target per bench:
  - `benchFullShiftTargetOut = round(goalUnits * benchShareNorm)`
- Fill:
  - `fill = outSoFar / benchFullShiftTargetOut`
- Plan-to-time marker and label:
  - `targetNow = round(benchFullShiftTargetOut * planFrac)`
  - Marker placed at `planFrac` (same fraction for all benches)

### 4.7 Behind badge
- Bench is **Behind** when:
  - `benchAvgCycleSeconds > targetCyclePerBenchSeconds`

---

## 5) Demo / mock data behavior

### 5.1 Core defaults
- benchCount = 6
- shiftHours = 8
- intervalMinutes = 60
- goalUnits = 1200
- end-of-shift finishes **+10** ahead of plan

### 5.2 “No future” rule
- Cycle chart values beyond report time are `null` so we don’t render future actuals.

### 5.3 Deterministic wobble
Demo uses deterministic formulas to simulate realistic mid-shift dips and recoveries (stable across runs).

---

## 6) API contract thinking (avoid case-specific endpoints)

### Goal
Keep the data service general-purpose by returning:
- Time-bucketed aggregates (counts, percentiles)
- Grouped by (intervalEnd, workstationId)

Then let the frontend compute:
- takt / targetCyclePerBench
- planned throughput
- ranks
- progress plan marker position
- “Behind” flags

### Generic analytics approach
A reusable analytics query can serve multiple supervisor screens:
- Shift-to-reportTime cumulative counts
- Last-interval counts for current exit rate
- Interval series percentiles for cycle chart

### Recommended API parameter
- `cycleMode`: `work_only` | `include_wait`

---

## 7) Files/artifacts to move to the other AI system

### 7.1 Prototype code
- Copy the full React component from the canvas:
  - **Department Supervisor Overview (hi-fi Mockup)**

### 7.2 Design requirements docs
- Copy the latest requirements doc:
  - **Department Overview (Supervisor) — Dev Requirements vNext.1**

### 7.3 API-contract-matching mock fixtures
- Use the generated JSON fixtures file:
  - `department_overview_api_contract_fixtures.json`
  - Contains request→response fixtures for department view + workstation views across all report intervals.

---

## 8) Known simplifications in the prototype

- Cycle time percentiles are simulated rather than computed from event logs.
- Blocked reasons are stubbed.
- Filters button is a placeholder.
- Bench shares are fixed in mock data.

---

## 9) Suggested next development steps

1) Replace mock calculations with real analytics query results.
2) Implement cycleMode config end-to-end.
3) Add ability to select warehouse/department (if not already contextual).
4) Add drill-down actions:
   - blocked queue
   - workstation detail
5) Add validation and persistence for goal settings.

---

## 10) Glossary
- **Avg**: P50 cycle time
- **Slow**: P90 cycle time
- **Takt**: required output cadence for demand
- **Target cycle/bench**: takt scaled by parallel benches
- **Exit rate (current)**: last-window throughput
- **Behind**: bench cycle exceeds target

