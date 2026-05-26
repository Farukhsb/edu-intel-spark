import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { calculateRiskScore, getRiskLabel } from "@/lib/riskCalculator";
import { isAdminRole, isLecturerEquivalentRole, isStudentRole } from "@/lib/roles";
import { getDashboardShellContext } from "@/lib/dashboardShell";
import {
  getLecturerWorkflowNotificationDestination,
} from "@/lib/lecturerWorkflowNotifications";
import {
  clearCommunicationMessage,
  loadVisibleCommunicationMessages,
  markCommunicationMessageRead,
  type CommunicationMessage,
} from "@/lib/communications";
import { LecturerOnboardingDialog } from "@/components/dashboard/LecturerOnboardingDialog";
import { getStudentSupportNotificationDestination } from "@/lib/studentSupportWorkflow";
import { preloadCommonRoleRoutes } from "@/lib/routePreloads";
import {
  adminSections,
  getDefaultSectionState,
  lecturerSections,
  studentSections,
} from "@/lib/dashboardNavigation";
import {
  DEMO_LECTURER_NOTIFICATIONS,
  DEMO_STUDENT_NOTIFICATIONS,
} from "@/lib/demoNotifications";

const LECTURER_SIDEBAR_STATE_KEY = "gradeai:lecturer-sidebar-sections";
const ADMIN_SIDEBAR_STATE_KEY = "gradeai:admin-sidebar-sections";
const STUDENT_SIDEBAR_STATE_KEY = "gradeai:student-sidebar-sections";
const LECTURER_ONBOARDING_STATE_KEY = "gradeai:lecturer-onboarding-v1-dismissed";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, user, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = isAdminRole(profile?.role);
  const isLecturerEquivalent = isLecturerEquivalentRole(profile?.role);
  const roleSections = isAdmin ? adminSections : isLecturerEquivalent ? lecturerSections : studentSections;
  const defaultSectionState = getDefaultSectionState(roleSections);
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

  const links = roleSections.flatMap((section) => [...section.links]);

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

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_28%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.28))]">
      <LecturerOnboardingDialog open={showOnboarding} onDismiss={dismissOnboarding} />

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        roleSections={roleSections}
        openSections={openSections}
        toggleSection={toggleSection}
        isDemo={isDemo}
        isAdmin={isAdmin}
        isLecturerEquivalent={isLecturerEquivalent}
        profile={profile}
        handleSignOut={() => {
          void handleSignOut();
        }}
        isLinkActive={isLinkActive}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-xl lg:px-8">
          <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <DashboardHeader
            activeLabel={activeLink?.label || "Dashboard"}
            workspaceLabel={shellContext.workspaceLabel}
            workspaceHint={shellContext.workspaceHint}
            isDemo={isDemo}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            unreadCount={unreadCount}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
          />
          {showNotifications && (
            <NotificationDropdown
              notifications={notifications}
              unreadCount={unreadCount}
              isStudent={isStudentRole(profile?.role)}
              onOpenNotification={(notification) => {
                void openNotification(notification);
              }}
              onClearNotification={(event, notification) => {
                void handleClearNotification(event, notification);
              }}
            />
          )}
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
};
