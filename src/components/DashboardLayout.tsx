import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Award, BarChart3, Bell, Brain, ChevronDown, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut,
  Menu, MessageSquare, Moon, Search, Settings, Shield, Sun, Target, TrendingUp, University,
  Upload, Users, FileOutput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BulkStudentUpload } from "@/components/BulkStudentUpload";
import { cn } from "@/lib/utils";
import { calculateRiskScore, getRiskLabel } from "@/lib/riskCalculator";
import {
  loadVisibleCommunicationMessages,
  type CommunicationMessage,
} from "@/lib/communications";
import { safeFormatDate } from "@/lib/date";

const LECTURER_SIDEBAR_STATE_KEY = "gradeai:lecturer-sidebar-sections";

const lecturerSections = [
  {
    label: "Core",
    description: "Daily teaching workflow",
    defaultOpen: true,
    links: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { to: "/dashboard/assignments", label: "Assignments", icon: Upload },
    ],
  },
  {
    label: "Assessment",
    description: "Review, integrity, and moderation",
    defaultOpen: true,
    links: [
      { to: "/dashboard/integrity", label: "Academic Integrity", icon: Shield },
      { to: "/dashboard/moderation", label: "Moderation", icon: ClipboardCheck },
    ],
  },
  {
    label: "Insights",
    description: "Cohort and learner signals",
    defaultOpen: false,
    links: [
      { to: "/dashboard/cohort-analytics", label: "Cohort Analytics", icon: BarChart3 },
      { to: "/dashboard/performance", label: "Performance Trends", icon: TrendingUp },
      { to: "/dashboard/learning-outcomes", label: "Learning Outcomes", icon: Target },
    ],
  },
  {
    label: "Institution",
    description: "Quality and reporting views",
    defaultOpen: false,
    links: [
      { to: "/dashboard/institutional", label: "Institutional Insights", icon: University },
      { to: "/dashboard/accreditation", label: "Accreditation", icon: Award },
      { to: "/dashboard/external-examiner", label: "External Examiner", icon: FileOutput },
    ],
  },
  {
    label: "Admin",
    description: "Setup and operational tools",
    defaultOpen: false,
    links: [
      { to: "/dashboard/bulk-upload-students", label: "Bulk Upload Students", icon: Users, isAction: true },
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

const studentLinks = [
  { to: "/dashboard", label: "My Grades", icon: GraduationCap },
  { to: "/dashboard/assignments", label: "Assignments", icon: Upload },
  { to: "/dashboard/explain-grade", label: "Explain My Grade", icon: MessageSquare },
  { to: "/dashboard/improvements", label: "Improvement Plan", icon: TrendingUp },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const defaultLecturerSectionState = Object.fromEntries(
  lecturerSections.map((section) => [section.label, section.defaultOpen]),
) as Record<(typeof lecturerSections)[number]["label"], boolean>;

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, user, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") === "dark";
    return false;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<CommunicationMessage[]>([]);
  const [openSections, setOpenSections] = useState(() => {
    if (typeof window === "undefined") return defaultLecturerSectionState;

    try {
      const stored = window.localStorage.getItem(LECTURER_SIDEBAR_STATE_KEY);
      if (!stored) return defaultLecturerSectionState;

      const parsed = JSON.parse(stored) as Partial<typeof defaultLecturerSectionState>;
      return { ...defaultLecturerSectionState, ...parsed };
    } catch {
      return defaultLecturerSectionState;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    const syncNotifications = async () => {
      const visibleMessages = await loadVisibleCommunicationMessages({
        userId: user?.id ?? profile?.id ?? null,
        email: profile?.email ?? user?.email ?? null,
        fullName: profile?.full_name ?? null,
      });
      setNotifications(visibleMessages);
    };

    void syncNotifications();
    if (typeof window !== "undefined") {
      const handleUpdated = () => {
        void syncNotifications();
      };
      const handleFocus = () => {
        void syncNotifications();
      };
      window.addEventListener("gradeai:communications-updated", handleUpdated);
      window.addEventListener("focus", handleFocus);

      return () => {
        window.removeEventListener("gradeai:communications-updated", handleUpdated);
        window.removeEventListener("focus", handleFocus);
      };
    }
  }, [profile?.email, profile?.id, user?.email, user?.id]);

  const openNotification = (notification: CommunicationMessage) => {
    setShowNotifications(false);

    if (profile?.role === "student") {
      if (notification.category === "at-risk-alert" || notification.category === "intervention-follow-up") {
        navigate(`/dashboard/improvements?notice=${encodeURIComponent(notification.id)}`, {
          state: { notification },
        });
        return;
      }

      if (notification.relatedAssignmentId) {
        navigate(`/dashboard/assignments/${notification.relatedAssignmentId}`);
        return;
      }

      if (notification.category === "feedback-summary" || notification.category === "grade-released") {
        navigate("/dashboard/assignments");
        return;
      }
    }

    if (profile?.role === "lecturer" && notification.relatedStudentId) {
      navigate(`/dashboard/student/${encodeURIComponent(notification.relatedStudentId)}`);
      return;
    }

    navigate("/dashboard");
  };

  const lecturerLinks = lecturerSections.flatMap((section) => section.links);
  const links = profile?.role === "lecturer" ? lecturerLinks : studentLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate(isDemo ? "/" : "/auth");
  };

  const filteredLecturerSections = lecturerSections
    .map((section) => ({
      ...section,
      links: searchQuery
        ? section.links.filter((link) => link.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : [...section.links],
    }))
    .filter((section) => section.links.length > 0);

  const filteredLinks = searchQuery
    ? links.filter((l) => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : links;

  const activeLink = links.find((link) => link.to === location.pathname);
  const activeSection = profile?.role === "lecturer"
    ? lecturerSections.find((section) => section.links.some((link) => link.to === location.pathname))
    : null;

  useEffect(() => {
    if (!activeSection || searchQuery) return;

    setOpenSections((current) => (
      current[activeSection.label] ? current : { ...current, [activeSection.label]: true }
    ));
  }, [activeSection, searchQuery]);

  useEffect(() => {
    if (typeof window === "undefined" || profile?.role !== "lecturer") return;

    window.localStorage.setItem(LECTURER_SIDEBAR_STATE_KEY, JSON.stringify(openSections));
  }, [openSections, profile?.role]);

  const toggleSection = (label: keyof typeof defaultLecturerSectionState) => {
    setOpenSections((current) => ({ ...current, [label]: !current[label] }));
  };

  const renderNavLink = (link: (typeof lecturerSections)[number]["links"][number] | typeof studentLinks[number]) => {
    const isActive = location.pathname === link.to;
    const isActionLink = "isAction" in link && !!link.isAction;

    return (
      <Link
        key={link.to}
        to={isActionLink ? "#" : link.to}
        onClick={(event) => {
          if (isActionLink) {
            event.preventDefault();
            setSidebarOpen(false);
            setSearchQuery("");
            return;
          }

          setSidebarOpen(false);
          setSearchQuery("");
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
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_28%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.28))]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border/80 bg-sidebar/95 text-sidebar-foreground shadow-2xl backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="border-b border-sidebar-border/80 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sidebar-border bg-sidebar-accent/60 shadow-sm">
              <Brain className="h-5 w-5 text-sidebar-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold tracking-tight text-sidebar-primary-foreground">GradeAI</p>
              <p className="text-xs text-sidebar-foreground/60">
                {profile?.role === "lecturer" ? "Academic workspace" : "Student workspace"}
              </p>
            </div>
            {isDemo && <Badge variant="outline" className="ml-auto text-[10px] border-sidebar-border text-sidebar-foreground/60">Demo</Badge>}
          </div>
        </div>

        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <Input placeholder="Search workspace" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-10 rounded-xl border-sidebar-border bg-sidebar-accent/55 pl-9 text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-3">
          {profile?.role === "lecturer" ? (
            <div className="space-y-5">
              {filteredLecturerSections.map((section) => {
                const isExpanded = searchQuery ? true : openSections[section.label];

                return (
                <div
                  key={section.label}
                  className={cn(
                    "space-y-2 rounded-2xl border border-transparent px-1 py-1 transition-colors",
                    isExpanded && "border-sidebar-border/60 bg-sidebar-accent/15",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(section.label)}
                    className="flex w-full items-start justify-between rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/30"
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
                      {section.links.map((link) =>
                        "isAction" in link && link.isAction ? (
                          <div key={link.to} className="rounded-xl border border-dashed border-sidebar-border/80 bg-sidebar-accent/25 p-2">
                            <BulkStudentUpload
                              triggerClassName="w-full justify-start rounded-lg border-0 bg-transparent px-2 py-2 text-sm font-medium text-sidebar-foreground/78 shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              compact
                            />
                          </div>
                        ) : (
                          renderNavLink(link)
                        ),
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLinks.map((link) => renderNavLink(link))}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border/80 p-4">
          <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/35 p-3">
            <div className="flex items-center gap-3 px-1 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground shadow-sm">
              {profile?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start rounded-xl text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {isDemo ? "Exit Demo" : "Sign Out"}
          </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-xl lg:px-8">
          <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {activeSection?.label || (profile?.role === "lecturer" ? "Workspace" : "Student")}
            </p>
            <h1 className="truncate font-display text-xl font-semibold tracking-tight">
              {activeLink?.label || "Dashboard"}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isDemo && (
              <Badge variant="secondary" className="text-xs">
                Demo Mode
              </Badge>
            )}
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setDarkMode(!darkMode)} title="Toggle dark mode">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="relative rounded-xl" onClick={() => setShowNotifications(!showNotifications)}>
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />}
            </Button>
            {showNotifications && (
              <div className="absolute right-4 top-16 z-50 w-80 rounded-2xl border bg-card shadow-xl">
                <div className="border-b p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Notifications</p>
                    {notifications.length > 0 && <Badge variant="secondary">{notifications.length}</Badge>}
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">No new notifications</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="block w-full rounded-xl p-3 text-left text-xs hover:bg-muted/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{notification.subject}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {safeFormatDate(notification.createdAt, "MMM d, HH:mm")}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{notification.recipientName}</p>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{notification.body}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
