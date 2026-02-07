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
import { format } from "date-fns";
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Monitor,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// Helper function to determine device type
const getDeviceType = (deviceName: string | null): "mobile" | "computer" => {
  if (!deviceName) return "mobile"; // Default to mobile

  const name = deviceName.toLowerCase();

  // Check for mobile indicators
  const mobileKeywords = ["iphone", "android", "mobile", "phone", "ios", "samsung", "pixel", "oneplus"];
  const isMobile = mobileKeywords.some(keyword => name.includes(keyword));

  // Check for computer indicators
  const computerKeywords = ["mac", "macbook", "windows", "pc", "desktop", "laptop", "computer", "imac"];
  const isComputer = computerKeywords.some(keyword => name.includes(keyword));

  return isComputer ? "computer" : "mobile";
};

export default function DeviceManagement() {
  const [devices, setDevices] = useState<any[]>(() => getCached<any[]>(CACHE_KEYS.DEVICES) ?? []);
  const [loading, setLoading] = useState(!getCached<any[]>(CACHE_KEYS.DEVICES)?.length);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_devices")
        .select("*, profiles:user_id (full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = data ?? [];
      setDevices(list);
      setCached(CACHE_KEYS.DEVICES, list, 90 * 1000);
    } catch (error) {
      console.error("Error loading devices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCached<any[]>(CACHE_KEYS.DEVICES);
    if (cached?.length) setDevices(cached);
    loadDevices();
  }, [loadDevices]);

  async function toggleAuthorization(deviceId: string, currentStatus: boolean) {
    setActionLoading(deviceId);
    try {
      const { error } = await supabase
        .from("user_devices")
        .update({ is_authorized: !currentStatus })
        .eq("id", deviceId);

      if (error) throw error;
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, is_authorized: !currentStatus } : d,
        ),
      );
    } catch (err: any) {
      console.error("Error updating device:", err);
      alert(err?.message || "Failed to update device. You may need admin access.");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <DashboardLayout>
      <div className="mb-8 px-1">
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center">
          <ShieldCheck className="mr-4 text-primary" size={32} />
          Device Security
        </h2>
        <p className="text-muted-foreground mt-2 font-medium">
          Manage and authorize mobile hardware access
        </p>
      </div>

      <Card className="overflow-hidden border-border bg-card shadow-md py-0">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader size="lg" />
              <p className="text-sm font-medium text-muted-foreground">
                Loading devices…
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/80 bg-muted/40 hover:bg-transparent">
                  <TableHead className="w-[1%] min-w-[180px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Employee
                  </TableHead>
                  <TableHead className="w-[1%] min-w-[160px] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Hardware Profile
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
                    Registration
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Security Status
                  </TableHead>
                  <TableHead className="w-0 whitespace-nowrap px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow
                    key={device.id}
                    className="border-b border-border/60 transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="px-3 py-3">
                      <div className="font-semibold text-foreground">
                        {device.profiles?.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {device.profiles?.email}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        {getDeviceType(device.device_name) === "mobile" ? (
                          <Smartphone
                            size={14}
                            className="shrink-0 text-primary"
                          />
                        ) : (
                          <Monitor
                            size={14}
                            className="shrink-0 text-primary"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {device.device_name || `${device.profiles?.full_name}'s Device`}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {getDeviceType(device.device_name) === "mobile" ? "Mobile" : "Computer"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground justify-center">
                        <Clock size={12} className="shrink-0" />
                        <span className="text-sm font-medium tabular-nums">
                          {format(new Date(device.created_at), "MMM d, yyyy")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-3 text-center">
                      {device.is_authorized ? (
                        <Badge
                          variant="secondary"
                          className="rounded-md border-0 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400"
                        >
                          <CheckCircle2 size={10} className="mr-1 inline" />
                          Authorized
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="rounded-md border-0 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                        >
                          <ShieldAlert size={10} className="mr-1 inline" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-3 text-center">
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
                          <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-widest font-bold">
                            Security Options
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem
                            onSelect={() => {
                              toggleAuthorization(
                                device.id,
                                device.is_authorized,
                              );
                            }}
                            disabled={actionLoading === device.id}
                            className={`cursor-pointer ${device.is_authorized ? "text-red-500 focus:bg-red-500/10" : "text-blue-500 focus:bg-blue-500/10 font-bold"}`}
                          >
                            {device.is_authorized ? (
                              <div className="flex items-center">
                                <XCircle size={14} className="mr-2" /> Revoke
                                Authorization
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <CheckCircle size={14} className="mr-2" />{" "}
                                Authorize Device
                              </div>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {devices.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50 ring-1 ring-border/50">
                          <Smartphone
                            size={24}
                            className="text-muted-foreground"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            No devices registered
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Devices will appear here once staff register from
                            the app
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
