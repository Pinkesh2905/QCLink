import { Logo } from '@/components/layout/logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="mb-8">
        <Logo size="lg" />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">
        © {new Date().getFullYear()} QCLink — Quality Control Management
      </p>
    </div>
  );
}
