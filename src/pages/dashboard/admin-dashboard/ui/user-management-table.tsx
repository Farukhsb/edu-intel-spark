import { Loader2, UserCog } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";
import { formatCohortLevel } from "@/lib/formatters";

import type { AdminUserRow } from "../types";
import { ROLE_BADGE_STYLES, toStatusBadgeClass } from "./shared";

export const EmptyUserManagementState = () => (
  <div className="p-8 text-center">
    <p className="text-sm font-medium">No user records are visible</p>
    <p className="mt-1 text-sm text-muted-foreground">Profiles will appear here once admin-readable account records are available.</p>
  </div>
);

export const UserManagementTable = ({
  users,
  onRequestRoleChange,
  changingUserId,
  onSyncRoleMetadata,
  syncingUserId,
  onViewUser,
  onEditUser,
}: {
  users: AdminUserRow[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onSyncRoleMetadata: (user: AdminUserRow) => void;
  syncingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
  onEditUser: (user: AdminUserRow) => void;
}) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Level / Cohort</TableHead>
          <TableHead>Password reset required?</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
            <TableCell className="text-muted-foreground">{user.email || "Not available"}</TableCell>
            <TableCell>
              <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(user.role, ROLE_BADGE_STYLES)}`}>
                {user.role}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{user.departmentName || "Not set"}</TableCell>
            <TableCell className="text-muted-foreground">{formatCohortLevel(user.cohortId)}</TableCell>
            <TableCell>
              <Badge variant="outline" className={user.mustChangePassword ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"}>
                {user.mustChangePassword ? "Required" : "No"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{safeFormatDate(user.createdAt, "MMM d, yyyy", "Not available")}</TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onViewUser(user)}>
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEditUser(user)}>
                  Edit profile
                </Button>
                {user.role !== "admin" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={changingUserId === user.id}
                    onClick={() => onRequestRoleChange(user, user.role === "lecturer" ? "student" : "lecturer")}
                  >
                    {changingUserId === user.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserCog className="mr-2 h-4 w-4" />
                    )}
                    {user.role === "lecturer" ? "Demote to Student" : "Promote to Lecturer"}
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={syncingUserId === user.id}
                  onClick={() => onSyncRoleMetadata(user)}
                >
                  {syncingUserId === user.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sync auth metadata
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
