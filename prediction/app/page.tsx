"use client";

import { FormEvent, useState } from "react";

type TicketResponse = {
  success: boolean;
  ticket: {
    id: number;
    customer_name: string;
    question: string;
    department: string;
    confidence: number;
    confidence_percent: number;
    model_version: number;
    status: string;
  };
};

export default function HomePage() {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    order_number: "",
    question: "",
  });

  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] =
    useState<TicketResponse["ticket"] | null>(null);
  const [error, setError] = useState("");

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function submitTicket(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setTicket(null);

    try {
      const response = await fetch(
        "/api/tickets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create ticket"
        );
      }

      setTicket(data.ticket);

      setForm({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        order_number: "",
        question: "",
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Customer Support
          </h1>

          <p className="mt-2 text-gray-600">
            Tell us about your issue and our
            support team will handle it.
          </p>
        </div>

        <form
          onSubmit={submitTicket}
          className="rounded-xl border bg-white p-6 shadow-sm"
        >
          <div className="grid gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Name
              </label>

              <input
                value={form.customer_name}
                onChange={(e) =>
                  updateField(
                    "customer_name",
                    e.target.value
                  )
                }
                required
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                placeholder="Ahmed Nadeem"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Email
              </label>

              <input
                type="email"
                value={form.customer_email}
                onChange={(e) =>
                  updateField(
                    "customer_email",
                    e.target.value
                  )
                }
                required
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                placeholder="ahmed@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Phone
              </label>

              <input
                value={form.customer_phone}
                onChange={(e) =>
                  updateField(
                    "customer_phone",
                    e.target.value
                  )
                }
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                placeholder="+92..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Order Number
              </label>

              <input
                value={form.order_number}
                onChange={(e) =>
                  updateField(
                    "order_number",
                    e.target.value
                  )
                }
                className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
                placeholder="#4521"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                How can we help?
              </label>

              <textarea
                value={form.question}
                onChange={(e) =>
                  updateField(
                    "question",
                    e.target.value
                  )
                }
                required
                rows={6}
                className="w-full resize-none rounded-lg border px-4 py-3 outline-none focus:border-black"
                placeholder="Describe your issue..."
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Creating ticket..."
                : "Submit Ticket"}
            </button>
          </div>
        </form>

        {ticket && (
          <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
            <div className="mb-4">
              <p className="text-sm text-green-600">
                Ticket created successfully
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Ticket #{ticket.id}
              </h2>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Department
                </span>

                <span className="font-medium">
                  {ticket.department}
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  AI Confidence
                </span>

                <span className="font-medium">
                  {ticket.confidence_percent}%
                </span>
              </div>

              <div className="flex justify-between border-b pb-3">
                <span className="text-gray-500">
                  Model
                </span>

                <span className="font-medium">
                  v{ticket.model_version}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">
                  Status
                </span>

                <span className="font-medium capitalize">
                  {ticket.status.replace(
                    "_",
                    " "
                  )}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              Your ticket has been automatically
              routed to the appropriate department.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}