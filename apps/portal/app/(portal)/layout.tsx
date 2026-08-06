import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { NavBar } from '@/components/layout/NavBar';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar fullName={session.fullName} customerRef={session.customerRef} />
      <main className="flex-1 px-4 py-6 pb-24 md:pb-8 md:px-6 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
