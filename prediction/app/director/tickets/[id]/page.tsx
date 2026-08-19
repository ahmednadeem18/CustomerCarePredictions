"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import type {
  Department,
  Ticket,
  TicketHistory,
} from "@/types/ticket";

import { TicketHistory as History } from "@/components/tickets/TicketHistory";
import { StatusBadge } from "@/components/tickets/StatusBadge";

export default function DirectorTicketPage() {
  const params = useParams();

  const [ticket, setTicket] =
    useState<Ticket | null>(null);

  const [history, setHistory] = useState<
    TicketHistory[]
  >([]);

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [department, setDepartment] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  useEffect(() => {
    loadTicket();
  }, [params.id]);

  async function loadTicket() {
    const response = await fetch(
      `/api/tickets/${params.id}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    setTicket(data.ticket);
    setHistory(data.history);
    setDepartments(
      data.departments || []
    );

    setLoading(false);
  }

  async function routeTicket() {
    if (!department) {
      alert("Select department");
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/${params.id}/director-route`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
            department_id:
              Number(department),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      await loadTicket();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed"
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function closeIrrelevant() {
    if (
      !confirm(
        "Close this ticket as irrelevant?"
      )
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/${params.id}/director-close`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      await loadTicket();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed"
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (loading || !ticket) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-white">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              Ticket #{ticket.id}
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              {ticket.question}
            </h1>
          </div>

          <StatusBadge
            status={ticket.status}
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="font-semibold text-white">
                AI Prediction
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-4">
                <Info
                  label="AI Department"
                  value={
                    ticket.ai_department_name ||
                    "-"
                  }
                />

                <Info
                  label="Confidence"
                  value={
                    ticket.ai_confidence
                      ? `${(
                          Number(
                            ticket.ai_confidence
                          ) * 100
                        ).toFixed(2)}%`
                      : "-"
                  }
                />

                <Info
                  label="Model"
                  value={`v${ticket.ai_model_version}`}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="font-semibold text-white">
                Director Decision
              </h2>

              <select
                value={department}
                onChange={(e) =>
                  setDepartment(
                    e.target.value
                  )
                }
                className="mt-5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
              >
                <option value="">
                  Select final department
                </option>

                {departments.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={routeTicket}
                  disabled={actionLoading}
                  className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black"
                >
                  Final Route
                </button>

                <button
                  onClick={closeIrrelevant}
                  disabled={actionLoading}
                  className="rounded-lg border border-red-500/40 px-5 py-3 text-sm text-red-400"
                >
                  Close as Irrelevant
                </button>
              </div>
            </section>
          </div>

          <History history={history} />
        </div>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500">
        {label}
      </p>

      <p className="mt-1 text-sm text-white">
        {value}
      </p>
    </div>
  );
}