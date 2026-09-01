'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { Logo } from './logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileText,
  Shield,
  LogOut,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: number;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  // Fetch pending approvals count for admin badge
  useEffect(() => {
    if (user?.Role !== 'Admin') return;

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/admin/pending-count');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(data.count);
        }
      } catch {
        // Silently fail
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [user?.Role]);

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/app/dashboard',
      icon: <LayoutDashboard className="h-5 w-5 shrink-0" />,
    },
    {
      label: 'Store Master',
      href: '/app/store-master',
      icon: <Package className="h-5 w-5 shrink-0" />,
    },
    {
      label: 'QC Master',
      href: '/app/qc-master',
      icon: <ClipboardCheck className="h-5 w-5 shrink-0" />,
    },
    {
      label: 'Inspection Report',
      href: '/app/inspection-report',
      icon: <FileText className="h-5 w-5 shrink-0" />,
    },
    {
      label: 'Admin Panel',
      href: '/app/admin/approvals',
      icon: <Shield className="h-5 w-5 shrink-0" />,
      adminOnly: true,
      badge: pendingCount,
    },
  ];

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || user?.Role === 'Admin'
  );

  function isActive(href: string) {
    if (href === '/app/dashboard') return pathname === href;
    if (href.startsWith('/app/admin')) return pathname.startsWith('/app/admin');
    return pathname.startsWith(href);
  }

  const renderNavLinks = (onItemClick?: () => void) => (
    <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
      {filteredItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
              active
                ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
            )}
          >
            {item.icon}
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <Badge
                variant={active ? 'secondary' : 'destructive'}
                className="h-5 min-w-[20px] px-1.5 text-xs shrink-0"
              >
                {item.badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const renderUserSection = () => (
    <div className="p-3.5 border-t bg-sidebar/50">
      <div className="mb-2.5 rounded-lg bg-muted/60 px-3 py-2">
        <p className="text-xs font-semibold text-foreground truncate">{user?.Name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{user?.Email}</p>
        <span className="inline-block mt-1 text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
          {user?.Role}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 h-9 text-xs font-medium"
        onClick={logout}
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </Button>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r bg-sidebar text-sidebar-foreground select-none">
        <div className="flex h-16 items-center px-6 border-b">
          <Logo size="md" />
        </div>
        {renderNavLinks()}
        {renderUserSection()}
      </aside>

      {/* 2. Mobile Drawer Navigation */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Mobile Navigation"
      >
        <div className="flex h-14 sm:h-16 items-center justify-between px-4 border-b">
          <Logo size="md" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {renderNavLinks(onCloseMobile)}
        {renderUserSection()}
      </aside>
    </>
  );
}
