"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  order_number: string | null;
  question: string;

  ai_department: string | null;
  ai_confidence: number | null;

  current_department: string | null;
  status: string;

  created_at: string;
  updated_at: string;
};

export default function DepartmentPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTickets() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/tickets/department",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load tickets");
      }

      const data = await response.json();

      setTickets(data.tickets ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Department Tickets
        </h1>

        <p className="mt-2 text-slate-500">
          Review tickets assigned to your department.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total"
          value={tickets.length}
        />

        <StatCard
          title="Open"
          value={
            tickets.filter(
              (ticket) =>
                ticket.status === "open"
            ).length
          }
        />

        <StatCard
          title="In Progress"
          value={
            tickets.filter(
              (ticket) =>
                ticket.status === "in_progress"
            ).length
          }
        />
      </div>

      {loading && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          Loading tickets...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        tickets.length === 0 && (
          <div className="rounded-xl border bg-white p-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">
              No tickets
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              There are currently no tickets assigned
              to your department.
            </p>
          </div>
        )}

      {!loading &&
        !error &&
        tickets.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-white">
            <div className="border-b px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                Assigned Tickets
              </h2>
            </div>

            <div className="divide-y">
              {tickets.map((ticket) => (
                <TicketRow
                  key={ticket.id}
                  ticket={ticket}
                />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function TicketRow({
  ticket,
}: {
  ticket: Ticket;
}) {
  return (
    <a
      href={`/department/tickets/${ticket.id}`}
      className="block px-6 py-5 transition hover:bg-slate-50"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-900">
              Ticket #{ticket.id}
            </span>

            <StatusBadge
              status={ticket.status}
            />
          </div>

          <p className="mt-2 font-medium text-slate-800">
            {ticket.customer_name}
          </p>

          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            {ticket.question}
          </p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>
              {ticket.customer_email}
            </span>

            {ticket.order_number && (
              <span>
                Order #{ticket.order_number}
              </span>
            )}

            {ticket.ai_confidence !== null && (
              <span>
                AI confidence:{" "}
                {(
                  ticket.ai_confidence * 100
                ).toFixed(1)}
                %
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-xs text-slate-400">
          {new Date(
            ticket.created_at
          ).toLocaleString()}
        </div>
      </div>
    </a>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    open: "bg-blue-50 text-blue-700",
    in_progress:
      "bg-amber-50 text-amber-700",
    director_review:
      "bg-purple-50 text-purple-700",
    closed:
      "bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        styles[status] ??
        "bg-slate-100 text-slate-600"
      }`}
    >
      {status
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) =>
          char.toUpperCase()
        )}
    </span>
  );
}