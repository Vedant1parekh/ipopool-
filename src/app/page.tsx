import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/dal";

export default async function Home() {
  const user = await getUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex flex-1 max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-3xl font-semibold">IPO PooL</h1>
      <p className="text-gray-600">
        Track Indian IPOs and coordinate application pools with your family and friends.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className="rounded-md bg-black px-4 py-2 text-white">
          Get started
        </Link>
        <Link href="/login" className="rounded-md border px-4 py-2">
          Log in
        </Link>
      </div>
    </main>
  );
}
