import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/dal";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const user = await getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex flex-1 max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="font-heading text-3xl font-semibold text-primary">IPO PooL</h1>
      <p className="text-muted-foreground">
        Track Indian IPOs and coordinate application pools with your family and friends.
      </p>
      <div className="flex gap-3">
        <Button render={<Link href="/signup">Get started</Link>} />
        <Button variant="outline" render={<Link href="/login">Log in</Link>} />
      </div>
    </main>
  );
}
