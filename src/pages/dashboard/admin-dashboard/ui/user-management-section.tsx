import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminUserRow } from "../types";
import {
  FULL_TABLE_PAGE_SIZE,
  PAGE_SIZE,
  PaginationControls,
  normalizeSearchValue,
  paginateRows,
} from "./shared";
import { EmptyUserManagementState, UserManagementTable } from "./user-management-table";
import { UserManagementToolbar } from "./user-management-toolbar";

export const UserManagementSection = ({
  users,
  onRequestRoleChange,
  changingUserId,
  onSyncRoleMetadata,
  syncingUserId,
  onViewUser,
  onEditUser,
  compact,
}: {
  users: AdminUserRow[];
  onRequestRoleChange: (user: AdminUserRow, nextRole: "student" | "lecturer") => void;
  changingUserId: string | null;
  onSyncRoleMetadata: (user: AdminUserRow) => void;
  syncingUserId: string | null;
  onViewUser: (user: AdminUserRow) => void;
  onEditUser: (user: AdminUserRow) => void;
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
            <CardDescription>Institution-managed profile fields can be corrected here. Email and auth-provider identity remain outside this dashboard because those records must stay aligned with Supabase Auth.</CardDescription>
          </div>
          {compact ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard?view=users")}>
              Open full table
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!compact ? <UserManagementToolbar query={query} setQuery={setQuery} /> : null}
        {visibleRows.length === 0 ? (
          <EmptyUserManagementState />
        ) : (
          <UserManagementTable
            users={visibleRows}
            onRequestRoleChange={onRequestRoleChange}
            changingUserId={changingUserId}
            onSyncRoleMetadata={onSyncRoleMetadata}
            syncingUserId={syncingUserId}
            onViewUser={onViewUser}
            onEditUser={onEditUser}
          />
        )}
        {!compact && visibleRows.length > 0 ? (
          <PaginationControls page={page} totalPages={totalPages} itemLabel="Users" onPageChange={setPage} />
        ) : null}
      </CardContent>
    </Card>
  );
};
