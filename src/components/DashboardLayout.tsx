import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Award, BarChart3, Bell, BookOpen, Brain, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut,
  Menu, MessageSquare, Moon, Search, Settings, Shield, Sun, Target, TrendingUp, University,
  Upload, User, X, Users, Download, FileOutput,
} from "lucide-react";
import { useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BulkStudentUpload } from "@/components/BulkStudentUpload";
import { cn } from "@/lib/utils";

const lecturerLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/assignments", label: "Assignments", icon: Upload },
  { to: "/dashboard/learning-outcomes", label: "Learning Outcomes", icon: Target },
  { to: "/dashboard/cohort-analytics", label: "Cohort Analytics", icon: BarChart3 },
  { to: "/dashboard/performance", label: "Performance Trends", icon: TrendingUp },
  { to: "/dashboard/integrity", label: "Academic Integrity", icon: Shield },
  { to: "/dashboard/institutional", label: "Institutional Insights", icon: University },
  { to: "/dashboard/accreditation", label: "Accreditation", icon: Award },
  { to: "/dashboard/external-examiner", label: "External Examiner", icon: FileOutput },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

const studentLinks = [
  { to: "/dashboard", label: "My Grades", icon: GraduationCap },
  { to: "/dashboard/assignments", label: "Assignments", icon: Upload },
  { to: "/dashboard/explain-grade", label: "Explain My Grade", icon: MessageSquare },
  { to: "/dashboard/improvements", label: "Improvement Plan", icon: TrendingUp },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut, isDemo } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") === "dark";
    return false;
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
    if (isDemo || !profile) return;
    try {
      const q = query(
        collection(db, "notifications"),
        where("user_id", "==", profile.id),
        where("read", "==", false),
        orderBy("created_at", "desc"),
        limit(10)
      );
      const unsub = onSnapshot(q, (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, () => { /* notifications collection may not exist yet */ });
      return () => unsub();
    } catch { /* ignore */ }
  }, [profile, isDemo]);

  const links = profile?.role === "lecturer" ? lecturerLinks : studentLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate(isDemo ? "/" : "/auth");
  };

  const filteredLinks = searchQuery
    ? links.filter((l) => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : links;

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <Brain className="h-7 w-7 text-sidebar-primary" />
          <span className="font-display text-lg font-bold text-sidebar-primary-foreground">GradeAI</span>
          {isDemo && <Badge variant="outline" className="text-[10px] border-sidebar-border text-sidebar-foreground/60">Demo</Badge>}
        </div>

        <div className="px-3 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/40" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">
          {filteredLinks.map((link) => (
            <Link key={link.to} to={link.to} onClick={() => { setSidebarOpen(false); setSearchQuery(""); }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                location.pathname === link.to ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>

        {profile?.role === "lecturer" && !isDemo && (
          <div className="px-3 pb-2">
            <BulkStudentUpload />
          </div>
        )}

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 px-2 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {profile?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{profile?.full_name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{profile?.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {isDemo ? "Exit Demo" : "Sign Out"}
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="font-display text-lg font-semibold">
            {links.find((l) => l.to === location.pathname)?.label || "Dashboard"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {isDemo && (
              <Badge variant="secondary" className="text-xs">
                Demo Mode
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} title="Toggle dark mode">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                    {notifications.length}
                  </span>
                )}
              </Button>
              {showNotifications && (
                <div className="absolute right-0 top-10 z-50 w-72 rounded-lg border bg-card shadow-lg">
                  <div className="p-3 border-b">
                    <p className="text-sm font-medium">Notifications</p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center">No new notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="p-3 border-b last:border-0 hover:bg-muted/50">
                          <p className="text-sm">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
};
