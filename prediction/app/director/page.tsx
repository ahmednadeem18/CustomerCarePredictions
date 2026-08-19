"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { Ticket } from "@/types/ticket";
import { StatusBadge } from "@/components/tickets/StatusBadge";

export default function DirectorDashboard() {
  const [tickets, setTickets] = useState<
    Ticket[]
  >([]);

  const [filter, setFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const response = await fetch(
        "/api/tickets/director",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      setTickets(data.tickets || []);
    } finally {
      setLoading(false);
    }
  }

  const filteredTickets =
    filter === "all"
      ? tickets
      : tickets.filter(
          (ticket) =>
            ticket.status === filter
        );

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Director Dashboard
          </h1>

          <p className="mt-2 text-zinc-400">
            Manage and finalize all customer tickets.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {[
            "all",
            "open",
            "in_progress",
            "director_review",
            "closed",
          ].map((status) => (
            <button
              key={status}
              onClick={() =>
                setFilter(status)
              }
              className={`rounded-lg px-4 py-2 text-sm ${
                filter === status
                  ? "bg-white text-black"
                  : "border border-zinc-700 text-zinc-300"
              }`}
            >
              {status === "all"
                ? "All"
                : status
                    .replaceAll("_", " ")
                    .replace(
                      /\b\w/g,
                      (c) =>
                        c.toUpperCase()
                    )}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {loading ? (
            <p className="text-zinc-500">
              Loading...
            </p>
          ) : (
            filteredTickets.map(
              (ticket) => (
                <Link
                  key={ticket.id}
                  href={`/director/tickets/${ticket.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600"
                >
                  <div className="flex justify-between gap-5">
                    <div>
                      <p className="text-xs text-zinc-500">
                        #{ticket.id}
                      </p>

                      <h2 className="mt-2 text-white">
                        {ticket.question}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-500">
                        {ticket.customer_name}
                      </p>
                    </div>

                    <StatusBadge
                      status={
                        ticket.status
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-5 text-xs text-zinc-500">
                    <span>
                      AI:{" "}
                      {
                        ticket.ai_department_name
                      }
                    </span>

                    <span>
                      Current:{" "}
                      {
                        ticket.current_department_name
                      }
                    </span>

                    {ticket.final_department_name && (
                      <span>
                        Final:{" "}
                        {
                          ticket.final_department_name
                        }
                      </span>
                    )}
                  </div>
                </Link>
              )
            )
          )}
        </div>
      </div>
    </main>
  );
}