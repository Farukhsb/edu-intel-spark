import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { log } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { getNotFoundReadiness } from "@/lib/edgePageReadiness";

const NotFound = () => {
  const location = useLocation();
  const readiness = getNotFoundReadiness();

  useEffect(() => {
    log.warn("404 route accessed", {
      pathname: location.pathname,
    });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-2xl space-y-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Route Readiness</p>
              <p className="mt-2 text-sm font-semibold">{readiness.postureLabel}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Likely challenge</p>
              <p className="mt-2 text-sm font-semibold">{readiness.likelyChallenge}</p>
            </div>
            <div className="rounded-lg border bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best next action</p>
              <p className="mt-2 text-sm font-semibold">{readiness.bestNextAction}</p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
