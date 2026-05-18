import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DashboardLoadingState = ({
  className,
  testId,
}: {
  className?: string;
  testId?: string;
}) => (
  <div className={cn("flex items-center justify-center py-12", className)}>
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" data-testid={testId} />
  </div>
);

export const DashboardEmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="space-y-6 animate-fade-in">
    <Card>
      <CardContent className="py-12 text-center">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  </div>
);

export const DashboardErrorState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="space-y-6 animate-fade-in">
    <Card className="border-destructive/20">
      <CardContent className="py-12 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
        <p className="mt-4 font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </CardContent>
    </Card>
  </div>
);

export const DashboardDemoBanner = ({ label }: { label: string }) => (
  <Card className="border-warning bg-warning/5">
    <CardContent className="flex items-center gap-2 p-3">
      <Badge variant="outline" className="border-warning text-warning">
        Demo
      </Badge>
      <span className="text-sm text-muted-foreground">{label}</span>
    </CardContent>
  </Card>
);

export const DashboardLiveBanner = ({ label }: { label: string }) => (
  <Card className="border-success/30 bg-success/5">
    <CardContent className="flex items-center gap-2 p-3">
      <Badge variant="outline" className="border-success text-success">
        Live
      </Badge>
      <span className="text-sm text-muted-foreground">{label}</span>
    </CardContent>
  </Card>
);

export const DashboardPageIntro = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) => (
  <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
    <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wide text-primary/80">{eyebrow}</p>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display">{title}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </CardContent>
  </Card>
);
