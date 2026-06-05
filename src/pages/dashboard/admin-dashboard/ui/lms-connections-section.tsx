import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Plus, Trash2, PlayCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { safeFormatDate } from "@/lib/date";
import { log } from "@/lib/logger";
import type { LmsProviderId } from "@/lib/lms";
import { deleteAdminLmsConnection, fetchAdminLmsConnections, runAdminLmsSync, saveAdminLmsConnection, seedCanvasLmsConnection, type AdminLmsConnectionRow, type AdminLmsSyncRunRow } from "@/lib/data/lms";
import type { AdminInstitutionSummary } from "../types";

const providerLabels: Record<LmsProviderId, string> = {
  canvas: "Canvas",
  blackboard: "Blackboard",
  moodle: "Moodle",
};

const defaultFormState = (institutionId: string | null, provider: LmsProviderId = "canvas") => ({
  institutionId: institutionId ?? "",
  provider,
  baseUrl: provider === "canvas" ? "https://canvas.instructure.com" : "",
  enabled: true,
  accessTokenSecretName: provider === "canvas" ? "CANVAS_ACCESS_TOKEN" : "",
  metadata: "{}",
});

export const LmsConnectionsSection = ({
  institution,
  onRefreshDashboard,
}: {
  institution: AdminInstitutionSummary | null;
  onRefreshDashboard: () => Promise<void>;
}) => {
  const [connections, setConnections] = useState<AdminLmsConnectionRow[]>([]);
  const [syncRuns, setSyncRuns] = useState<AdminLmsSyncRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningProvider, setRunningProvider] = useState<LmsProviderId | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<LmsProviderId | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LmsProviderId | null>(null);
  const [formState, setFormState] = useState(defaultFormState(institution?.id ?? null));

  const institutionId = institution?.id ?? null;
  const institutionSlug = institution?.slug ?? null;

  const loadConnections = async () => {
    if (!institutionId) {
      setConnections([]);
      setSyncRuns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchAdminLmsConnections(institutionId);
      setConnections(data.connections);
      setSyncRuns(data.syncRuns);
    } catch (error) {
      log.error("Failed to load LMS connections", error, { institutionId });
      toast.error("LMS connections could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFormState(defaultFormState(institutionId, editingProvider ?? "canvas"));
    void loadConnections();
  }, [institutionId]);

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingProvider(null);
    setFormState(defaultFormState(institutionId, "canvas"));
  };

  const openCreateDialog = (provider: LmsProviderId = "canvas") => {
    setEditingProvider(null);
    setFormState(defaultFormState(institutionId, provider));
    setShowCreateDialog(true);
  };

  const openEditDialog = (row: AdminLmsConnectionRow) => {
    setEditingProvider(row.provider);
    setFormState({
      institutionId: row.institution_id,
      provider: row.provider,
      baseUrl: row.base_url,
      enabled: row.enabled,
      accessTokenSecretName: row.access_token_secret_name ?? "",
      metadata: JSON.stringify(row.metadata ?? {}, null, 2),
    });
    setShowCreateDialog(true);
  };

  const parseMetadata = () => {
    const text = formState.metadata.trim();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("Metadata must be valid JSON.");
    }
  };

  const handleSave = async () => {
    if (!institutionId) {
      toast.error("Pick an institution before creating LMS connections.");
      return;
    }

    setSaving(true);
    try {
      const metadata = parseMetadata();
      await saveAdminLmsConnection({
        institutionId,
        provider: formState.provider,
        baseUrl: formState.baseUrl,
        enabled: formState.enabled,
        accessTokenSecretName: formState.accessTokenSecretName || null,
        metadata,
      });
      toast.success(`${providerLabels[formState.provider]} connection saved.`);
      closeDialog();
      await loadConnections();
      await onRefreshDashboard();
    } catch (error) {
      log.error("Failed to save LMS connection", error, { institutionId, provider: formState.provider });
      toast.error(error instanceof Error ? error.message : "LMS connection could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: LmsProviderId) => {
    if (!institutionId) return;

    setDeletingProvider(provider);
    try {
      await deleteAdminLmsConnection(institutionId, provider);
      toast.success(`${providerLabels[provider]} connection deleted.`);
      await loadConnections();
      await onRefreshDashboard();
    } catch (error) {
      log.error("Failed to delete LMS connection", error, { institutionId, provider });
      toast.error(error instanceof Error ? error.message : "LMS connection could not be deleted.");
    } finally {
      setDeletingProvider(null);
    }
  };

  const handleRunSync = async (provider: LmsProviderId) => {
    if (!institutionId || !institutionSlug) return;

    setRunningProvider(provider);
    try {
      const result = await runAdminLmsSync({
        institutionId,
        institutionSlug,
        provider,
        syncMode: "incremental",
      });
      toast.success(`${providerLabels[provider]} sync finished: ${result.message}`);
      await loadConnections();
      await onRefreshDashboard();
    } catch (error) {
      log.error("Failed to run LMS sync", error, { institutionId, provider });
      toast.error(error instanceof Error ? error.message : "LMS sync could not be completed.");
    } finally {
      setRunningProvider(null);
    }
  };

  const handleSeedCanvas = async () => {
    if (!institutionId) return;

    setSaving(true);
    try {
      await seedCanvasLmsConnection(institutionId);
      toast.success("Canvas example connection created.");
      await loadConnections();
      await handleRunSync("canvas");
    } catch (error) {
      log.error("Failed to seed Canvas LMS connection", error, { institutionId });
      toast.error(error instanceof Error ? error.message : "Canvas example could not be created.");
    } finally {
      setSaving(false);
    }
  };

  const sortedRuns = useMemo(() => syncRuns.slice().sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()), [syncRuns]);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">LMS connections</CardTitle>
              <CardDescription>
                Create and manage Canvas, Blackboard, and Moodle connections for the current institution. The sync endpoint is admin-only.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void loadConnections()} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={() => openCreateDialog("canvas")}>
                <Plus className="mr-2 h-4 w-4" />
                Add connection
              </Button>
              <Button onClick={() => void handleSeedCanvas()} disabled={saving || !institutionId}>
                Seed Canvas example
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          {!institutionId ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              Select an institution before configuring LMS connections.
            </div>
          ) : null}
          {connections.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No LMS connections exist yet. Create one or seed the Canvas example to connect the institution to an LMS.
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {connections.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{providerLabels[row.provider]}</h3>
                      <Badge variant={row.enabled ? "default" : "outline"}>{row.enabled ? "Enabled" : "Disabled"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{row.base_url}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Secret: {row.access_token_secret_name ?? "Not configured"} | Updated {safeFormatDate(row.updated_at, "MMM d, yyyy HH:mm", "Not available")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(row)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleRunSync(row.provider)} disabled={runningProvider === row.provider}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Sync
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => void handleDelete(row.provider)} disabled={deletingProvider === row.provider}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                  {JSON.stringify(row.metadata ?? {}, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base">Recent LMS sync runs</CardTitle>
          <CardDescription>Latest sync activity and outcomes for this institution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {sortedRuns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
              No sync runs have been recorded yet.
            </div>
          ) : (
            sortedRuns.map((row) => (
              <div key={row.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{providerLabels[row.provider]} sync</p>
                    <p className="text-xs text-muted-foreground">
                      {row.sync_mode} | Started {safeFormatDate(row.started_at, "MMM d, yyyy HH:mm", "Not available")}
                    </p>
                  </div>
                  <Badge variant={row.status === "succeeded" ? "default" : row.status === "failed" ? "destructive" : "outline"}>
                    {row.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Courses {row.summary.coursesSynced}, assignments {row.summary.assignmentsSynced}, submissions {row.summary.submissionsSynced}, grades {row.summary.gradesSynced}, events {row.summary.eventsSynced}
                </p>
                {row.error_message ? <p className="mt-2 text-sm text-destructive">{row.error_message}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={(open) => (open ? setShowCreateDialog(true) : closeDialog())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProvider ? `Edit ${providerLabels[editingProvider]} connection` : "Create LMS connection"}</DialogTitle>
            <DialogDescription>
              Store the provider base URL and secret name. Connection secrets stay in Supabase secrets, not this form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lms-provider">Provider</Label>
              <Select
                value={formState.provider}
                onValueChange={(value) => setFormState((current) => ({
                  ...current,
                  provider: value as LmsProviderId,
                  baseUrl:
                    value === "canvas"
                      ? "https://canvas.instructure.com"
                      : current.baseUrl,
                  accessTokenSecretName:
                    value === "canvas"
                      ? "CANVAS_ACCESS_TOKEN"
                      : current.accessTokenSecretName,
                }))}
              >
                <SelectTrigger id="lms-provider">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="canvas">Canvas</SelectItem>
                  <SelectItem value="blackboard">Blackboard</SelectItem>
                  <SelectItem value="moodle">Moodle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lms-base-url">Base URL</Label>
              <Input id="lms-base-url" value={formState.baseUrl} onChange={(event) => setFormState((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://lms.example.edu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lms-secret-name">Access token secret</Label>
              <Input id="lms-secret-name" value={formState.accessTokenSecretName} onChange={(event) => setFormState((current) => ({ ...current, accessTokenSecretName: event.target.value }))} placeholder="CANVAS_ACCESS_TOKEN" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
              <div>
                <Label htmlFor="lms-enabled" className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">Disabled connections remain stored but are skipped by sync.</p>
              </div>
              <Switch id="lms-enabled" checked={formState.enabled} onCheckedChange={(checked) => setFormState((current) => ({ ...current, enabled: checked }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="lms-metadata">Metadata</Label>
              <Textarea
                id="lms-metadata"
                value={formState.metadata}
                onChange={(event) => setFormState((current) => ({ ...current, metadata: event.target.value }))}
                rows={8}
                placeholder='{}'
              />
              <p className="text-xs text-muted-foreground">Optional provider-specific routes or tenant settings. Must be valid JSON.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save connection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
