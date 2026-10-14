import type { Metadata } from 'next';

// page.tsx is a client component, so its title lives here.
export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to keep your RealtyAsk chats, shortlists and dossiers in one place. Chatting as a guest needs no account.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
