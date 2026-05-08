import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  lecturer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  student: "border-sky-500/30 bg-sky-500/10 text-sky-700",
};

export const ASSIGNMENT_STATUS_BADGE_STYLES: Record<string, string> = {
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  draft: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  closed: "border-slate-500/30 bg-slate-500/10 text-slate-700",
};

export const SUBMISSION_STATUS_BADGE_STYLES: Record<string, string> = {
  submitted: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  ai_grading: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700",
  ai_graded: "border-violet-500/30 bg-violet-500/10 text-violet-700",
  under_review: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_in_progress: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  moderated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  escalated: "border-rose-500/30 bg-rose-500/10 text-rose-700",
  released: "border-primary/30 bg-primary/10 text-primary",
};

export const MODERATION_STATUS_BADGE_STYLES: Record<string, string> = {
  moderation_pending: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  moderation_in_progress: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  moderated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  escalated: "border-rose-500/30 bg-rose-500/10 text-rose-700",
};

export const PAGE_SIZE = 8;
export const FULL_TABLE_PAGE_SIZE = 10;

export const formatCount = (value: number | null) => (value == null ? "Pending" : String(value));

export const formatPercentage = (value: number | null) => (value == null ? "Pending" : `${Math.round(value)}%`);

export const normalizeSearchValue = (value: string) => value.trim().toLowerCase();

export const toStatusBadgeClass = (value: string, lookup: Record<string, string>) =>
  lookup[value] || "border-muted bg-muted/40 text-foreground";

export const paginateRows = <T,>(rows: T[], page: number, pageSize: number) =>
  rows.slice((page - 1) * pageSize, page * pageSize);

export const PaginationControls = ({
  page,
  totalPages,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
      <p className="text-sm text-muted-foreground">
        {itemLabel} page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
};

export const maybeWrapNavigationCard = ({
  href,
  onNavigate,
  label,
  content,
}: {
  href?: string;
  onNavigate: (href: string) => void;
  label: string;
  content: ReactNode;
}) =>
  href ? (
    <button type="button" className="w-full text-left" onClick={() => onNavigate(href)} aria-label={label}>
      {content}
    </button>
  ) : (
    <div>{content}</div>
  );
