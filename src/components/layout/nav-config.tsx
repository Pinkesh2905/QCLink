import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileText,
  Users,
  CreditCard,
  Shield,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// QCLink — Navigation items
// The single list behind the desktop sidebar, the mobile bottom bar and the
// mobile "More" sheet, so they always agree on what exists, who sees it and
// which one is active.
// ============================================================================

export interface NavItem {
  label: string;
  /** Shorter label for the narrow mobile bottom bar */
  shortLabel: string;
  href: string;
  icon: LucideIcon;
  /** Only Vezapp platform admins */
  adminOnly?: boolean;
  /** Only company users (hidden from platform admins) */
  userOnly?: boolean;
  /** On phones: a tab in the bottom bar, or tucked into the "More" sheet */
  mobile: 'tab' | 'more';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard, mobile: 'tab' },
  { label: 'Store Master', shortLabel: 'Store', href: '/app/store-master', icon: Package, mobile: 'tab' },
  { label: 'Employee Master', shortLabel: 'Employees', href: '/app/employee-master', icon: Users, mobile: 'more' },
  { label: 'QC Master', shortLabel: 'QC', href: '/app/qc-master', icon: ClipboardCheck, mobile: 'tab' },
  { label: 'Inspection Report', shortLabel: 'Inspections', href: '/app/inspection-report', icon: FileText, mobile: 'tab' },
  { label: 'Subscription', shortLabel: 'Subscription', href: '/app/subscription', icon: CreditCard, userOnly: true, mobile: 'more' },
  { label: 'Admin Panel', shortLabel: 'Admin', href: '/app/admin/companies', icon: Shield, adminOnly: true, mobile: 'more' },
];

/** The items this user may see, in menu order. */
export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => (!item.adminOnly || isAdmin) && (!item.userOnly || !isAdmin));
}

/** Whether `href` is the section the current page belongs to (a detail page counts for its list). */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/app/dashboard') return pathname === href;
  if (href.startsWith('/app/admin')) return pathname.startsWith('/app/admin');
  return pathname.startsWith(href);
}
