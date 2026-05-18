import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Award, BarChart3, Bell, Brain, ChevronDown, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut,
  Menu, MessageSquare, Moon, Settings, Shield, Sun, Target, TrendingUp, University, AlertTriangle,
  Upload, Users, FileOutput,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { calculateRiskScore, getRiskLabel } from "@/lib/riskCalculator";
import { isAdminRole, isLecturerEquivalentRole, isStudentRole } from "@/lib/roles";
import { getDashboardShellContext } from "@/lib/dashboardShell";
import {
  getLecturerWorkflowNotificationDestination,
  getLecturerWorkflowNotificationPreviewHint,
} from "@/lib/lecturerWorkflowNotifications";
import {
  clearCommunicationMessage,
  loadVisibleCommunicationMessages,
  markCommunicationMessageRead,
  type CommunicationMessage,
} from "@/lib/communications";
import { safeFormatDate } from "@/lib/date";
import { getStudentSupportNotificationDestination } from "@/lib/studentSupportWorkflow";
import { preloadCommonRoleRoutes, preloadRoute } from "@/lib/routePreloads";

const DEMO_LECTURER_NOTIFICATIONS: CommunicationMessage[] = [
  {
    id: "demo-notice-release-follow-up",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: false,
    category: "grade-released",
    recipientName: "Dr. Demo Lecturer",
    recipientEmail: "demo@gradeai.com",
    recipientId: "demo-lecturer",
    subject: "Released result follow-up",
    body: "Released results are ready to review for the policy brief assignment.",
    relatedAssignmentId: "demo-assignment-policy-brief",
  },
  {
    id: "demo-notice-ai-ready",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: false,
    category: "ai-grading-ready",
    recipientName: "Dr. Demo Lecturer",
    recipientEmail: "demo@gradeai.com",
    recipientId: "demo-lecturer",
    subject: "Synthetic AI grading ready",
    body: "AI grading is ready for the policy brief assignment.",
    relatedAssignmentId: "demo-assignment-policy-brief",
  },
  {
    id: "demo-notice-1",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: false,
    category: "submission-received",
    recipientName: "Dr. Demo Lecturer",
    recipientEmail: "demo@gradeai.com",
    recipientId: "demo-lecturer",
    subject: "New synthetic submission received",
    body: "Amina Hassan submitted Strategic Policy Brief: Housing Affordability Interventions.",
    relatedAssignmentId: "demo-assignment-policy-brief",
  },
  {
    id: "demo-notice-2",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: true,
    category: "integrity-check-ready",
    recipientName: "Dr. Demo Lecturer",
    recipientEmail: "demo@gradeai.com",
    recipientId: "demo-lecturer",
    subject: "Synthetic integrity review ready",
    body: "The demo integrity evidence pack is ready for review on the policy brief assignment.",
    relatedAssignmentId: "demo-assignment-policy-brief",
  },
];

const DEMO_STUDENT_NOTIFICATIONS: CommunicationMessage[] = [
  {
    id: "demo-student-notice-1",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: false,
    category: "grade-released",
    recipientName: "Demo Student",
    recipientEmail: "student@gradeai.com",
    recipientId: "demo-student",
    subject: "Feedback released",
    body: "Your feedback for CS301 Assignment 1 - Data Structures is now available in the demo workspace.",
    relatedAssignmentId: "demo-assignment-1",
    relatedStudentId: "demo-student",
  },
  {
    id: "demo-student-notice-2",
    createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    cleared: false,
    read: true,
    category: "intervention-follow-up",
    recipientName: "Demo Student",
    recipientEmail: "student@gradeai.com",
    recipientId: "demo-student",
    subject: "Study plan reminder",
    body: "Review the complexity-analysis tasks in your improvement plan before the next submission window.",
    relatedStudentId: "demo-student",
  },
];

const LECTURER_SIDEBAR_STATE_KEY = "gradeai:lecturer-sidebar-sections";
const ADMIN_SIDEBAR_STATE_KEY = "gradeai:admin-sidebar-sections";
const STUDENT_SIDEBAR_STATE_KEY = "gradeai:student-sidebar-sections";
const LECTURER_ONBOARDING_STATE_KEY = "gradeai:lecturer-onboarding-v1-dismissed";

