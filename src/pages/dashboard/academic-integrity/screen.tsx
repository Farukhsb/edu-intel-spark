import { AlertTriangle, Bot, Eye, FileSearch, Loader2, Scale, Shield, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { safeFormatDate } from "@/lib/date";
import { type IntegrityDecision } from "@/lib/integrityReviews";
import type { useAcademicIntegrityController, decisionOptions } from "./useAcademicIntegrityController";

const MetricBar = ({ value }: { value: number }) => (
  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
    <div
      className="h-full rounded-full bg-primary transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

type AcademicIntegrityScreenProps = ReturnType<typeof useAcademicIntegrityController> & {
  decisionOptions: typeof decisionOptions;
};

export const AcademicIntegrityScreen = ({
  overview,
  totals,
  integrityReadiness,
  flagged,
  filteredCases,
  queueFilter,
  setQueueFilter,
  queueCounts,
  queueEmptyMessage,
  expandedId,
  setExpandedId,
  decisionDrafts,
  setDecisionDrafts,
  noteDrafts,
  setNoteDrafts,
  savingId,
  saveDecision,
  decisionVariant,
  riskVariant,
  riskLabel,
  openAssignment,
  decisionOptions,
}: AcademicIntegrityScreenProps) => (
  <div className="space-y-6 animate-fade-in">
    <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="text-base">Integrity Focus</CardTitle>
        <CardDescription>
          A compact reading of which integrity signal is most likely to need lecturer review next.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current position</p>
          <p className="mt-2 text-sm font-semibold">{integrityReadiness.postureLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on active investigations, pending flagged cases, and analysis-limited evidence in this queue.
          </p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What needs attention</p>
          <p className="mt-2 text-sm font-semibold">{integrityReadiness.likelyChallenge}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This is the integrity case line most likely to require follow-up or a clear review justification.
          </p>
        </div>
        <div className="rounded-lg border bg-background/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
          <p className="mt-2 text-sm font-semibold">{integrityReadiness.bestNextAction}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use this to decide whether to finish investigations first or clear the pending review queue first.
          </p>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {overview.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <stat.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-display">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">AI-writing suspicion</p><p className="mt-2 text-2xl font-semibold">{totals.aiWriting}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Similarity/plagiarism suspicion</p><p className="mt-2 text-2xl font-semibold">{totals.similarity}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Writing baseline deviation</p><p className="mt-2 text-2xl font-semibold">{totals.baselineDeviation}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending lecturer decisions</p><p className="mt-2 text-2xl font-semibold">{totals.pending}</p></CardContent></Card>
    </div>

    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base">Academic Integrity Review Queue</CardTitle>
        </div>
        <CardDescription>
          Each case is attached to a stored integrity result, with evidence split between AI-writing signals and similarity/plagiarism signals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={queueFilter === "pending" ? "default" : "outline"} onClick={() => setQueueFilter("pending")}>
            Needs Review
            <Badge variant="secondary" className="ml-2">{queueCounts.pending}</Badge>
          </Button>
          <Button size="sm" variant={queueFilter === "investigate" ? "default" : "outline"} onClick={() => setQueueFilter("investigate")}>
            Active Investigations
            <Badge variant="secondary" className="ml-2">{queueCounts.investigate}</Badge>
          </Button>
          <Button size="sm" variant={queueFilter === "resolved" ? "default" : "outline"} onClick={() => setQueueFilter("resolved")}>
            Resolved
            <Badge variant="secondary" className="ml-2">{queueCounts.resolved}</Badge>
          </Button>
        </div>

        {flagged.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No persisted integrity cases found yet. Run a plagiarism check on an assignment to populate the queue.
          </p>
        ) : filteredCases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{queueEmptyMessage}</p>
        ) : (
          filteredCases.map((item) => {
            const expanded = expandedId === item.submissionId;

            return (
              <div key={item.submissionId} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{item.student}</p>
                      <Badge variant={riskVariant(item.riskLevel) as "outline" | "secondary" | "destructive"}>
                        {riskLabel(item)}
                      </Badge>
                      <Badge variant={decisionVariant(item.decision) as "outline" | "secondary" | "destructive" | "default"}>
                        {item.decision.replace("-", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {item.assignment} • Submitted {safeFormatDate(item.submittedAt, "MMM d, yyyy HH:mm")} • Workflow {item.status.replace(/_/g, " ")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.flags.map((flag) => (
                        <Badge key={flag} variant="outline" className="text-xs">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                    {item.analysisLimited && item.limitations.length > 0 && (
                      <p className="text-xs text-amber-700">Analysis limited: {item.limitations.join(" ")}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openAssignment(item.assignmentId)}>
                      Open assignment
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedId((current) => (current === item.submissionId ? null : item.submissionId))}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {expanded ? "Hide evidence" : "Review evidence"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  {[
                    { label: "Overall case score", value: item.totalScore },
                    { label: "AI-writing suspicion", value: item.aiWritingScore },
                    { label: "Similarity suspicion", value: item.similarityScore },
                    { label: "Baseline deviation", value: item.baselineDeviationScore },
                  ].map((metric) => (
                    <div key={metric.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{metric.label}</span>
                        <span className="font-bold">{metric.value}%</span>
                      </div>
                      <MetricBar value={metric.value} />
                    </div>
                  ))}
                </div>

                {expanded && (
                  <div className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4">
                    <div className="grid gap-4 lg:grid-cols-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /><p className="text-sm font-medium">AI-writing suspicion evidence</p></div>
                        {item.evidence.aiWriting.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No strong AI-writing signals recorded.</p>
                        ) : (
                          item.evidence.aiWriting.map((evidence) => (
                            <div key={`${item.submissionId}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                              <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{evidence.label}</p><Badge variant="outline">{evidence.score}%</Badge></div>
                              <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Similarity / plagiarism evidence</p></div>
                        {item.evidence.similarity.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No strong similarity signals recorded.</p>
                        ) : (
                          item.evidence.similarity.map((evidence) => (
                            <div key={`${item.submissionId}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                              <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{evidence.label}</p><Badge variant="outline">{evidence.score}%</Badge></div>
                              <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Citation-aware overlap</p></div>
                        <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">Total {item.overlapBreakdown.totalOverlap}%</Badge>
                            <Badge variant="outline">Uncited {item.overlapBreakdown.uncitedOverlap}%</Badge>
                            <Badge variant="outline">Cited {item.overlapBreakdown.citedOverlap}%</Badge>
                            <Badge variant="outline">Peer {item.overlapBreakdown.internalPeerOverlap}%</Badge>
                            <Badge variant="outline">External {item.overlapBreakdown.externalSourceOverlap}%</Badge>
                          </div>
                        </div>
                        {[
                          { title: "Uncited matches", items: item.evidence.uncitedMatches },
                          { title: "Cited material", items: item.evidence.citedMatches },
                          { title: "Peer matches", items: item.evidence.peerMatches },
                          { title: "External matches", items: item.evidence.externalMatches },
                        ].map((group) => (
                          <div key={group.title} className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
                            {group.items.length === 0 ? (
                              <p className="text-sm text-muted-foreground">None recorded.</p>
                            ) : (
                              group.items.map((evidence) => (
                                <div key={`${item.submissionId}-${group.title}-${evidence.label}`} className="rounded-lg border bg-background p-3">
                                  <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{evidence.label}</p><Badge variant="outline">{evidence.score}%</Badge></div>
                                  <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><p className="text-sm font-medium">Writing baseline evidence</p></div>
                        {item.evidence.baselineDeviation.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No strong baseline deviation recorded.</p>
                        ) : (
                          item.evidence.baselineDeviation.map((evidence) => (
                            <div key={`${item.submissionId}-${evidence.label}-baseline`} className="rounded-lg border bg-background p-3">
                              <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{evidence.label}</p><Badge variant="outline">{evidence.score}%</Badge></div>
                              <p className="mt-1 text-xs text-muted-foreground">{evidence.value}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                      <div className="space-y-2">
                        <Label>Review decision</Label>
                        <Select
                          value={decisionDrafts[item.submissionId] || item.decision}
                          onValueChange={(value: IntegrityDecision) => setDecisionDrafts((current) => ({ ...current, [item.submissionId]: value }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {decisionOptions.map((decision) => (
                              <SelectItem key={decision} value={decision}>
                                {decision.replace("-", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Review note</Label>
                        <Textarea
                          rows={3}
                          value={noteDrafts[item.submissionId] || ""}
                          onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.submissionId]: event.target.value }))}
                          placeholder="Explain why the case was cleared, escalated, or held for investigation."
                        />
                      </div>

                      <div className="flex items-end">
                        <Button onClick={() => void saveDecision(item)} disabled={savingId === item.submissionId}>
                          {savingId === item.submissionId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save decision"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Review history</p>
                      {item.history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No review decisions recorded yet. Save a decision to start the audit trail.</p>
                      ) : (
                        item.history.map((entry) => (
                          <div key={entry.id} className="rounded-lg border bg-background p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={decisionVariant(entry.decision) as "outline" | "secondary" | "destructive" | "default"}>
                                {entry.decision.replace("-", " ")}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{safeFormatDate(entry.createdAt, "MMM d, yyyy HH:mm")}</span>
                            </div>
                            <p className="mt-2 text-sm">{entry.note}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  </div>
);
