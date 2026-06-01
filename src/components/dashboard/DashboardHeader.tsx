import { Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  activeLabel: string;
  workspaceLabel: string;
  workspaceHint: string;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  unreadCount: number;
  showNotifications: boolean;
  setShowNotifications: (value: boolean) => void;
};

export const DashboardHeader = ({
  activeLabel,
  workspaceLabel,
  workspaceHint,
  darkMode,
  setDarkMode,
  unreadCount,
  showNotifications,
  setShowNotifications,
}: Props) => (
  <>
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {workspaceLabel}
      </p>
      <h1 className="truncate font-display text-xl font-semibold tracking-tight">
        {activeLabel}
      </h1>
      <p className="mt-0.5 hidden max-w-2xl truncate text-xs text-muted-foreground md:block">
        {workspaceHint}
      </p>
    </div>
    <div className="ml-auto flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-xl"
        onClick={() => setDarkMode(!darkMode)}
        title="Toggle dark mode"
      >
        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-xl"
        aria-label="Open notifications"
        onClick={() => setShowNotifications(!showNotifications)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
      </Button>
    </div>
  </>
);
