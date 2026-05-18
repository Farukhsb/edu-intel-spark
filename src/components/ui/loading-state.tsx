import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const InlineLoadingState = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
    <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
    <span>{label}</span>
  </div>
);

export const ButtonLoadingLabel = ({ label }: { label: string }) => (
  <>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
    {label}
  </>
);
