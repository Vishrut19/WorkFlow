"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCached, setCached, CACHE_KEYS } from "@/lib/data-cache";
import { supabase } from "@/lib/supabase";
import { Mail, MoreVertical, Search, UserCheck, UserCircle, Users, UserX } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Role = "staff" | "manager" | "admin";

export default function StaffManagement() {
  const [users, setUsers] = useState<any[]>(() => getCached<any[]>(CACHE_KEYS.STAFF_LIST) ?? []);
  const [loading, setLoading] = useState(!getCached<any[]>(CACHE_KEYS.STAFF_LIST));
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name", { ascending: true });
      if (error) throw error;
      const list = data ?? [];
      setUsers(list);
      setCached(CACHE_KEYS.STAFF_LIST, list, 90 * 1000);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCached<any[]>(CACHE_KEYS.STAFF_LIST);
    if (cached?.length) setUsers(cached);
    loadUsers();
  }, [loadUsers]);

  async function updateUserRole(userId: string, newRole: Role) {
    setActionLoadingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (error) {
      console.error("Error updating role:", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function toggleUserStatus(userId: string, currentStatus: boolean) {
    setActionLoadingId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) throw error;
      setUsers(
        users.map((u) =>
          u.id === userId ? { ...u, is_active: !currentStatus } : u,
        ),
      );
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge
            variant="secondary"
            className="rounded-md border-0 bg-violet-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"
          >
            Admin
          </Badge>
        );
      case "manager":
        return (
          <Badge
            variant="secondary"
            className="rounded-md border-0 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300"
          >
            Manager
          </Badge>
        );
      default:
        return (
          <Badge
            variant="secondary"
            className="rounded-md border-0 bg-slate-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400"
          >
            Staff
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center">
            <Users className="mr-4 text-primary" size={32} />
            Staff Management
          </h2>
          <p className="text-muted-foreground mt-2 font-medium">
            System users, roles and access control
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
      </div>

      <Card className="mb-10 overflow-hidden border-border bg-card shadow-md py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader size="lg" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading team…
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/80 bg-muted/40 hover:bg-transparent">
                  <TableHead className="w-[1%] min-w-[200px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Employee
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Role
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="border-b border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="px-3 py-3">
                      <Link
                        href={`/staff/${user.id}`}
                        className="flex items-center gap-4 hover:opacity-90 transition-opacity"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary ring-1 ring-primary/10">
                          {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">
                            {user.full_name || "Unnamed User"}
                          </div>
                          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            <Mail size={12} className="shrink-0" />
                            {user.email}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-center">
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell className="px-3 py-3 text-center">
                      <Badge
                        variant="secondary"
                        className={`rounded-md border-0 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          user.is_active
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-red-500/15 text-red-600 dark:text-red-400"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-3 text-right">
                      <div className="flex items-center justify-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-popover border-border text-popover-foreground"
                          >
                            <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-widest">
                              Assign Role
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() => updateUserRole(user.id, "staff")}
                              className="hover:bg-accent focus:bg-accent cursor-pointer"
                            >
                              Set as Staff
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateUserRole(user.id, "manager")}
                              className="hover:bg-accent focus:bg-accent cursor-pointer"
                            >
                              Set as Manager
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateUserRole(user.id, "admin")}
                              className="hover:bg-accent focus:bg-accent cursor-pointer text-purple-500"
                            >
                              Set as Admin
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-widest mt-1">
                              Actions
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/staff/${user.id}`}
                                className="flex cursor-pointer items-center focus:bg-accent"
                              >
                                <UserCircle size={14} className="mr-2" />
                                View details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              onClick={() =>
                                toggleUserStatus(user.id, user.is_active)
                              }
                              className={`cursor-pointer ${user.is_active ? "text-destructive hover:bg-destructive/10" : "text-green-500 hover:bg-green-500/10"}`}
                            >
                              {user.is_active ? (
                                <div className="flex items-center">
                                  <UserX size={14} className="mr-2" />{" "}
                                  Deactivate Account
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <UserCheck size={14} className="mr-2" />{" "}
                                  Activate Account
                                </div>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                          <Search size={24} className="text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            No team members found
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Try a different search or check filters
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
