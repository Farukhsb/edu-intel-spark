import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { log } from "@/lib/logger";

type Props = {
  children: React.ReactNode;
  title?: string;
  resetKey?: string;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: undefined,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown runtime error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error("Unhandled route error", error, {
      componentStack: errorInfo.componentStack,
      boundary: "AppErrorBoundary",
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, errorMessage: undefined });
    }
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{this.props.title ?? "This page failed to load"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A runtime error interrupted this page. Reload and try again.
              </p>
              <p className="text-xs text-muted-foreground">
                Runtime details are hidden to protect sensitive data.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={this.handleTryAgain}>Try Again</Button>
                <Button onClick={this.handleReload}>Reload Page</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
