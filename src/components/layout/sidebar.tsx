'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { isNavActive, visibleNavItems } from './nav-config';

// Desktop / tablet sidebar (md and up). On phones navigation lives in the bottom bar (see bottom-nav.tsx).
export function Sidebar() {
  const { user, logout } = useSession();
  const pathname = usePathname();

  const items = visibleNavItems(user?.Role === 'Admin');

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r bg-sidebar text-sidebar-foreground select-none">
      <div className="flex h-16 items-center px-6 border-b">
        <Logo size="md" />
      </div>

      <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors min-h-[44px]',
                active
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground active:bg-accent/80'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3.5 border-t bg-sidebar/50">
        <div className="mb-2.5 rounded-lg bg-muted/60 px-3 py-2">
          <p className="text-xs font-semibold text-foreground truncate">{user?.Name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user?.Email}</p>
          {user?.CompanyName && (
            <p className="text-[11px] font-medium text-foreground/80 truncate mt-0.5">{user.CompanyName}</p>
          )}
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
    </aside>
  );
}
