'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './sidebar';
import { Header } from './header';

interface AppShellProps {
  children: React.ReactNode;
  user: {
    UserID: number;
    Name: string;
    Email: string;
    Role: 'Admin' | 'User';
  };
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close mobile menu when navigating to a new route
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  return (
    <div className="relative flex min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {/* Sidebar (Desktop persistent + Mobile Drawer) */}
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 w-full md:ml-64 transition-all">
        <Header
          onToggleMobileNav={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 w-full max-w-full min-w-0 p-3.5 sm:p-6 md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
