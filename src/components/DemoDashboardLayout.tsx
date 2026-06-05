import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { isStudentRole } from "@/lib/roles";
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
import { getStudentSupportNotificationDestination } from "@/lib/studentSupportWorkflow";
import { preloadDemoRoleRoutes } from "@/lib/routePreloads";
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

const rewriteDashboardLinkForDemo = (to: string) => {
  if (to === "/dashboard" || to.startsWith("/dashboard?")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/cohort-dashboard")) {
    return to.replace("/dashboard/cohort-dashboard", "/demo/dashboard/cohort-analytics");
  }
  if (to.startsWith("/dashboard/performance")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/cohort-dashboard") || to.startsWith("/dashboard/cohort-analytics")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/improvements")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/learning-outcomes")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/integrity")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/accreditation")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/moderation")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/external-examiner")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/institutional")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  if (to.startsWith("/dashboard/assignments")) {
    return to.replace("/dashboard", "/demo/dashboard");
  }
  return to;
};

export const DemoDashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, user, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";
  const isLecturerEquivalent = profile?.role === "lecturer";
  const roleSections = (isAdmin ? adminSections : isLecturerEquivalent ? lecturerSections : studentSections).map(
    (section) => ({
      ...section,
      links: section.links.map((link) => ({
        ...link,
        to: rewriteDashboardLinkForDemo(link.to),
      })),
    }),
  );
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
          navigate(`/demo/dashboard${params.toString() ? `?${params.toString()}` : ""}`, {
            state: {
              notification: supportDestination.targetNotification ?? notification,
              redirectedFromSupportNotification: notification,
            },
          });
          return;
        }

        if (supportDestination.kind === "assignments") {
          navigate("/demo/dashboard/assignments?source=support-notification", {
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
        navigate(`/demo/dashboard${params.toString() ? `?${params.toString()}` : ""}`, {
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
        navigate(`/demo/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
        return;
      }

      if (notification.category === "assignment-published") {
        navigate("/demo/dashboard/assignments");
        return;
      }

      if (notification.relatedAssignmentId) {
        navigate("/demo/dashboard/assignments");
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
          `/demo/dashboard/assignments/${encodeURIComponent(notification.relatedAssignmentId)}?source=notification&focus=${destination.focus}`,
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

      navigate(`/demo/dashboard/assignments/${encodeURIComponent(notification.relatedAssignmentId)}`);
      return;
    }

    if (isLecturerEquivalent && notification.category === "intervention-overdue-reminder") {
      if (notification.relatedStudentId) {
        navigate(`/demo/dashboard/student/${encodeURIComponent(notification.relatedStudentId)}?source=overdue-reminder`);
        return;
      }

      navigate("/demo/dashboard?view=intervention-evidence");
      return;
    }

    if (isLecturerEquivalent && notification.relatedStudentId) {
      navigate(`/demo/dashboard/student/${encodeURIComponent(notification.relatedStudentId)}`);
      return;
    }

    navigate("/demo/dashboard");
  };

  const links = roleSections.flatMap((section) => [...section.links]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isLinkActive = (to: string) => {
    const [path, query = ""] = to.split("?");
    const activePath = location.pathname.startsWith("/demo/dashboard")
      ? location.pathname.replace("/demo", "")
      : location.pathname;
    const normalizedPath = path.startsWith("/demo/dashboard") ? path.replace("/demo", "") : path;
    if (activePath !== normalizedPath) return false;
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
    preloadDemoRoleRoutes(profile?.role);
  }, [profile?.role]);

  const toggleSection = (label: string) => {
    setOpenSections((current) => ({ ...current, [label]: !current[label] }));
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_26%),radial-gradient(circle_at_top_right,hsl(var(--accent)/0.10),transparent_24%),linear-gradient(to_bottom,hsl(var(--background)),hsl(var(--muted)/0.18))]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        roleSections={roleSections}
        openSections={openSections}
        toggleSection={toggleSection}
        isAdmin={isAdmin}
        isLecturerEquivalent={isLecturerEquivalent}
        profile={profile}
        handleSignOut={() => {
          void handleSignOut();
        }}
        isLinkActive={isLinkActive}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-primary/10 bg-background/72 px-4 backdrop-blur-xl lg:px-8">
          <Button variant="ghost" size="icon" className="rounded-xl lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Badge variant="secondary" className="hidden text-xs md:inline-flex">
            Demo Mode
          </Badge>
          <DashboardHeader
            activeLabel={activeLink?.label || "Dashboard"}
            workspaceLabel={shellContext.workspaceLabel}
            workspaceHint={shellContext.workspaceHint}
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
