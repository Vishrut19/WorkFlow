'use client';

import { AppSidebar } from '@/components/AppSidebar';
import { ModeToggle } from '@/components/mode-toggle';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) router.push('/login');
    }, [user, loading, router]);

    const handleSignOut = useCallback(async () => {
        if (user) await signOut();
        router.push('/login');
    }, [user, signOut, router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <Loader size="lg" />
            </div>
        );
    }
    if (!user) return null;

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="border-l border-border bg-background text-foreground">
                <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 justify-between">
                    <div className="flex items-center gap-2">
                        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
                        <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                                        WorkFlow Infrastructure
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage className="font-bold">Admin Panel</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleSignOut}
                            className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-950/30"
                            title="Sign Out"
                        >
                            <LogOut className="h-[1.2rem] w-[1.2rem]" />
                        </Button>
                    </div>
                </header>
                <div className="flex flex-1 flex-col gap-4 p-8 pt-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
