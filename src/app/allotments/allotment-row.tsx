import { setAllotmentStatus } from "./actions";

export function AllotmentActionButtons({ applicationId }: { applicationId: string }) {
  return (
    <div className="flex gap-1.5">
      <form action={setAllotmentStatus.bind(null, applicationId, "alloted")}>
        <button
          type="submit"
          className="rounded-md border border-input px-2 py-1 text-xs text-success hover:bg-success/10"
        >
          Alloted
        </button>
      </form>
      <form action={setAllotmentStatus.bind(null, applicationId, "not_alloted")}>
        <button
          type="submit"
          className="rounded-md border border-input px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          Not Alloted
        </button>
      </form>
    </div>
  );
}
