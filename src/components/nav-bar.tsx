import Link from "next/link";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/logout/actions";

export async function NavBar() {
  const user = await getUser();

  return (
    <header className="border-b px-4 py-3">
      <nav className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="font-semibold">
          IPO PooL
        </Link>

        {user ? (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/profile/pan">My PAN cards</Link>
            <Link href="/profit-loss">Profit &amp; Loss</Link>
            <form action={logout}>
              <button type="submit" className="text-gray-500 underline">
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
