import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { HeatmapFilterState } from "./index";

type FiltersProps = {
  filters: HeatmapFilterState;
  onFiltersChange: (updater: (current: HeatmapFilterState) => HeatmapFilterState) => void;
  riskBandOptions: Array<{ value: HeatmapFilterState["riskBand"]; label: string }>;
  moduleOptions: string[];
  filteredCount: number;
  totalCount: number;
};

export const CohortSignalFiltersSection = ({
  filters,
  onFiltersChange,
  riskBandOptions,
  moduleOptions,
  filteredCount,
  totalCount,
}: FiltersProps) => {
  return (
    <Card className="border-primary/10 bg-card/90 shadow-sm">
      <CardHeader className="space-y-4 p-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Heatmap filters</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Narrow the cohort by risk band, module, intervention status, trend, or missing submission.
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            {filteredCount} visible of {totalCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-5 pt-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <label htmlFor="risk-band" className="text-sm font-medium">
            Risk band
          </label>
          <Select
            value={filters.riskBand}
            onValueChange={(value) => {
              onFiltersChange((current) => ({ ...current, riskBand: value as HeatmapFilterState["riskBand"] }));
            }}
          >
            <SelectTrigger id="risk-band" aria-label="Risk band" className="bg-background">
              <SelectValue placeholder="All risk bands" />
            </SelectTrigger>
            <SelectContent>
              {riskBandOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="module" className="text-sm font-medium">
            Module
          </label>
          <Select
            value={filters.module}
            onValueChange={(value) => {
              onFiltersChange((current) => ({ ...current, module: value }));
            }}
          >
            <SelectTrigger id="module" aria-label="Module" className="bg-background">
              <SelectValue placeholder="All modules" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {moduleOptions.map((module) => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {[
          { id: "no-intervention", label: "No intervention logged", key: "noInterventionLogged" as const },
          { id: "declining-trend", label: "Declining trend", key: "decliningTrend" as const },
          { id: "missing-submission", label: "Missing submission", key: "missingSubmission" as const },
        ].map((filter) => (
          <label
            key={filter.id}
            htmlFor={filter.id}
            className="flex items-center gap-3 rounded-2xl border bg-background/70 px-4 py-3 text-sm transition-colors hover:border-primary/30"
          >
            <Checkbox
              id={filter.id}
              checked={filters[filter.key]}
              onCheckedChange={(checked) => {
                onFiltersChange((current) => ({ ...current, [filter.key]: Boolean(checked) }));
              }}
            />
            <span className="leading-none">{filter.label}</span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
};
