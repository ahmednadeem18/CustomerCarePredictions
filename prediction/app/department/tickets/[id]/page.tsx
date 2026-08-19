"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type {
  Department,
  Ticket,
  TicketHistory,
} from "@/types/ticket";

import { TicketHistory as History } from "@/components/tickets/TicketHistory";
import { StatusBadge } from "@/components/tickets/StatusBadge";

export default function DepartmentTicketPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id;

  const [ticket, setTicket] =
    useState<Ticket | null>(null);

  const [history, setHistory] = useState<
    TicketHistory[]
  >([]);

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [selectedDepartment, setSelectedDepartment] =
    useState("");

  const [note, setNote] = useState("");
  const [response, setResponse] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState(false);

  useEffect(() => {
    loadTicket();
  }, [id]);

  async function loadTicket() {
    try {
      const response = await fetch(
        `/api/tickets/${id}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setTicket(data.ticket);
      setHistory(data.history);
      setDepartments(
        data.departments || []
      );
    } finally {
      setLoading(false);
    }
  }

  async function acceptTicket() {
    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/${id}/accept`,
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

  async function forwardTicket() {
    if (!selectedDepartment) {
      alert("Select a department");
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/${id}/forward`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
            to_department_id:
              Number(selectedDepartment),
            note,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      await loadTicket();

      setNote("");
      setSelectedDepartment("");
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

  async function markIrrelevant() {
    if (
      !confirm(
        "Mark this ticket as irrelevant and send it to Director?"
      )
    ) {
      return;
    }

    setActionLoading(true);

    try {
      const response = await fetch(
        `/api/tickets/${id}/irrelevant`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
            note,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      router.push("/department");
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
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
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
              <h2 className="text-lg font-semibold text-white">
                Customer
              </h2>

              <div className="mt-5 space-y-2 text-sm">
                <p className="text-zinc-300">
                  {ticket.customer_name}
                </p>

                <p className="text-zinc-500">
                  {ticket.customer_email}
                </p>

                {ticket.order_number && (
                  <p className="text-zinc-500">
                    Order #
                    {ticket.order_number}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white">
                AI Prediction
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Info
                  label="Department"
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
              <h2 className="text-lg font-semibold text-white">
                Actions
              </h2>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={acceptTicket}
                  disabled={actionLoading}
                  className="rounded-lg bg-white px-5 py-3 text-sm font-medium text-black disabled:opacity-50"
                >
                  Accept
                </button>

                <button
                  onClick={markIrrelevant}
                  disabled={actionLoading}
                  className="rounded-lg border border-red-500/40 px-5 py-3 text-sm text-red-400 disabled:opacity-50"
                >
                  Mark Irrelevant
                </button>
              </div>

              <div className="mt-6 border-t border-zinc-800 pt-6">
                <h3 className="font-medium text-white">
                  Forward Ticket
                </h3>

                <select
                  value={selectedDepartment}
                  onChange={(e) =>
                    setSelectedDepartment(
                      e.target.value
                    )
                  }
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department.id}
                        value={
                          department.id
                        }
                      >
                        {department.name}
                      </option>
                    )
                  )}
                </select>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder="Reason for forwarding..."
                  rows={3}
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
                />

                <button
                  onClick={forwardTicket}
                  disabled={actionLoading}
                  className="mt-3 rounded-lg border border-zinc-700 px-5 py-3 text-sm text-white hover:bg-zinc-800"
                >
                  Forward
                </button>
              </div>
            </section>
          </div>

          <div>
            <History history={history} />
          </div>
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