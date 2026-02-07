'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { getCached, setCached, CACHE_KEYS } from '@/lib/data-cache';
import { supabase } from '@/lib/supabase';
import { Bell, Globe, Lock, Save, Settings, Shield, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const EMPTY_PROFILE = { full_name: '', email: '', role: '' };

export default function SettingsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<{ full_name: string; email: string; role: string }>(EMPTY_PROFILE);

    const loadProfile = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (error) throw error;
            if (data) {
                const next = {
                    full_name: data.full_name || '',
                    email: data.email || '',
                    role: data.role || '',
                };
                setProfile(next);
                setCached(CACHE_KEYS.PROFILE(user.id), next, 5 * 60 * 1000);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        const cached = getCached<typeof EMPTY_PROFILE>(CACHE_KEYS.PROFILE(user.id));
        if (cached?.email) setProfile(cached);
        loadProfile();
    }, [user?.id, loadProfile]);

    async function updateProfile() {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: profile.full_name })
                .eq('id', user?.id);

            if (error) throw error;
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Failed to update profile.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <DashboardLayout>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-foreground flex items-center">
                    <Settings className="mr-3 text-muted-foreground" />
                    System Settings
                </h2>
                <p className="text-muted-foreground mt-1">Manage your administrative preferences and system configuration</p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="bg-muted border border-border mb-8">
                    <TabsTrigger value="profile" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <User className="mr-2 h-4 w-4" />
                        Admin Profile
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Bell className="mr-2 h-4 w-4" />
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger value="security" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Shield className="mr-2 h-4 w-4" />
                        Security & Privacy
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="profile">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Profile Information</CardTitle>
                            <CardDescription>Update your account details and display name</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-foreground">Full Name</Label>
                                    <Input
                                        id="name"
                                        value={profile.full_name}
                                        onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                                        className="bg-input border-border text-foreground focus:border-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-foreground">Email Address</Label>
                                    <Input
                                        id="email"
                                        value={profile.email}
                                        disabled
                                        className="bg-muted border-border text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 max-w-sm">
                                <Label className="text-foreground">System Role</Label>
                                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-bold uppercase tracking-wider">
                                    {profile.role || 'Administrator'}
                                </div>
                            </div>
                            <Button
                                onClick={updateProfile}
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="notifications">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Notification Preferences</CardTitle>
                            <CardDescription>Configure how you receive system alerts and staff updates</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-bold text-foreground">New Device Requests</div>
                                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Email Alert</div>
                                    </div>
                                    <Switch />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-bold text-foreground">Staff Absence Alerts</div>
                                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">System Dashboard Notification</div>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-bold text-foreground">Weekly Performance Summaries</div>
                                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Email Delivery (Monday 8AM)</div>
                                    </div>
                                    <Switch defaultChecked />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="security">
                    <Card className="bg-card border-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">Security Controls</CardTitle>
                            <CardDescription>Enforce infrastructure security and privacy policies</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-4">
                            <div className="grid gap-6 md:grid-cols-2">
                                <Card className="bg-muted/50 border-border">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                                                <Lock size={18} />
                                            </div>
                                            <CardTitle className="text-sm text-foreground italic">Auth Protection</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Button variant="outline" className="w-full text-xs border-destructive/20 text-destructive hover:bg-destructive/10">
                                            Reset Admin Password
                                        </Button>
                                    </CardContent>
                                </Card>
                                <Card className="bg-muted/50 border-border">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                <Globe size={18} />
                                            </div>
                                            <CardTitle className="text-sm text-foreground italic">Network Restrictions</CardTitle>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Button variant="outline" className="w-full text-xs border-primary/20 text-primary hover:bg-primary/10">
                                            Manage IP Whitelist
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 flex gap-4">
                                <div className="text-yellow-500 mt-1">
                                    <Shield size={20} />
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-yellow-500">Privacy Notice</div>
                                    <p className="text-xs text-yellow-500/70 leading-relaxed">
                                        Location data is stored for 90 days as per the default retention policy. All tracking is suspended automatically outside of business hours recorded in attendance logs.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </DashboardLayout>
    );
}
