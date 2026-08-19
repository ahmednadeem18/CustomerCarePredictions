import type { TicketStatus } from "@/types/ticket";

export function StatusBadge({
  status,
}: {
  status: TicketStatus;
}) {
  const styles = {
    open: "bg-blue-500/10 text-blue-400",
    in_progress:
      "bg-yellow-500/10 text-yellow-400",
    director_review:
      "bg-purple-500/10 text-purple-400",
    closed:
      "bg-green-500/10 text-green-400",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) =>
          c.toUpperCase()
        )}
    </span>
  );
}