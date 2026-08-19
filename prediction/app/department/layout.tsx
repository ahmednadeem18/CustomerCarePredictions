import Link from "next/link";

export default function DepartmentLayout({
    
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            href="/department"
            className="text-xl font-bold text-slate-900"
          >
            Customer Care
          </Link>

          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/department"
              className="text-slate-600 transition hover:text-slate-900"
            >
              Tickets
            </Link>

            <Link
              href="/api/auth/logout"
              className="text-slate-600 transition hover:text-red-600"
            >
              Logout
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}