const lecturerOnboardingActions = [
  {
    title: "Review your workspace overview",
    description: "Start on Overview to see current teaching pressure, recent submissions, and the next workflow that needs attention.",
  },
  {
    title: "Create or open an assignment",
    description: "Use Assignments to create new assessment work or reopen an existing assignment for grading and release activity.",
  },
  {
    title: "Check grading, integrity, and moderation before release",
    description: "Before students see results, confirm the grading flow is complete and review any integrity or moderation work that still needs action.",
  },
] as const;

type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type SidebarSection = {
  label: string;
  description: string;
  defaultOpen: boolean;
  links: readonly SidebarLink[];
};

const lecturerSections = [
  {
    label: "Teaching",
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
    label: "Teaching Insights",
    description: "Cohort and learner signals",
    defaultOpen: false,
    links: [
      { to: "/dashboard/cohort-analytics", label: "Cohort Analytics", icon: BarChart3 },
      { to: "/dashboard/performance", label: "Performance Trends", icon: TrendingUp },
      { to: "/dashboard/learning-outcomes", label: "Learning Outcomes", icon: Target },
    ],
  },
  {
    label: "Workspace",
    description: "Personal settings and account controls",
    defaultOpen: false,
    links: [
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
] as const satisfies readonly SidebarSection[];

const adminSections = [
  {
    label: "Control",
    description: "Platform overview and monitoring",
    defaultOpen: true,
    links: [
      { to: "/dashboard", label: "Admin Dashboard", icon: LayoutDashboard },
      { to: "/dashboard?view=users", label: "User Management", icon: Users },
      { to: "/dashboard?view=system", label: "System Overview", icon: Shield },
      { to: "/dashboard?view=audit", label: "Audit Log", icon: FileOutput },
    ],
  },
  {
    label: "Reports",
    description: "Institution-level reporting views",
    defaultOpen: true,
    links: [
      { to: "/dashboard/institutional", label: "Institutional Insights", icon: University },
      { to: "/dashboard/accreditation", label: "Accreditation", icon: Award },
      { to: "/dashboard/external-examiner", label: "External Examiner", icon: FileOutput },
    ],
  },
  {
    label: "Academic Oversight",
    description: "Read-only academic workflow visibility",
    defaultOpen: false,
    links: [
      { to: "/dashboard?view=assignments", label: "Assignments", icon: Upload },
      { to: "/dashboard?view=submissions", label: "Submissions", icon: FileOutput },
      { to: "/dashboard?view=moderation", label: "Moderation", icon: ClipboardCheck },
    ],
  },
  {
    label: "Compliance & Governance",
    description: "Audit and institutional governance views",
    defaultOpen: false,
    links: [
      { to: "/dashboard?view=data-access-log", label: "Data Access Log", icon: FileOutput },
      { to: "/dashboard?view=integrity-overview", label: "Academic Integrity Overview", icon: Shield },
      { to: "/dashboard?view=moderation-audit", label: "Moderation Audit", icon: ClipboardCheck },
      { to: "/dashboard?view=policy-exceptions", label: "Policy Exceptions", icon: AlertTriangle },
    ],
  },
  {
    label: "Workspace",
    description: "Account-level tools",
    defaultOpen: false,
    links: [
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
] as const satisfies readonly SidebarSection[];

const studentSections = [
  {
    label: "Learning",
    description: "Assignments and current results",
    defaultOpen: true,
    links: [
      { to: "/dashboard/assignments", label: "Assignments", icon: Upload },
      { to: "/dashboard", label: "My Grades", icon: GraduationCap },
    ],
  },
  {
    label: "Support & Improvement",
    description: "Feedback understanding and next-step support",
    defaultOpen: true,
    links: [
      { to: "/dashboard/explain-grade", label: "Explain My Grade", icon: MessageSquare },
      { to: "/dashboard/improvements", label: "Improvement Plan", icon: TrendingUp },
    ],
  },
  {
    label: "Workspace",
    description: "Personal settings and account controls",
    defaultOpen: false,
    links: [
      { to: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
] as const satisfies readonly SidebarSection[];

const defaultLecturerSectionState = Object.fromEntries(
  lecturerSections.map((section) => [section.label, section.defaultOpen]),
) as Record<string, boolean>;

const defaultAdminSectionState = Object.fromEntries(
  adminSections.map((section) => [section.label, section.defaultOpen]),
) as Record<string, boolean>;

const defaultStudentSectionState = Object.fromEntries(
  studentSections.map((section) => [section.label, section.defaultOpen]),
) as Record<string, boolean>;

const getNotificationCategoryLabel = (category: CommunicationMessage["category"]) => {
  switch (category) {
    case "grade-released":
      return "Released result";
    case "feedback-summary":
      return "Feedback";
    case "assignment-published":
      return "Assignment";
    case "submission-received":
      return "Submission";
    case "ai-grading-ready":
      return "AI grading";
    case "integrity-check-ready":
      return "Integrity";
    case "at-risk-alert":
      return "At-risk";
    case "intervention-follow-up":
      return "Support";
    default:
      return "Notice";
  }
};

const getStudentNotificationPreviewHint = (notification: CommunicationMessage) => {
  switch (notification.category) {
    case "grade-released":
      return "Opens your released result and grade explanation.";
    case "feedback-summary":
      return "Opens your released result summary.";
    case "assignment-published":
      return "Opens the assignment submission window.";
    case "at-risk-alert":
    case "intervention-follow-up":
      return "Opens your improvement plan.";
    default:
      return null;
  }
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, user, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isAdminRole(profile?.role);
  const isLecturerEquivalent = isLecturerEquivalentRole(profile?.role);
  const roleSections = isAdmin ? adminSections : isLecturerEquivalent ? lecturerSections : studentSections;
  const defaultSectionState = isAdmin
    ? defaultAdminSectionState
    : isLecturerEquivalent
      ? defaultLecturerSectionState
      : defaultStudentSectionState;
  const sidebarStateKey = isAdmin
    ? ADMIN_SIDEBAR_STATE_KEY
    : isLecturerEquivalent
      ? LECTURER_SIDEBAR_STATE_KEY
      : STUDENT_SIDEBAR_STATE_KEY;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") === "dark";
    return false;
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [notifications, setNotifications] = useState<CommunicationMessage[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return defaultSectionState;

    try {
      const stored = window.localStorage.getItem(sidebarStateKey);
      if (!stored) return defaultSectionState;

      const parsed = JSON.parse(stored) as Partial<Record<string, boolean>>;
      return Object.fromEntries(
        Object.entries({ ...defaultSectionState, ...parsed }).map(([key, value]) => [key, Boolean(value)]),
      );
    } catch {
      return defaultSectionState;
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
      if (isDemo) {
        const demoNotifications = isStudentRole(profile?.role)
          ? DEMO_STUDENT_NOTIFICATIONS
          : DEMO_LECTURER_NOTIFICATIONS;
        setNotifications(demoNotifications);
        return;
      }

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
  }, [isDemo, profile?.email, profile?.id, profile?.role, user?.email, user?.id]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const handleClearNotification = async (
    event: React.MouseEvent<HTMLButtonElement>,
    notification: CommunicationMessage,
  ) => {
    event.stopPropagation();

    if (isDemo) {
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      return;
    }

    const clearedNotification = await clearCommunicationMessage(notification.id);

    if (clearedNotification) {
      setNotifications((current) => current.filter((item) => item.id !== clearedNotification.id));
    }
  };

  const openNotification = async (notification: CommunicationMessage) => {
    setShowNotifications(false);

    if (isDemo) {
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
    } else if (!notification.read) {
      const updatedNotification = await markCommunicationMessageRead(notification.id);
      if (updatedNotification) {
        setNotifications((current) =>
          current.map((item) => (item.id === updatedNotification.id ? updatedNotification : item)),
        );
      }
    }

    if (isStudentRole(profile?.role)) {
      if (notification.category === "at-risk-alert" || notification.category === "intervention-follow-up") {
        const supportDestination = getStudentSupportNotificationDestination({
          notification,
          notifications,
        });

        if (supportDestination.kind === "released-result") {
          const params = new URLSearchParams();
          if (supportDestination.targetNotification?.relatedAssignmentId) {
            params.set("assignment", supportDestination.targetNotification.relatedAssignmentId);
          }
          params.set("source", "support-notification");
          navigate(`/dashboard/explain-grade${params.toString() ? `?${params.toString()}` : ""}`, {
            state: {
              notification: supportDestination.targetNotification ?? notification,
              redirectedFromSupportNotification: notification,
            },
          });
          return;
        }

        if (supportDestination.kind === "assignments") {
          navigate("/dashboard/assignments?source=support-notification", {
            state: {
              notification: supportDestination.targetNotification ?? notification,
              redirectedFromSupportNotification: notification,
            },
          });
          return;
        }

        navigate(`/dashboard/improvements?notice=${encodeURIComponent(notification.id)}`, {
          state: { notification },
        });
        return;
      }

      if (
        notification.category === "feedback-summary" ||
        notification.category === "grade-released"
      ) {
        const params = new URLSearchParams();
        if (notification.relatedAssignmentId) {
          params.set("assignment", notification.relatedAssignmentId);
        }
        params.set("source", "notification");
        navigate(`/dashboard/explain-grade${params.toString() ? `?${params.toString()}` : ""}`);
        return;
      }

      if (notification.category === "assignment-published") {
        navigate("/dashboard/assignments");
        return;
      }

      if (notification.relatedAssignmentId) {
        navigate("/dashboard/assignments");
        return;
      }
    }

    if (isLecturerEquivalent && notification.relatedAssignmentId) {
      const destination = getLecturerWorkflowNotificationDestination({
        notification,
        notifications,
      });

      if (destination) {
        navigate(
          `/dashboard/assignments/${encodeURIComponent(notification.relatedAssignmentId)}?source=notification&focus=${destination.focus}`,
          destination.redirected
            ? {
                state: {
                  notification: destination.targetNotification,
                  redirectedFromNotification: notification,
                },
              }
            : undefined,
        );
        return;
      }

      navigate(`/dashboard/assignments/${encodeURIComponent(notification.relatedAssignmentId)}`);
      return;
    }

    if (isLecturerEquivalent && notification.relatedStudentId) {
      navigate(`/dashboard/student/${encodeURIComponent(notification.relatedStudentId)}`);
      return;
    }

    navigate("/dashboard");
  };

  const links: SidebarLink[] = roleSections.flatMap((section) => [...section.links]);

  const handleSignOut = async () => {
    await signOut();
    navigate(isDemo ? "/" : "/auth");
  };

  const isLinkActive = (to: string) => {
    const [path, query = ""] = to.split("?");
    if (location.pathname !== path) return false;
    return query ? location.search === `?${query}` : location.search === "";
  };

  const activeLink = links.find((link) => isLinkActive(link.to));
  const activeSection = roleSections.find((section) => section.links.some((link) => isLinkActive(link.to))) ?? null;
  const shellContext = getDashboardShellContext({
    isAdmin,
    isLecturerEquivalent,
    activeSectionLabel: activeSection?.label ?? null,
    activeSectionDescription: activeSection?.description ?? null,
    activeLinkLabel: activeLink?.label ?? null,
  });

  useEffect(() => {
    if (!activeSection) return;

    setOpenSections((current) => (
      current[activeSection.label] ? current : { ...current, [activeSection.label]: true }
    ));
  }, [activeSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(sidebarStateKey, JSON.stringify(openSections));
  }, [openSections, sidebarStateKey]);

  useEffect(() => {
    preloadCommonRoleRoutes(profile?.role);
  }, [profile?.role]);

  useEffect(() => {
    if (typeof window === "undefined" || isDemo || !isLecturerEquivalent || isAdmin) {
      setShowOnboarding(false);
      return;
    }

    const dismissed = window.localStorage.getItem(LECTURER_ONBOARDING_STATE_KEY) === "true";
    setShowOnboarding(!dismissed);
  }, [isAdmin, isDemo, isLecturerEquivalent]);

  const toggleSection = (label: string) => {
    setOpenSections((current) => ({ ...current, [label]: !current[label] }));
  };

  const dismissOnboarding = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LECTURER_ONBOARDING_STATE_KEY, "true");
    }
    setShowOnboarding(false);
  };

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
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_28%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.28))]">
      <Dialog open={showOnboarding} onOpenChange={(open) => (!open ? dismissOnboarding() : setShowOnboarding(true))}>
        <DialogContent className="max-w-3xl gap-5 p-0">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>Welcome to GradeAI</DialogTitle>
                   <DialogDescription>
                     GradeAI helps you manage teaching and assessment work in one place. Start with these three first actions.
                   </DialogDescription>
                 </div>
               </div>
             </DialogHeader>
           </div>

           <div className="px-6">
             <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
               <p className="text-sm font-medium text-foreground">Start here</p>
               <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                 <li>1. Review your <span className="font-medium text-foreground">workspace overview</span>.</li>
                 <li>2. Create or open an <span className="font-medium text-foreground">assignment</span>.</li>
                 <li>3. Check <span className="font-medium text-foreground">grading, integrity, and moderation</span> before release.</li>
               </ol>
             </div>
           </div>

           <div className="grid gap-3 px-6 pb-1 md:grid-cols-3">
             {lecturerOnboardingActions.map((card) => (
               <div key={card.title} className="rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm">
                 <p className="text-sm font-semibold text-foreground">{card.title}</p>
                 <p className="mt-1 text-sm leading-6 text-muted-foreground">{card.description}</p>
               </div>
            ))}
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4 sm:justify-between sm:space-x-0">
            <p className="text-xs text-muted-foreground">
              You can close this now and start working immediately.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={dismissOnboarding}>
                Skip for now
              </Button>
              <Button type="button" onClick={dismissOnboarding}>
                Start using GradeAI
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {isAdmin ? "Admin workspace" : isLecturerEquivalent ? "Academic workspace" : "Student workspace"}
              </p>
            </div>
            {isDemo && <Badge variant="outline" className="ml-auto text-[10px] border-sidebar-border text-sidebar-foreground/60">Demo</Badge>}
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
              {shellContext.workspaceLabel}
            </p>
            <h1 className="truncate font-display text-xl font-semibold tracking-tight">
              {activeLink?.label || "Dashboard"}
            </h1>
            <p className="mt-0.5 hidden max-w-2xl truncate text-xs text-muted-foreground md:block">
              {shellContext.workspaceHint}
            </p>
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
            {showNotifications && (
              <div className="absolute right-4 top-16 z-50 w-80 rounded-2xl border bg-card shadow-xl">
                <div className="border-b p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Notifications</p>
                    {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">No new notifications</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "rounded-xl text-left text-xs",
                          notification.read ? "opacity-75" : "bg-muted/25",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void openNotification(notification)}
                          className="block w-full rounded-xl p-3 text-left text-xs hover:bg-muted/40"
                        >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {!notification.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                            <span className="truncate font-medium">{notification.subject}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {safeFormatDate(notification.createdAt, "MMM d, HH:mm")}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {getNotificationCategoryLabel(notification.category)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">{notification.recipientName}</p>
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{notification.body}</p>
                        {isStudentRole(profile?.role) && getStudentNotificationPreviewHint(notification) && (
                          <p className="mt-2 text-[11px] font-medium text-foreground/80">
                            {getStudentNotificationPreviewHint(notification)}
                          </p>
                        )}
                        {!isStudentRole(profile?.role) && getLecturerWorkflowNotificationPreviewHint({
                          notification,
                          notifications,
                        }) && (
                          <p className="mt-2 text-[11px] font-medium text-foreground/80">
                            {getLecturerWorkflowNotificationPreviewHint({
                              notification,
                              notifications,
                            })}
                          </p>
                        )}
                        </button>
                        <div className="flex justify-end px-3 pb-3">
                          <button
                            type="button"
                            onClick={(event) => void handleClearNotification(event, notification)}
                            className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
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
