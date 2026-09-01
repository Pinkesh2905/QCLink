import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to QCLink quality control management system',
};

export default function LoginPage() {
  return <LoginForm />;
}
