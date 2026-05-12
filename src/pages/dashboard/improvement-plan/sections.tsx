import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BookOpen, CheckCircle2, Target, TrendingDown, TrendingUp } from "lucide-react";

import type { ImprovementPlanReadiness, PlanModule, Resource } from "@/lib/improvementPlan";

export const InlineProgressBar = ({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div className={`overflow-hidden rounded-full bg-secondary ${className}`}>
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export const ImprovementPlanHero = ({
  module,
  readiness,
  modulesCount,
  completed,
  total,
  activeView,
  onViewModules,
  onViewCompletedTasks,
}: {
  module: PlanModule | null;
  readiness: ImprovementPlanReadiness;
  modulesCount: number;
  completed: number;
  total: number;
  activeView: "modules" | "completed" | "open";
  onViewModules: () => void;
  onViewCompletedTasks: () => void;
}) => {
  const openTasks = Math.max(0, total - completed);
  const hasActiveModule = module != null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-background to-background shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Improvement Plan</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Use this page to understand your latest result, see what improved, and focus on the next action before your next submission.
              </p>
            </div>

            {hasActiveModule ? (
              <div className="rounded-2xl border bg-background/80 p-4">
                <p className="text-sm font-semibold text-foreground">{module.module}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Current score: {module.currentGrade}%</Badge>
                  <Badge variant="outline">Target score: {module.targetGrade}%</Badge>
                  <Badge variant="outline">
                    Progress: {module.trend === "up" ? "Improving" : module.trend === "down" ? "Needs attention" : "Steady"}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Strengths</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {module.strengths.map((strength) => (
                        <Badge key={strength} variant="default">
                          {strength}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Main area to improve</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {module.weaknesses.map((weakness) => (
                        <Badge key={weakness} variant="outline">
                          {weakness}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-background/80 p-4">
                <p className="text-sm font-semibold text-foreground">Current improvement tasks complete</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You have cleared the current module tasks in this workspace. New priorities will appear here after your next released result adds a fresh improvement signal.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{readiness.postureLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Based on your current support tasks, recurring weak criteria, and recommended next moves.
              </p>
            </div>

            <div className="rounded-2xl border bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Why this matters</p>
              <p className="mt-2 text-sm text-foreground">
                {hasActiveModule
                  ? readiness.likelyChallenge
                  : "Completed module plans are hidden from the active workspace so your page stays focused on what still needs attention."}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {hasActiveModule
                  ? readiness.bestNextAction
                  : "Wait for the next released result or reopen completed tasks only if you want to review past work."}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background/75 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modules tracked</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{modulesCount}</p>
          </div>
          <div className="rounded-xl border bg-background/75 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks completed</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{completed}</p>
          </div>
          <div className="rounded-xl border bg-background/75 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks open</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{openTasks}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant={activeView === "modules" ? "default" : "outline"} onClick={onViewModules}>
            View modules
          </Button>
          <Button
            type="button"
            variant={activeView === "completed" ? "default" : "outline"}
            onClick={onViewCompletedTasks}
          >
            View completed tasks
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ImprovementPlanOverview = ({
  modulesCount,
  completed,
  total,
  progress,
}: {
  modulesCount: number;
  completed: number;
  total: number;
  progress: number;
}) => (
  <>
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Progress summary</p>
          <p className="text-xs text-muted-foreground">
            Track what you have completed and keep the next priority visible before your next submission.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold font-display">{progress}%</p>
            <p className="text-xs text-muted-foreground">task completion</p>
          </div>
          <InlineProgressBar value={progress} className="h-2 w-32" />
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Modules tracked</p>
          <p className="mt-2 text-2xl font-semibold">{modulesCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Completed tasks</p>
          <p className="mt-2 text-2xl font-semibold">{completed}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Tasks still open</p>
          <p className="mt-2 text-2xl font-semibold">{total - completed}</p>
        </CardContent>
      </Card>
    </div>
  </>
);

export const ImprovementPlanModuleCard = ({
  module,
  expandedCompletedCard,
  expandedCompletedSection,
  onToggleCompletedCard,
  onToggleCompletedSection,
  onToggleTask,
}: {
  module: PlanModule;
  expandedCompletedCard: boolean;
  expandedCompletedSection: boolean;
  onToggleCompletedCard: (moduleName: string) => void;
  onToggleCompletedSection: (moduleName: string) => void;
  onToggleTask: (moduleName: string, taskId: string) => void;
}) => {
  const completed = module.tasks.filter((task) => task.done).length;
  const openTasks = module.tasks.filter((task) => !task.done);
  const completedTasks = module.tasks.filter((task) => task.done);
  const progress = module.tasks.length > 0 ? (completed / module.tasks.length) * 100 : 0;
  const isFullyCompleted = module.tasks.length > 0 && openTasks.length === 0;

  if (isFullyCompleted && !expandedCompletedCard) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed module plan</p>
            <p className="text-base font-semibold">{module.module}</p>
            <p className="text-sm text-muted-foreground">
              Current {module.currentGrade}% | Target {module.targetGrade}% | {completed}/{module.tasks.length} tasks completed
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/20 text-primary">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Completed
            </Badge>
            <Button type="button" variant="outline" size="sm" onClick={() => onToggleCompletedCard(module.module)}>
              Show completed plan
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id={`improvement-module-${module.module}`}>
      <CardHeader>
        <div className="space-y-4">
          <div>
            <CardTitle className="text-base">{module.module}</CardTitle>
            <CardDescription className="mt-2">
              Use this summary to see what went well, what needs improvement, and what to carry into your next submission.
            </CardDescription>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current score</p>
              <p className="mt-2 text-lg font-semibold">{module.currentGrade}%</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Target score</p>
              <p className="mt-2 text-lg font-semibold">{module.targetGrade}%</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Trend</p>
              <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                {module.trend === "up" ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : module.trend === "down" ? (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                ) : (
                  <Target className="h-4 w-4 text-primary" />
                )}
                <span>{module.trend === "up" ? "Improving" : module.trend === "down" ? "Needs attention" : "Steady"}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What you did well</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {module.strengths.length > 0 ? (
                    module.strengths.map((strength) => (
                      <Badge key={strength} variant="default">
                        {strength}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Still building enough evidence.</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Main area to improve</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {module.weaknesses.length > 0 ? (
                    module.weaknesses.map((weakness) => (
                      <Badge key={weakness} variant="outline">
                        {weakness}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No major weak area detected.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">What to do next</p>
              <div className="mt-3 space-y-2">
                {module.nextSubmissionFocus.map((focus) => (
                  <div key={focus} className="flex items-start gap-2 text-sm">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{focus}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Grade trend over time</p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={module.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="assessment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke={module.trend === "down" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div id={`improvement-module-tasks-${module.module}`} className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Tasks</p>
            {openTasks.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {completed} of {module.tasks.length} completed
              </span>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {openTasks.length > 0 ? openTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                <Checkbox checked={task.done} onCheckedChange={() => onToggleTask(module.module, task.id)} />
                <div className="space-y-1">
                  <p className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}>
                    {task.task}
                  </p>
                  <p className="text-xs text-muted-foreground">{task.area}</p>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
                No open tasks remain for this module.
              </div>
            )}
          </div>

          {completedTasks.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => onToggleCompletedSection(module.module)}
                  >
                  {expandedCompletedSection ? "Hide completed tasks" : `Show completed tasks (${completedTasks.length})`}
                  </Button>
                  {isFullyCompleted && (
                    <Button type="button" variant="outline" size="sm" onClick={() => onToggleCompletedCard(module.module)}>
                    Hide module details
                  </Button>
                  )}
                </div>
              {expandedCompletedSection && (
                <div className="mt-3 space-y-3">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <Checkbox checked={task.done} onCheckedChange={() => onToggleTask(module.module, task.id)} />
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground line-through">
                          {task.task}
                        </p>
                        <p className="text-xs text-muted-foreground">{task.area}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const ImprovementPlanResourcesSection = ({ resources }: { resources: Resource[] }) => {
  const hasRecoveryGuidance = resources.some((resource) => resource.guidanceMode === "recovery");

  return (
    <Card id="best-next-moves">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Improvement plan</CardTitle>
        </div>
        <CardDescription>
          {hasRecoveryGuidance
            ? "Focused on the most important fixes to recover weaker submissions and meet the assignment requirements."
            : "Focused on the weakest repeated criteria so you know which skills to strengthen for future assignments."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {resources.map((resource) => (
          <div key={`${resource.heading}-${resource.module}`} className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Priority {resource.priority} - {resource.heading}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{resource.priorityLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resource.estimatedLift} | {resource.duration}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{resource.evidenceBasis}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{resource.guidanceLabel}</Badge>
                <Badge variant="outline">{resource.module}</Badge>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">This plan is based on</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p>{resource.weakestCriterionSummary}</p>
                  <p className="text-muted-foreground">Feedback: {resource.feedbackSignal}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
                <p className="mt-1 text-sm">{resource.issue}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Action</p>
                <div className="mt-2 space-y-2">
                  {resource.actionItems.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence of improvement</p>
                <p className="mt-1 text-sm">{resource.evidenceOfImprovement}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
