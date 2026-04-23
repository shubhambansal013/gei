/**
 * Shown when a signed-in user has no `site_user_access` rows yet.
 * SUPER_ADMIN short-circuits this screen and goes directly to
 * `/dashboard`. Everyone else needs an admin to grant access before
 * they can see any data — RLS would reject their queries anyway.
 */
export default function PendingPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-6">
      <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-lg font-semibold">Waiting for admin approval</h1>
        <p className="text-sm text-gray-600">
          Your account has been created. An administrator needs to grant you access to a site before
          you can use the application.
        </p>
      </div>
    </main>
  );
}
