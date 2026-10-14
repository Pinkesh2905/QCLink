'use client';

import { Sidebar } from './sidebar';
import { Header } from './header';
import { BottomNav } from './bottom-nav';
import { SubscriptionBanner } from './subscription-banner';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative flex min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {/* Desktop / tablet: persistent sidebar. Phones: bottom navigation bar. */}
      <Sidebar />
      <BottomNav />

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col min-w-0 w-full md:ml-64 transition-all min-h-screen">
        <Header />
        <SubscriptionBanner />
        {/* On phones, leave room under the content for the fixed bottom bar (4rem) plus breathing space */}
        <main className="relative z-10 flex-1 w-full max-w-full min-w-0 p-3.5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
