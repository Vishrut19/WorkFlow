'use client';

import {
    ChevronRight,
    FileText,
    History,
    LayoutDashboard,
    LogOut,
    Map as MapIcon,
    Settings,
    ShieldCheck,
    Users
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';

// Prefetch map data on hover for instant navigation
const prefetchMapData = () => {
    import('@/components/LiveMap').then(mod => mod.prefetchMapData?.());
};

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Live Team Map', href: '/map', icon: MapIcon },
    { name: 'Staff Management', href: '/staff', icon: Users },
    { name: 'Attendance Records', href: '/attendance', icon: History },
    { name: 'Device Management', href: '/devices', icon: ShieldCheck },
];

const secondaryNav = [
    { name: 'Reports', href: '/reports', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { signOut, user } = useAuth();
    const { isMobile } = useSidebar();

    return (
        <Sidebar variant="inset" collapsible="icon">
            <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
                <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-[0_0_20px_rgba(59,130,246,0.2)] border border-primary/20">
                        <img src="/logo.png" alt="WorkFlow Logo" className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none min-w-0 group-data-[collapsible=icon]:hidden">
                        <span className="font-black tracking-tight text-lg truncate">WorkFlow</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold truncate">Infrastructure</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Administrative</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                        tooltip={item.name}
                                        className="transition-all duration-200"
                                    >
                                        <Link 
                                            href={item.href}
                                            onMouseEnter={item.href === '/map' ? prefetchMapData : undefined}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <Separator className="mx-4 w-auto bg-border/50" />
                <SidebarGroup>
                    <SidebarGroupLabel>Support & Setup</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {secondaryNav.map((item) => (
                                <SidebarMenuItem key={item.name}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={pathname === item.href}
                                        tooltip={item.name}
                                    >
                                        <Link href={item.href}>
                                            <item.icon className="h-4 w-4" />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    size="lg"
                                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!p-0"
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-sm font-bold text-primary">
                                        {(user?.user_metadata?.full_name as string)?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="grid flex-1 min-w-0 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                        <span className="truncate font-semibold">{user?.email?.split('@')[0]}</span>
                                        <span className="truncate text-xs text-muted-foreground uppercase tracking-tighter font-bold">System Admin</span>
                                    </div>
                                    <ChevronRight className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg bg-popover border-border"
                                side={isMobile ? "bottom" : "right"}
                                align="end"
                                sideOffset={4}
                            >
                                <DropdownMenuLabel className="p-0 font-normal">
                                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-sm font-bold text-primary">
                                            {(user?.user_metadata?.full_name as string)?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div className="grid flex-1 text-left text-sm leading-tight">
                                            <span className="truncate font-semibold">{user?.email}</span>
                                            <span className="truncate text-xs text-muted-foreground">Supabase Authenticated</span>
                                        </div>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer font-bold">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Terminate Session
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
