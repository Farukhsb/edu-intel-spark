import type { Profile } from "@/contexts/AuthContext";
import type { SidebarLink, SidebarSection } from "@/lib/dashboardNavigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { preloadRoute } from "@/lib/routePreloads";
import { isStudentRole } from "@/lib/roles";
import { Brain, ChevronDown, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  roleSections: readonly SidebarSection[];
  openSections: Record<string, boolean>;
  toggleSection: (label: string) => void;
  isDemo: boolean;
  isAdmin: boolean;
  isLecturerEquivalent: boolean;
  profile: Profile | null;
  handleSignOut: () => void;
  isLinkActive: (to: string) => boolean;
};

export const DashboardSidebar = ({
  sidebarOpen,
  setSidebarOpen,
  roleSections,
  openSections,
  toggleSection,
  isDemo,
  isAdmin,
  isLecturerEquivalent,
  profile,
  handleSignOut,
  isLinkActive,
}: Props) => {
  const renderNavLink = (link: SidebarLink) => {
    const isActive = isLinkActive(link.to);

    return (
      <Link
        key={link.to}
        to={link.to}
        onMouseEnter={() => preloadRoute(link.to)}
        onFocus={() => preloadRoute(link.to)}
        onClick={() => {
          setSidebarOpen(false);
        }}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary shadow-sm ring-1 ring-sidebar-border"
            : "text-sidebar-foreground/78 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            isActive
              ? "border-sidebar-primary/20 bg-sidebar-primary/10 text-sidebar-primary"
              : "border-sidebar-border/60 bg-sidebar-accent/35 text-sidebar-foreground/70 group-hover:border-sidebar-border group-hover:bg-sidebar-accent",
          )}
        >
          <link.icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{link.label}</span>
        {isActive && <span className="h-2 w-2 rounded-full bg-sidebar-primary" />}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-background)),hsl(var(--sidebar-background)/0.96)_38%,hsl(var(--sidebar-background)/0.99))] text-sidebar-foreground shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="border-b border-sidebar-border/80 bg-[linear-gradient(135deg,hsl(var(--sidebar-accent)/0.7),hsl(var(--sidebar-background))_70%)] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sidebar-border bg-[linear-gradient(135deg,hsl(var(--sidebar-primary)/0.22),hsl(var(--sidebar-accent)/0.8))] shadow-sm">
            <Brain className="h-5 w-5 text-sidebar-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tracking-tight text-sidebar-primary-foreground">GradeAI</p>
            <p className="text-xs text-sidebar-foreground/65">
              {isAdmin ? "Admin workspace" : isLecturerEquivalent ? "Academic workspace" : "Student workspace"}
            </p>
          </div>
          {isDemo && (
            <Badge variant="outline" className="ml-auto border-sidebar-border text-[10px] text-sidebar-foreground/60">
              Demo
            </Badge>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4">
        {isAdmin || isLecturerEquivalent || isStudentRole(profile?.role) ? (
          <div className="space-y-5">
            {roleSections.map((section) => {
              const isExpanded = openSections[section.label];

              return (
                <div
                  key={section.label}
                  className={cn(
                    "space-y-2 rounded-2xl border border-transparent px-1 py-1 transition-colors",
                    isExpanded && "border-sidebar-border/60 bg-sidebar-accent/20 shadow-[inset_0_1px_0_hsl(var(--sidebar-primary)/0.12)]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex w-full items-start justify-between rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/35"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/45">
                          {section.label}
                        </p>
                        <span className="rounded-full border border-sidebar-border/70 bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/55">
                          {section.links.length}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-sidebar-foreground/50">
                        {section.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-sidebar-foreground/45 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>
                  {isExpanded && (
                    <div className="space-y-1 pb-1">
                      {section.links.map((link) => renderNavLink(link))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border/80 p-4">
        <div className="rounded-2xl border border-sidebar-border/80 bg-[linear-gradient(180deg,hsl(var(--sidebar-accent)/0.6),hsl(var(--sidebar-accent)/0.34))] p-3">
          <div className="flex items-center gap-3 px-1 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground shadow-sm">
              {profile?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
              <p className="text-xs capitalize text-sidebar-foreground/60">{profile?.role}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {isDemo ? "Exit Demo" : "Sign Out"}
          </Button>
        </div>
      </div>
    </aside>
  );
};
