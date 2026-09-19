'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { 
  Building2, LayoutDashboard, Home, CreditCard, MessageSquare, Vote, 
  ClipboardList, CalendarDays, FileBarChart, LogOut, Users, ShieldCheck, 
  ChevronLeft, ChevronRight, Menu, Settings
} from 'lucide-react';

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'pranav07112007@gmail.com';

const navItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { title: 'Property Tracker', href: '/dashboard/properties', icon: Home },
  { title: 'Maintenance', href: '/dashboard/maintenance', icon: CreditCard },
  { title: 'Complaints', href: '/dashboard/complaints', icon: MessageSquare },
  { title: 'Voting', href: '/dashboard/voting', icon: Vote },
  { title: 'Notice Board', href: '/dashboard/notices', icon: ClipboardList },
  { title: 'Hall Allocation', href: '/dashboard/halls', icon: CalendarDays },
  { title: 'Annual Report', href: '/dashboard/reports', icon: FileBarChart },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, society, signOut } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const isAdminOrSecretary = profile?.role === 'ADMIN' || profile?.role === 'SECRETARY';
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const isCollapsed = !isMobile && collapsed;
    
    return (
      <div className="flex h-full flex-col bg-card/60 backdrop-blur-xl transition-all duration-300 w-full">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border/50 px-4">
          <Building2 className="h-6 w-6 text-primary shrink-0" />
          {!isCollapsed && (
            <span className="ml-2 text-lg font-bold tracking-tight truncate">Society SaaS</span>
          )}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="ml-auto p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto py-4">
          <nav className="grid gap-1 px-2">
            {navItems
              .filter(item => {
                if (society?.mode === 'ADMIN_ONLY') {
                  const hiddenInAdminOnly = ['/dashboard/complaints', '/dashboard/voting', '/dashboard/notices', '/dashboard/halls'];
                  return !hiddenInAdminOnly.includes(item.href);
                }
                return true;
              })
              .map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                    active
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.title}</span>}
                </Link>
              );
            })}

            {/* Admin tools */}
            {(isAdminOrSecretary || isSuperAdmin) && !isCollapsed && (
              <p className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
            )}
            {isAdminOrSecretary && (
              <Link
                href="/dashboard/admin/users"
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? 'Members' : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  isActive('/dashboard/admin/users')
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground"
                )}
              >
                <Users className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Members</span>}
              </Link>
            )}
            {profile?.role === 'ADMIN' && (
              <Link
                href="/dashboard/settings"
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? 'Settings' : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  isActive('/dashboard/settings')
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Settings</span>}
              </Link>
            )}
            {isSuperAdmin && (
              <Link
                href="/super-admin"
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? 'Super Admin' : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground",
                  pathname.startsWith('/super-admin')
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-yellow-600 dark:text-yellow-400"
                )}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                {!isCollapsed && <span>Super Admin</span>}
              </Link>
            )}
          </nav>
        </div>

        {/* User info */}
        <div className="border-t border-border/50 p-3">
          {!isCollapsed && (
            <div className="mb-3 px-1">
              <p className="text-sm font-medium truncate">{profile?.first_name} {profile?.last_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              {profile?.role && (
                <span className="mt-1 inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">{profile.role}</span>
              )}
              {isSuperAdmin && (
                <span className="ml-1 mt-1 inline-block text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Super Admin</span>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size={isCollapsed ? 'icon' : 'default'}
            className={cn("text-muted-foreground hover:text-foreground", !isCollapsed && "w-full justify-start")}
            onClick={() => { setMobileOpen(false); signOut(); }}
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Topbar & Sheet */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card/60 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight">Society SaaS</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 bg-background border-r-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent isMobile />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden md:flex h-full border-r border-border/50 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <SidebarContent />
      </div>
    </>
  );
}
