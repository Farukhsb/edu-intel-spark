import {
  AlertTriangle,
  Award,
  BarChart3,
  ClipboardCheck,
  FileOutput,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
  Target,
  TrendingUp,
  University,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SidebarLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export type SidebarSection = {
  label: string;
  description: string;
  defaultOpen: boolean;
  links: readonly SidebarLink[];
};

export const lecturerSections = [
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
    links: [{ to: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
] as const satisfies readonly SidebarSection[];

export const adminSections = [
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
    links: [{ to: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
] as const satisfies readonly SidebarSection[];

export const studentSections = [
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
    links: [{ to: "/dashboard/settings", label: "Settings", icon: Settings }],
  },
] as const satisfies readonly SidebarSection[];

export const getDefaultSectionState = (sections: readonly SidebarSection[]) =>
  Object.fromEntries(sections.map((section) => [section.label, section.defaultOpen])) as Record<string, boolean>;
