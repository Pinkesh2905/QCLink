'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis, LogOut, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { isNavActive, visibleNavItems } from './nav-config';

// Fields where the on-screen keyboard opens. While one is focused the bar steps out of the way, so it
// does not sit above the keyboard and squeeze the form.
const TEXT_ENTRY = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=file]):not([type=range]), textarea, [contenteditable=""], [contenteditable="true"]';

/**
 * Phone navigation: a fixed bar at the bottom with the main apps, plus a "More" tab holding the
 * rest and the account. Shown below the `md` breakpoint only; larger screens use the sidebar.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  // The sheet remembers which page it was opened on, so it closes by itself the moment the page changes
  const [moreOpenAt, setMoreOpenAt] = useState<string | null>(null);
  const moreOpen = moreOpenAt === pathname;
  const setMoreOpen = (open: boolean) => setMoreOpenAt(open ? pathname : null);
  const [typing, setTyping] = useState(false);

  const isAdmin = user?.Role === 'Admin';
  const items = visibleNavItems(isAdmin);
  const tabs = items.filter((i) => i.mobile === 'tab');
  const moreItems = items.filter((i) => i.mobile === 'more');
  const moreActive = moreItems.some((i) => isNavActive(pathname, i.href));

  // Hide the bar while the keyboard is up
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Element && e.target.matches(TEXT_ENTRY)) setTyping(true);
    };
    const onFocusOut = () => setTyping(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const tabClass = (active: boolean) =>
    cn(
      'group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium outline-none transition-colors',
      active ? 'text-foreground' : 'text-muted-foreground active:text-foreground'
    );

  // The icon sits in a pill that fills in for the active tab
  const pillClass = (active: boolean) =>
    cn(
      'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200',
      active
        ? 'bg-primary text-primary-foreground shadow-xs'
        : 'group-active:bg-accent group-focus-visible:ring-2 group-focus-visible:ring-ring/50'
    );

  return (
    <>
      <nav
        aria-label="Main navigation"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden',
          'pb-[env(safe-area-inset-bottom,0px)] transition-transform duration-200',
          typing && 'translate-y-full'
        )}
      >
        <ul className="mx-auto flex h-16 max-w-xl items-stretch px-1">
          {tabs.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={tabClass(active)}
                >
                  <span className={pillClass(active)}>
                    <Icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.9} />
                  </span>
                  <span className="max-w-full truncate leading-none">{item.shortLabel}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="More"
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={tabClass(moreActive || moreOpen)}
            >
              <span className={pillClass(moreActive || moreOpen)}>
                <Ellipsis className="size-[22px]" strokeWidth={moreActive || moreOpen ? 2.25 : 1.9} />
              </span>
              <span className="max-w-full truncate leading-none">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
        >
          {/* grab handle */}
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" aria-hidden="true" />

          <div className="flex items-center gap-3 px-5 pb-4 pt-4">
            {user && (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary ring-1 ring-border">
                {user.Name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <SheetTitle className="truncate text-base leading-tight">{user?.Name ?? 'Account'}</SheetTitle>
              <SheetDescription className="truncate text-xs">{user?.Email}</SheetDescription>
              {(user?.CompanyName || user?.Role) && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {user?.CompanyName ? `${user.CompanyName} · ${user.Role}` : user?.Role}
                </p>
              )}
            </div>
          </div>

          {moreItems.length > 0 && (
            <ul className="border-t px-2 py-2">
              {moreItems.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors active:bg-accent',
                        active ? 'bg-accent text-foreground' : 'text-foreground/90 hover:bg-accent/60'
                      )}
                    >
                      <Icon className="size-5 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="size-4 text-muted-foreground/60" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t p-3">
            <Button variant="outline" className="h-11 w-full justify-center gap-2 rounded-xl text-sm" onClick={logout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
