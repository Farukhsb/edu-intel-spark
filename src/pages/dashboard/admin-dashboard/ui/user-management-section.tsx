import { useEffect, useMemo, useState } from "react";
import { Loader2, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeFormatDate } from "@/lib/date";

import type { AdminUserRow } from "../types";
import {
  FULL_TABLE_PAGE_SIZE,
  PAGE_SIZE,
  PaginationControls,
  ROLE_BADGE_STYLES,
  normalizeSearchValue,
  paginateRows,
  toStatusBadgeClass,
} from "./shared";

export const UserManagementSection = ({
  users,
  onRequestRoleChange,
  changingUserId,
  onSyncRoleMetadata,
  syncingUserId,
  onViewUser,
  compact,
}: {
  users: AdminUserRow[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onSyncRoleMetadata: (user: AdminUserRow) => void;
  syncingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
  compact?: boolean;
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) =>
      [user.fullName, user.email, user.role].some((value) => String(value || "").toLowerCase().includes(normalizedQuery)),
    );
  }, [query, users]);

  const totalPages = compact ? 1 : Math.max(1, Math.ceil(filteredRows.length / FULL_TABLE_PAGE_SIZE));
  const visibleRows = compact ? filteredRows.slice(0, PAGE_SIZE) : paginateRows(filteredRows, page, FULL_TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, users, compact]);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">User and role management</CardTitle>
            <CardDescription>Role changes stay narrow, confirmed, and traceable. Account status is not wired yet, so this view only confirms that a profile record exists.</CardDescription>
            <p className="mt-2 text-xs text-muted-foreground">No role change</p>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=users")}>
              Open full table
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!compact ? (
          <div className="border-b border-border/60 px-6 py-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or role"
              aria-label="Search users"
              className="max-w-sm"
            />
          </div>
        ) : null}
        {visibleRows.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium">No user records are visible</p>
            <p className="mt-1 text-sm text-muted-foreground">Profiles will appear here once admin-readable account records are available.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.fullName || "Unknown user"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || "Not available"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize ${toStatusBadgeClass(user.role, ROLE_BADGE_STYLES)}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-500/30 bg-slate-500/10 text-slate-700">
                        Profile record only
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{safeFormatDate(user.createdAt, "MMM d, yyyy", "Not available")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onViewUser(user)}>
                          View
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
        )}
        {!compact && visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Users" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};
