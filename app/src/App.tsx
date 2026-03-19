import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Factory,
  Info,
  LayoutGrid,
  Settings,
  SlidersHorizontal,
  Lock,
  Unlock,
} from "lucide-react";

// ----------------------------
// Helpers
// ----------------------------
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtSeconds(s: number) {
  if (!isFinite(s)) return "-";
  const sec = Math.round(s);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem.toString().padStart(2, "0")}s`;
}

function fmtTimeOfDay(minutesFromMidnight: number) {
  const m = ((minutesFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

function intervalLabel(startHour: number, i: number, intervalMin: number) {
  const start = startHour * 60 + i * intervalMin;
  const end = start + intervalMin;
  const h1 = Math.floor(start / 60);
  const h2 = Math.floor(end / 60);
  const a = ((h1 + 11) % 12) + 1;
  const b = ((h2 + 11) % 12) + 1;
  const suf = h2 >= 12 ? "PM" : "AM";
  return intervalMin === 60
    ? `${a}-${b} ${suf}`
    : `${a}:${String(start % 60).padStart(2, "0")}-${b}:${String(
        end % 60
      ).padStart(2, "0")} ${suf}`;
}

function ordinal(n: number) {
  const v = Math.abs(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (v % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function OutlinedLabel(props: any) {
  // Recharts passes different shapes depending on version. Prefer viewBox if present.
  const vb = props?.viewBox ?? {};
  const text = props?.value ?? props?.text ?? "";

  // "insideTopRight"-like placement.
  const x = (vb.x ?? 0) + (vb.width ?? 0) - 8;
  const y = (vb.y ?? 0) + 16;

  return (
    <g>
      <text
        x={x}
        y={y}
        textAnchor="end"
        dominantBaseline="middle"
        stroke="#ffffff"
        strokeWidth={4}
        paintOrder="stroke"
        fill="rgb(34, 197, 94)"
        fontSize={12}
        fontWeight={600}
      >
        {text}
      </text>
    </g>
  );
}

type CyclePoint = { label: string; avg: number | null; slow: number | null };

type WorkstationRow = {
  id: string;
  name: string;
  out: number; // cumulative actual to report time
  targetOut: number; // full-shift target for this bench
  rate: number; // units/hr (current window)
  avgCycle: number; // sec
  slowCycle: number; // sec
  wip: number;
  blocked: number;
  benchShift: { start: string; end: string };
  bPlanFrac: number;
  targetNow: number;
  isTargetLocked: boolean;
  isShiftLocked: boolean;
  timelineLeftPct: number;
  timelineWidthPct: number;
};

function HelpEye({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full opacity-70 hover:opacity-100"
          aria-label={`Help: ${title}`}
        >
          <Info className="h-4 w-4 text-muted-foreground/70" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <div className="mt-2 space-y-2 text-sm text-foreground">
              {children}
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  shiftStartTime,
  setShiftStartTime,
  shiftEndTime,
  setShiftEndTime,
  intervalMinutes,
  setIntervalMinutes,
  benchCount,
}: {
  shiftStartTime: string;
  setShiftStartTime: (v: string) => void;
  shiftEndTime: string;
  setShiftEndTime: (v: string) => void;
  intervalMinutes: number;
  setIntervalMinutes: (v: number) => void;
  benchCount: number;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Department overview settings</DialogTitle>
          <DialogDescription>
            Goal stays in the KPI bar. These settings are changed less often.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <div className="text-sm font-medium">Shift Window</div>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="w-full"
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="time"
                  value={shiftEndTime}
                  onChange={(e) => setShiftEndTime(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Used to compute shift hours, pace, and takt.
              </div>
              <div className="text-xs text-muted-foreground">
                Benches: {benchCount} (parallel).
              </div>
            </div>

            <div className="space-y-2 sm:col-span-1">
              <div className="text-sm font-medium">Interval minutes</div>
              <Input
                type="number"
                value={intervalMinutes}
                onChange={(e) =>
                  setIntervalMinutes(
                    clamp(parseInt(e.target.value || "60", 10), 15, 120)
                  )
                }
              />
              <div className="text-xs text-muted-foreground">
                Controls chart grouping and the report-time step.
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium">Demo time</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Use the report-time arrows in the header to scrub through the shift.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkstationSettingsDialog({
  name,
  defaultTarget,
  defaultStart,
  defaultEnd,
  lockedTarget,
  setLockedTarget,
  lockedShift,
  setLockedShift,
}: {
  name: string;
  defaultTarget: number;
  defaultStart: string;
  defaultEnd: string;
  lockedTarget: number | undefined;
  setLockedTarget: (v: number | undefined) => void;
  lockedShift: { start: string; end: string } | undefined;
  setLockedShift: (v: { start: string; end: string } | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localTarget, setLocalTarget] = useState<number | undefined>(lockedTarget);
  const [localShift, setLocalShift] = useState<{ start: string; end: string } | undefined>(lockedShift);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalTarget(lockedTarget);
      setLocalShift(lockedShift);
    }
    setOpen(newOpen);
  };

  const handleApply = () => {
    setLockedTarget(localTarget);
    setLockedShift(localShift);
    setOpen(false);
  };

  const isTargetLocked = localTarget !== undefined;
  const isShiftLocked = localShift !== undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{name} Configuration</DialogTitle>
          <DialogDescription>
            Override default parameters. Unlocked targets are calculated dynamically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Target Override</div>
              <div className="text-xs text-muted-foreground">
                Lock to {isTargetLocked ? `a specific target` : `default distribution target (${defaultTarget})`}.
              </div>
            </div>
            <Button
              variant={isTargetLocked ? "default" : "outline"}
              size="sm"
              className="w-28"
              onClick={() => setLocalTarget(isTargetLocked ? undefined : defaultTarget)}
            >
              {isTargetLocked ? <Lock className="mr-2 h-4 w-4" /> : <Unlock className="mr-2 h-4 w-4" />}
              {isTargetLocked ? "Locked" : "Unlocked"}
            </Button>
          </div>
          {isTargetLocked && (
            <div className="pl-0">
              <Input
                type="number"
                value={localTarget}
                onChange={(e) => setLocalTarget(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="w-full font-mono font-medium"
              />
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Shift Window</div>
              <div className="text-xs text-muted-foreground">
                Current: {isShiftLocked ? `${localShift.start} - ${localShift.end}` : "Department default"}
              </div>
            </div>
            <Button
              variant={isShiftLocked ? "default" : "outline"}
              size="sm"
              className="w-28"
              onClick={() => setLocalShift(isShiftLocked ? undefined : { start: defaultStart, end: defaultEnd })}
            >
              {isShiftLocked ? "Custom" : "Default"}
            </Button>
          </div>
          {isShiftLocked && (
            <div className="flex items-center gap-2 pl-0">
              <Input
                type="time"
                value={localShift.start}
                onChange={(e) => setLocalShift({ ...localShift, start: e.target.value })}
                className="w-full"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                value={localShift.end}
                onChange={(e) => setLocalShift({ ...localShift, end: e.target.value })}
                className="w-full"
              />
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 border-t pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentSupervisorOverviewHiFi() {
  // Scope (minimal for the mock)
  const [warehouse] = useState("All Warehouses");
  const [department] = useState("Testing");

  // What supervisors change often
  const [goalUnits, setGoalUnits] = useState(1200);

  // Settings (less often changed)
  const [shiftStartTime, setShiftStartTime] = useState("08:00");
  const [shiftEndTime, setShiftEndTime] = useState("16:00");
  const [intervalMinutes, setIntervalMinutes] = useState(60);

  // Workstation Overrides
  const [overrideTargets, setOverrideTargets] = useState<Record<string, number>>({});
  const [overrideShifts, setOverrideShifts] = useState<Record<string, { start: string; end: string }>>({});

  // Demo clock driver: scrub through shift (interval index)
  const [asOfInterval, setAsOfInterval] = useState(7);

  // Chart view filter (department or a specific bench)
  const [cycleView, setCycleView] = useState<string>("dept");

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  };

  const shiftStartHour = parseTime(shiftStartTime);
  const endH = parseTime(shiftEndTime);
  const shiftHours = endH > shiftStartHour ? endH - shiftStartHour : 24 - shiftStartHour + endH;

  const benchCount = 6;

  const totalMinutes = Math.round(shiftHours * 60);
  const intervalCount = Math.max(1, Math.ceil(totalMinutes / intervalMinutes));
  const asOfIdx = clamp(asOfInterval, 0, Math.max(0, intervalCount - 1));

  // Report time represents the END of the selected interval.
  const shiftStartMinutes = shiftStartHour * 60;
  const shiftEndMinutes = shiftStartMinutes + totalMinutes;
  const reportMinutes = Math.min(
    shiftEndMinutes,
    shiftStartMinutes + (asOfIdx + 1) * intervalMinutes
  );
  const reportTime = fmtTimeOfDay(reportMinutes);

  // Dept takt = available time / demand.
  // Target cycle per bench = dept takt * benchCount (parallel benches).
  const deptTaktSeconds = useMemo(() => {
    const g = Math.max(1, goalUnits);
    return (totalMinutes * 60) / g;
  }, [goalUnits, totalMinutes]);

  const targetCyclePerBenchSeconds = useMemo(() => {
    const g = Math.max(1, goalUnits);
    return (totalMinutes * 60 * benchCount) / g;
  }, [goalUnits, totalMinutes, benchCount]);

  const plannedRateDept = useMemo(
    () => goalUnits / Math.max(1, shiftHours),
    [goalUnits, shiftHours]
  );
  const plannedRatePerBench = useMemo(
    () => plannedRateDept / Math.max(1, benchCount),
    [plannedRateDept, benchCount]
  );

  // ----------------------------
  // Plan vs Current metrics
  // ----------------------------
  const currentStatus = useMemo(() => {
    const plannedPerInterval = goalUnits / intervalCount;

    const wobble = (i: number) => {
      const x = i / Math.max(1, intervalCount - 1);
      const dip = Math.exp(-Math.pow((x - 0.55) / 0.16, 2));
      const noise = 0.04 * Math.sin(x * Math.PI * 2.2 + 0.4);
      return 1.01 - 0.15 * dip + noise + 0.01 * x;
    };

    let cumPlan = 0;
    let cumActual = 0;
    for (let i = 0; i <= asOfIdx; i++) {
      cumPlan += plannedPerInterval;
      cumActual += plannedPerInterval * wobble(i);
    }

    // End-of-day demo: slightly ahead (+10)
    if (asOfIdx === intervalCount - 1) {
      cumPlan = goalUnits;
      cumActual = cumPlan + 10;
    }

    const gap = Math.round(cumActual - cumPlan);
    const state = gap >= 18 ? "Ahead" : gap >= -18 ? "On track" : "Behind";
    const variant =
      state === "Behind"
        ? "destructive"
        : state === "Ahead"
          ? "secondary"
          : "outline";

    return {
      gap,
      state,
      variant: variant as "destructive" | "secondary" | "outline",
      cumPlan: Math.round(cumPlan),
      cumActual: Math.round(cumActual),
    };
  }, [asOfIdx, goalUnits, intervalCount]);

  // Department output so far as of report time
  const deptOutSoFar = useMemo(
    () => Math.max(0, currentStatus.cumActual),
    [currentStatus]
  );

  // ----------------------------
  // Cycle series (department)
  // ----------------------------
  const cycleFullDept = useMemo<CyclePoint[]>(() => {
    return Array.from({ length: intervalCount }).map((_, i) => {
      const x = i / Math.max(1, intervalCount - 1);
      const baseline =
        targetCyclePerBenchSeconds * (0.95 + 0.10 * Math.sin(x * Math.PI * 1.3));
      const avg = clamp(baseline + 8 * Math.sin(x * Math.PI * 2.1 + 0.4), 10, 999);
      const slow = clamp(
        avg + (18 + 10 * Math.sin(x * Math.PI * 1.8 + 0.9)),
        10,
        999
      );
      return {
        label: intervalLabel(shiftStartHour, i, intervalMinutes),
        avg: Math.round(avg),
        slow: Math.round(slow),
      };
    });
  }, [intervalCount, intervalMinutes, targetCyclePerBenchSeconds, shiftStartHour]);

  const cycleVisibleDept = useMemo<CyclePoint[]>(() => {
    return cycleFullDept.map((p, i) =>
      i <= asOfIdx ? p : { ...p, avg: null, slow: null }
    );
  }, [cycleFullDept, asOfIdx]);

  // Department cycle KPI (current window)
  const cycleNowDept = cycleFullDept[clamp(asOfIdx, 0, Math.max(0, cycleFullDept.length - 1))];
  const deptCycleAvg = cycleNowDept?.avg ?? null;
  const deptCycleSlow = cycleNowDept?.slow ?? null;

  // ----------------------------
  // Cycle series (workstation view)
  // ----------------------------
  const cycleViewOptions = useMemo(() => {
    const opts = [{ id: "dept", label: "Department" }];
    for (let i = 0; i < benchCount; i++) {
      opts.push({ id: `ws-${i + 1}`, label: `Bench ${i + 1}` });
    }
    return opts;
  }, [benchCount]);

  const benchFactor = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < benchCount; i++) m.set(`ws-${i + 1}`, 0.88 + i * 0.03);
    return m;
  }, [benchCount]);

  const cycleVisibleForView = useMemo<CyclePoint[]>(() => {
    if (cycleView === "dept") return cycleVisibleDept;
    const f = benchFactor.get(cycleView) ?? 1;
    return cycleFullDept.map((p, i) => {
      if (i > asOfIdx) return { ...p, avg: null, slow: null };
      return {
        label: p.label,
        avg: p.avg == null ? null : Math.round(p.avg * f),
        slow: p.slow == null ? null : Math.round(p.slow * f),
      };
    });
  }, [cycleView, cycleVisibleDept, cycleFullDept, benchFactor, asOfIdx]);

  // ----------------------------
  // Absolute Timeline scale
  // ----------------------------
  const timelineData = useMemo(() => {
    const offsets = Array.from({ length: benchCount }).map((_, i) => {
      const id = `ws-${i + 1}`;
      const benchShift = overrideShifts[id] || { start: shiftStartTime, end: shiftEndTime };
      const bH = parseTime(benchShift.start);
      const eH = parseTime(benchShift.end);
      let sOff = bH - shiftStartHour;
      if (sOff < -12) sOff += 24;
      if (sOff > 12) sOff -= 24;
      let eOff = eH - shiftStartHour;
      if (eOff < sOff) eOff += 24;
      return { sOff, eOff };
    });
    const minOffset = Math.min(...offsets.map((o) => o.sOff), 0);
    const maxOffset = Math.max(...offsets.map((o) => o.eOff), shiftHours);
    const spanHours = Math.max(1, maxOffset - minOffset);

    const reportOff = ((asOfIdx + 1) * intervalMinutes) / 60;
    const reportLinePct = clamp(((reportOff - minOffset) / spanHours) * 100, 0, 100);

    return { minOffset, spanHours, reportLinePct };
  }, [
    benchCount,
    overrideShifts,
    shiftStartTime,
    shiftEndTime,
    shiftStartHour,
    shiftHours,
    asOfIdx,
    intervalMinutes,
  ]);

  // ----------------------------
  // Workstations (table)
  // ----------------------------
  const workstations = useMemo<WorkstationRow[]>(() => {
    const baseShares = [0.18, 0.16, 0.17, 0.15, 0.19, 0.15];
    const wipArr = [22, 28, 16, 31, 14, 20];
    const blkArr = [2, 5, 1, 4, 1, 3];

    // Rebalancing logic for targets
    const lockedTotal = baseShares.reduce((sum, _, idx) => {
      const id = `ws-${idx + 1}`;
      return sum + (overrideTargets[id] !== undefined ? overrideTargets[id] : 0);
    }, 0);

    const remainingGoal = Math.max(0, goalUnits - lockedTotal);

    const unlockedSharesSum = baseShares.reduce((sum, share, idx) => {
      const id = `ws-${idx + 1}`;
      return sum + (overrideTargets[id] !== undefined ? 0 : share);
    }, 0) || 1; // avoid division by zero

    const benchProfiles = baseShares.map((share, idx) => {
      const id = `ws-${idx + 1}`;
      const f = 0.88 + idx * 0.03;
      const avgCycle = Math.round(targetCyclePerBenchSeconds * f);
      const slowCycle = Math.round(targetCyclePerBenchSeconds * 1.35 * (0.95 + idx * 0.03));
      const perf = clamp(targetCyclePerBenchSeconds / Math.max(1, avgCycle), 0.6, 1.4);

      let fullShiftTargetOut = overrideTargets[id];
      if (fullShiftTargetOut === undefined) {
        const shareNorm = overrideTargets[id] !== undefined ? 0 : (share / unlockedSharesSum);
        fullShiftTargetOut = Math.round(remainingGoal * shareNorm);
      }
      
      // Compute specific shift hours for this bench
      const benchShift = overrideShifts[id] || { start: shiftStartTime, end: shiftEndTime };
      const bStartH = parseTime(benchShift.start);
      const bEndH = parseTime(benchShift.end);

      let startOffset = bStartH - shiftStartHour;
      if (startOffset < -12) startOffset += 24;
      if (startOffset > 12) startOffset -= 24;
      
      let endOffset = bEndH - shiftStartHour;
      if (endOffset < startOffset) endOffset += 24;

      const bShiftHours = endOffset - startOffset;
      const bTotalMinutes = Math.round(bShiftHours * 60);

      return { 
        id, 
        baseShare: share, 
        avgCycle, 
        slowCycle, 
        perf, 
        fullShiftTargetOut, 
        bStartH, 
        bTotalMinutes, 
        bShiftHours,
        benchShift,
        startOffset,
        endOffset,
        isTargetLocked: overrideTargets[id] !== undefined, 
        isShiftLocked: overrideShifts[id] !== undefined 
      };
    });

    return benchProfiles.map((b, idx) => {
      // Calculate fraction of bench's specific shift that has elapsed as of report time
      const reportMinAbs = shiftStartHour * 60 + (asOfIdx + 1) * intervalMinutes;
      const bStartMinAbs = b.bStartH * 60;
      let bElapsedMin = reportMinAbs - bStartMinAbs;
      
      // Handle overnight wrap around context casually
      if (bElapsedMin < -12 * 60) bElapsedMin += 24 * 60;
      if (bElapsedMin < 0) bElapsedMin = 0; // shift hasn't started yet

      const bPlanFrac = clamp(bElapsedMin / Math.max(1, b.bTotalMinutes), 0, 1);
      
      // The bench's planned progress at this moment:
      const targetNow = Math.round(b.fullShiftTargetOut * bPlanFrac);
      
      // Demo output tracks target with some wobble
      const wobble = 0.98 + 0.05 * Math.sin(idx * 3.14 + asOfIdx);
      const out = Math.round(targetNow * wobble * b.perf);
      const targetOut = b.fullShiftTargetOut;

      const targetRateHr = targetOut / Math.max(0.1, b.bShiftHours);
      const rate = bElapsedMin > 0 && bElapsedMin <= b.bTotalMinutes + intervalMinutes ? targetRateHr * b.perf * wobble : 0;

      const timelineLeftPct = clamp(((b.startOffset - timelineData.minOffset) / timelineData.spanHours) * 100, 0, 100);
      const timelineWidthPct = clamp(((b.endOffset - b.startOffset) / timelineData.spanHours) * 100, 0, 100);

      return {
        id: b.id,
        name: `Bench ${idx + 1}`,
        out,
        targetOut,
        rate,
        avgCycle: b.avgCycle,
        slowCycle: b.slowCycle,
        wip: wipArr[idx],
        blocked: blkArr[idx],
        benchShift: b.benchShift,
        bPlanFrac,
        targetNow,
        isTargetLocked: b.isTargetLocked,
        isShiftLocked: b.isShiftLocked,
        timelineLeftPct,
        timelineWidthPct,
      };
    });
  }, [
    asOfIdx,
    deptOutSoFar,
    goalUnits,
    intervalCount,
    intervalMinutes,
    targetCyclePerBenchSeconds,
    overrideTargets,
    overrideShifts,
    shiftStartTime,
    shiftEndTime,
    shiftStartHour,
  ]);

  const deptBlocked = workstations.reduce((s, r) => s + r.blocked, 0);

  const rankByRate = useMemo(() => {
    const sorted = [...workstations].sort((a, b) => b.rate - a.rate);
    const m = new Map<string, number>();
    sorted.forEach((w, i) => m.set(w.id, i + 1));
    return m;
  }, [workstations]);

  const cycleChartTitle =
    cycleView === "dept" ? "Department" : cycleViewOptions.find((o) => o.id === cycleView)?.label;

  // Target marker fraction is computed independently per bench now.

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{warehouse}</span>
            </div>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-sm text-muted-foreground">Department</div>
                <div className="text-base font-semibold leading-tight">{department}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </Button>

            {/* Demo clock */}
            <div className="flex items-center gap-3 rounded-xl border px-3 py-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="leading-tight">
                <div className="text-[11px] text-muted-foreground">
                  Report time (demo) - use arrows
                </div>
                <div className="text-sm font-semibold">{reportTime}</div>
              </div>
              <div className="ml-1 flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setAsOfInterval((v) =>
                      clamp(v + 1, 0, Math.max(0, intervalCount - 1))
                    )
                  }
                  aria-label="Move forward"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() =>
                    setAsOfInterval((v) =>
                      clamp(v - 1, 0, Math.max(0, intervalCount - 1))
                    )
                  }
                  aria-label="Move back"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <HelpEye title="Preview the shift">
                <div>Demo-only: scrubs the page to the selected report time (end of interval).</div>
                <div className="text-muted-foreground">
                  reportTime = min(shiftEnd, shiftStart + (asOfInterval + 1) * intervalMinutes)
                </div>
              </HelpEye>
            </div>

            {/* Settings moved here to keep KPI bar tight */}
            <SettingsDialog
              shiftStartTime={shiftStartTime}
              setShiftStartTime={setShiftStartTime}
              shiftEndTime={shiftEndTime}
              setShiftEndTime={setShiftEndTime}
              intervalMinutes={intervalMinutes}
              setIntervalMinutes={setIntervalMinutes}
              benchCount={benchCount}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Department goal & KPIs */}
        <Card className="mb-4">
          <CardContent className="grid grid-cols-1 gap-3 py-3 md:grid-cols-2 md:gap-4">
            {/* PLAN */}
            <section className="min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Plan</div>
                <HelpEye title="Plan metrics">
                  <div>Plan sets the department’s end-of-shift goal and the required pace.</div>
                  <div className="text-muted-foreground">
                    plannedThroughput/hr = goalUnits / shiftHours; perBench/hr = plannedThroughput / benchCount
                  </div>
                  <div className="text-muted-foreground">
                    deptTakt(s) = (shiftHours * 3600) / goalUnits; targetCycle/bench(s) = deptTakt * benchCount
                  </div>
                </HelpEye>
              </div>

              <div className="mt-2 flex items-start gap-4 overflow-x-auto">
                <div className="min-w-[150px]">
                  <div className="text-[11px] text-muted-foreground">Goal</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      className="h-9 w-[100px]"
                      type="number"
                      value={goalUnits}
                      onChange={(e) =>
                        setGoalUnits(
                          clamp(parseInt(e.target.value || "0", 10), 1, 50000)
                        )
                      }
                    />
                    <Badge variant="outline" className="text-xs">
                      units
                    </Badge>
                  </div>
                </div>

                <div className="min-w-[190px]">
                  <div className="text-[11px] text-muted-foreground">Planned throughput</div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none">
                    {plannedRateDept.toFixed(1)}
                    <span className="text-sm font-medium text-muted-foreground">/hr</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    ~ {plannedRatePerBench.toFixed(1)}/hr/bench
                  </div>
                </div>

                <div className="min-w-[190px]">
                  <div className="text-[11px] text-muted-foreground">Department takt</div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none">
                    {fmtSeconds(deptTaktSeconds)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Target ~ {fmtSeconds(targetCyclePerBenchSeconds)}/bench
                  </div>
                </div>
              </div>
            </section>

            {/* CURRENT */}
            <section className="min-w-0">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Current</div>
                <HelpEye title="Current metrics">
                  <div>Current shows department output and pacing at report time.</div>
                  <div className="text-muted-foreground">
                    outSoFar = count(completions &lt;= reportTime); plannedOutSoFar = goalUnits * planFrac; gap = outSoFar - plannedOutSoFar
                  </div>
                  <div className="text-muted-foreground">
                    Cycle mode (config): Work-only = completedAt - startedAt; Include-wait = completedAt - queuedAt. Avg=P50, Slow=P90 over units completed in the interval.
                  </div>
                </HelpEye>
              </div>

              <div className="mt-2 flex items-start gap-4 overflow-x-auto">
                <div className="min-w-[170px]">
                  <div className="text-[11px] text-muted-foreground">Out (so far)</div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none">
                    {deptOutSoFar.toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">units</div>
                </div>

                <div className="min-w-[220px]">
                  <div className="text-[11px] text-muted-foreground">Gap vs goal plan</div>
                  <div className="mt-0.5 flex items-baseline gap-2 leading-none">
                    <div
                      className={cn(
                        "text-2xl font-semibold",
                        currentStatus.gap >= 0 ? "text-emerald-600" : "text-destructive"
                      )}
                    >
                      {currentStatus.gap >= 0 ? `+${currentStatus.gap}` : currentStatus.gap}
                      <span className="ml-1 text-sm font-medium text-muted-foreground">units</span>
                    </div>
                    <Badge variant={currentStatus.variant} className="text-xs">
                      {currentStatus.state}
                    </Badge>
                  </div>
                </div>

                <div className="min-w-[220px]">
                  <div className="text-[11px] text-muted-foreground">Dept cycle (current)</div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none">
                    Avg {deptCycleAvg == null ? "-" : fmtSeconds(deptCycleAvg)}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Slow {deptCycleSlow == null ? "-" : fmtSeconds(deptCycleSlow)}
                  </div>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Cycle (bar chart) */}
          <Card className="lg:col-span-9">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Cycle Time vs Target</CardTitle>
                  <CardDescription>
                    Avg and Slow cycle time per hour for {cycleChartTitle}. Dashed line is the target.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
                    <span className="text-xs text-muted-foreground">View</span>
                    <select
                      className="bg-transparent text-sm outline-none"
                      value={cycleView}
                      onChange={(e) => setCycleView(e.target.value)}
                      aria-label="Cycle chart view"
                    >
                      {cycleViewOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <HelpEye title="Why this chart matters">
                    <div>Shows Avg/Slow cycle per interval vs the target cycle required to hit the goal.</div>
                    <div className="text-muted-foreground">
                      Avg = P50(cycleSeconds), Slow = P90(cycleSeconds) over units completed in each interval window.
                    </div>
                    <div className="text-muted-foreground">
                      Cycle mode (config): Work-only (completed-started) or Include-wait (completed-queued). Department view pools all benches; bench view filters by workstation.
                    </div>
                  </HelpEye>
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={cycleVisibleForView}
                  margin={{ top: 6, right: 18, left: 0, bottom: 0 }}
                  barGap={-18}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} height={40} />
                  <YAxis tick={{ fontSize: 12 }} width={58} tickFormatter={(v) => `${v}s`} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const label = name === "avg" ? "Avg" : "Slow";
                      if (value == null) return ["-", label];
                      return [`${value}s`, label];
                    }}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "hsl(var(--border))",
                      background: "hsl(var(--background))",
                    }}
                  />

                  <Bar
                    dataKey="slow"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.6}
                    barSize={24}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="avg"
                    fill="hsl(var(--primary))"
                    barSize={14}
                    radius={[6, 6, 0, 0]}
                  />

                  {/* Target line with white outline + green top */}
                  <ReferenceLine
                    y={Math.round(targetCyclePerBenchSeconds)}
                    stroke="#ffffff"
                    strokeWidth={6}
                    strokeDasharray="6 4"
                  />
                  <ReferenceLine
                    y={Math.round(targetCyclePerBenchSeconds)}
                    stroke="rgb(34, 197, 94)"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                    label={(p: any) => (
                      <OutlinedLabel
                        {...p}
                        value={`Target ${fmtSeconds(targetCyclePerBenchSeconds)}`}
                      />
                    )}
                  />

                  <ReferenceLine
                    x={cycleFullDept[clamp(asOfIdx, 0, cycleFullDept.length - 1)]?.label}
                    stroke="hsl(var(--border))"
                    strokeDasharray="4 4"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Blocked */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                    Blocked
                  </CardTitle>
                  <CardDescription>Today</CardDescription>
                </div>
                <HelpEye title="Blocked items">
                  <div>Blocks are a fast way to lose throughput; use this to spot stalls.</div>
                  <div className="text-muted-foreground">
                    blockedTotal = count(items where status=Blocked as of reportTime), optionally grouped by reason.
                  </div>
                </HelpEye>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border p-3">
                <div className="text-sm text-muted-foreground">Total blocked</div>
                <div className={cn("text-3xl font-semibold", deptBlocked ? "text-destructive" : "")}>
                  {deptBlocked}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">Auth / Unlock</Badge>
                  <Badge variant="outline">Missing data</Badge>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                Go to Blocked Queue
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Workstations */}
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Workstations</CardTitle>
                <CardDescription>
                  Horse race view using current exit rate. Rank is 1st-6th.
                </CardDescription>
              </div>
              <HelpEye title="How to use this table">
                <div>Horse race: ranks benches by current exit rate (last interval window).</div>
                <div className="text-muted-foreground">
                  exitRateCurrent/hr = count(completions in (reportTime-interval, reportTime]) / (intervalMinutes/60)
                </div>
                <div className="text-muted-foreground">
                  Progress fill = outSoFar/benchFullShiftTarget; green tick = targetNow where targetNow = round(benchFullShiftTarget * planFrac)
                </div>
                <div className="text-muted-foreground">
                  Behind badge: avgCycle &gt; targetCycle/bench.
                </div>
              </HelpEye>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workstation</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Exit rate (current)</TableHead>
                    <TableHead className="text-right">Cycle (Avg/Slow)</TableHead>
                    <TableHead className="text-right">WIP</TableHead>
                    <TableHead className="text-right">Blocked</TableHead>
                    <TableHead className="w-[300px] h-12 pt-2 align-top">
                      <div className="flex h-full w-full flex-col gap-1 relative">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span>Progress (Time Scale)</span>
                        </div>
                        {/* Timeline Ruler */}
                        <div className="relative mt-auto h-4 w-full border-b border-muted-foreground/20">
                          {Array.from({ length: Math.ceil(timelineData.spanHours) + 1 }).map((_, i) => {
                            const tickHourOffset = timelineData.minOffset + i;
                            const pct = clamp((i / timelineData.spanHours) * 100, 0, 100);
                            const hour24 = Math.floor(shiftStartHour + tickHourOffset);
                            const m = ((hour24 % 24) + 24) % 24;
                            const h12 = ((m + 11) % 12) + 1;
                            const ampm = m >= 12 ? 'p' : 'a';
                            
                            return (
                              <div
                                key={i}
                                className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-[9px] text-muted-foreground"
                                style={{ left: `${pct}%` }}
                              >
                                <span>{h12}{ampm}</span>
                                <div className="mt-0.5 h-1 w-[1px] bg-muted-foreground/30" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workstations.map((w) => {
                    const rank = rankByRate.get(w.id) ?? 0;
                    const rankLabel = rank ? ordinal(rank) : "-";

                    const behind = w.avgCycle > targetCyclePerBenchSeconds;
                    const progressPct = clamp((w.out / Math.max(1, w.targetOut)) * 100, 0, 140);

                    const targetNow = w.targetNow;

                    return (
                      <TableRow key={w.id} className="group hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
                                  {rankLabel}
                                </Badge>
                                <div className="font-medium">{w.name}</div>
                                {behind ? <Badge variant="destructive">Behind</Badge> : null}
                              </div>
                              {w.isShiftLocked && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  {w.benchShift.start} - {w.benchShift.end}
                                </div>
                              )}
                            </div>
                            <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <WorkstationSettingsDialog
                                name={w.name}
                                defaultTarget={w.targetOut}
                                defaultStart={shiftStartTime}
                                defaultEnd={shiftEndTime}
                                lockedTarget={overrideTargets[w.id]}
                                setLockedTarget={(v) => {
                                  const newObj = { ...overrideTargets };
                                  if (v === undefined) delete newObj[w.id]; else newObj[w.id] = v;
                                  setOverrideTargets(newObj);
                                }}
                                lockedShift={overrideShifts[w.id]}
                                setLockedShift={(v) => {
                                  const newObj = { ...overrideShifts };
                                  if (v === undefined) delete newObj[w.id]; else newObj[w.id] = v;
                                  setOverrideShifts(newObj);
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{w.out}</TableCell>
                        <TableCell className="text-right">{w.rate.toFixed(1)}/hr</TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">Avg {fmtSeconds(w.avgCycle)}</div>
                          <div className="text-xs text-muted-foreground">Slow {fmtSeconds(w.slowCycle)}</div>
                        </TableCell>
                        <TableCell className="text-right">{w.wip}</TableCell>
                        <TableCell className={cn("text-right", w.blocked >= 4 ? "text-destructive" : "")}>
                          {w.blocked}
                        </TableCell>
                        <TableCell className="align-top pt-3 pb-2">
                          <div className="space-y-1">
                            {/* Absolute Timeline Progress bar with plan-to-time marker */}
                            <div className="relative w-full h-5 rounded overflow-hidden bg-muted/30">
                              {/* Background representing the workstation's shift bounds */}
                              <div
                                className="absolute top-0 bottom-0 bg-muted/60 rounded overflow-hidden shadow-inner flex"
                                style={{ left: `${w.timelineLeftPct}%`, width: `${w.timelineWidthPct}%` }}
                              >
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${clamp(progressPct, 0, 100)}%` }}
                                />
                              </div>
                              {/* Absolute current-time marker */}
                              <div
                                className="absolute -bottom-[3px] top-0 w-[2px] bg-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.8)] z-10"
                                style={{ left: `${timelineData.reportLinePct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span>{w.out} / </span>
                                <span className={w.isTargetLocked ? "font-bold text-primary bg-primary/10 px-1 rounded" : ""}>
                                  {w.targetOut}
                                </span>
                                {w.isTargetLocked && <Lock className="h-3 w-3 text-primary" />}
                              </span>
                              <span className="text-emerald-500">Target: {targetNow}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ----------------------------
// Self-tests (opt-in)
// ----------------------------
// Run by setting: (globalThis as any).__RUN_DEPT_OVERVIEW_TESTS__ = true
function runDeptOverviewTests() {
  const assert = (cond: any, msg: string) => {
    if (!cond) throw new Error(`Self-test failed: ${msg}`);
  };

  assert(clamp(5, 0, 10) === 5, "clamp keeps value");
  assert(clamp(-1, 0, 10) === 0, "clamp min");
  assert(clamp(99, 0, 10) === 10, "clamp max");

  assert(ordinal(1) === "1st", "ordinal 1st");
  assert(ordinal(2) === "2nd", "ordinal 2nd");
  assert(ordinal(3) === "3rd", "ordinal 3rd");
  assert(ordinal(11) === "11th", "ordinal 11th");

  // report time is end-of-interval (8-9 -> 9:00 AM)
  {
    const shiftStart = 8 * 60;
    const total = 8 * 60;
    const interval = 60;
    const idx = 0;
    const end = Math.min(shiftStart + total, shiftStart + (idx + 1) * interval);
    assert(fmtTimeOfDay(end) === "9:00 AM", "report time uses end-of-interval");
  }

  // planned throughput per bench: (goal/shiftHours)/benches
  {
    const goal = 1200;
    const hours = 8;
    const benches = 6;
    const deptPerHour = goal / hours;
    const perBenchHr = deptPerHour / benches;
    assert(Math.round(perBenchHr) === 25, "per-bench planned throughput ~25/hr");
  }

  // progress is out / full-shift target
  {
    const out = 200;
    const fullShiftTarget = 300;
    const pct = clamp((out / fullShiftTarget) * 100, 0, 140);
    assert(Math.round(pct) === 67, "progress percent computes correctly");
  }
}

if (typeof globalThis !== "undefined" && (globalThis as any).__RUN_DEPT_OVERVIEW_TESTS__) {
  runDeptOverviewTests();
}
