import Link from "next/link";
import { getUser } from "@/lib/dal";
import { logout } from "@/app/logout/actions";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pools", label: "Pools" },
  { href: "/allotments", label: "Allotments" },
  { href: "/profile/pan", label: "My PAN cards" },
  { href: "/profit-loss", label: "Profit & Loss" },
];

export async function NavBar() {
  const user = await getUser();

  return (
    <header className="border-b bg-card/60 px-4 py-3 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between">
        <Link href={user ? "/dashboard" : "/"} className="font-heading text-base font-semibold text-primary">
          IPO PooL
        </Link>

        {user ? (
          <div className="flex items-center gap-1 text-sm">
            <div className="hidden items-center gap-1 sm:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm" className="ml-1">
                Log out
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="px-2.5 py-1.5 text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Button size="sm" render={<Link href="/signup">Sign up</Link>} />
          </div>
        )}
      </nav>
    </header>
  );
}
