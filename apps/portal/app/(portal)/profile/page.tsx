import { Suspense } from 'react';
import { getSession } from '@/lib/session';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ProfileForm } from './ProfileForm';
import { ChangePasswordForm } from './ChangePasswordForm';

export const metadata = { title: 'Profile — Vida Partners Portal' };

async function ProfileContent() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-gray-900">Profile</h1>

      <section aria-labelledby="contact-heading">
        <div className="card">
          <h2 id="contact-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Contact Details
          </h2>
          <ProfileForm
            initialName={session.fullName}
            email={session.email}
            customerRef={session.customerRef}
          />
        </div>
      </section>

      <section aria-labelledby="password-heading">
        <div className="card">
          <h2 id="password-heading" className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            Change Password
          </h2>
          <ChangePasswordForm />
        </div>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="space-y-5"><CardSkeleton /><CardSkeleton /></div>}>
      <ProfileContent />
    </Suspense>
  );
}
