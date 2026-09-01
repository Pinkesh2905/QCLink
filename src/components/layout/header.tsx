'use client';

import { usePathname } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

const titleMap: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/store-master': 'Store Master',
  '/app/qc-master': 'QC Master',
  '/app/inspection-report': 'Inspection Reports',
  '/app/admin/approvals': 'User Approvals',
  '/app/admin/users': 'User Directory',
  '/app/admin/master-data': 'Master Data Manager',
  '/app/admin/audit-log': 'Audit Log',
};

function getPageTitle(pathname: string): string {
  if (titleMap[pathname]) return titleMap[pathname];

  if (pathname.endsWith('/new')) {
    const base = pathname.replace('/new', '');
    const baseTitle = titleMap[base];
    if (baseTitle) return `New ${baseTitle.replace(/s$/, '')}`;
  }

  for (const [path, title] of Object.entries(titleMap)) {
    if (pathname.startsWith(path + '/')) return `${title} — Detail`;
  }

  return 'QCLink';
}

interface HeaderProps {
  onToggleMobileNav?: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useSession();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b bg-background/95 px-3.5 sm:px-6 md:px-8 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left: Mobile Hamburger + Logo + Title */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 max-w-[80%] sm:max-w-[75%]">
        {/* Mobile Hamburger Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9 shrink-0 -ml-1 text-muted-foreground hover:text-foreground"
          onClick={onToggleMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Branding (Logo icon + text on small screens) */}
        <div className="md:hidden flex items-center shrink-0">
          <Logo size="sm" showText={false} />
        </div>

        <div className="hidden sm:block md:hidden h-4 w-px bg-border shrink-0" />

        {/* Page Title */}
        <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate text-foreground leading-none">
          {title}
        </h1>
      </div>

      {/* Right: User Avatar & Role */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden sm:flex flex-col items-end text-right">
          <span className="text-xs font-medium text-foreground truncate max-w-[130px]">
            {user?.Name}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {user?.Role}
          </span>
        </div>
        {user && (
          <div
            title={`${user.Name} (${user.Role})`}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-border shadow-2xs"
          >
            {user.Name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
