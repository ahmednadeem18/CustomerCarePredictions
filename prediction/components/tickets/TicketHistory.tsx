import type { TicketHistory } from "@/types/ticket";

type Props = {
  history: TicketHistory[];
};

export function TicketHistory({
  history,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white">
        Ticket History
      </h2>

      <div className="mt-6 space-y-6">
        {history.map((item) => (
          <div
            key={item.id}
            className="relative border-l border-zinc-700 pl-5"
          >
            <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-white" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">
                  {formatAction(item.action)}
                </p>

                {item.note && (
                  <p className="mt-1 text-sm text-zinc-400">
                    {item.note}
                  </p>
                )}

                {item.from_department_name && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {item.from_department_name}
                    {" → "}
                    {item.to_department_name}
                  </p>
                )}

                {item.performed_by_name && (
                  <p className="mt-1 text-xs text-zinc-500">
                    By {item.performed_by_name}
                  </p>
                )}
              </div>

              <time className="text-xs text-zinc-500">
                {new Date(
                  item.created_at
                ).toLocaleString()}
              </time>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAction(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}