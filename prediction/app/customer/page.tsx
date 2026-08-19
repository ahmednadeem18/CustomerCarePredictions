"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] =
    useState("");
  const [question, setQuestion] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function createTicket() {
    setError("");

    if (!name || !email || !question) {
      setError(
        "Name, email and question are required."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/tickets",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer_name: name,
            customer_email: email,
            customer_phone: phone,
            order_number: orderNumber,
            question,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create ticket"
        );
      }

      router.push(
        `/customer/tickets/${data.ticket.id}`
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to create ticket"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div>
          <h1 className="text-3xl font-semibold text-white">
            Customer Support
          </h1>

          <p className="mt-2 text-zinc-400">
            How can we help you?
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Your name"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />

            <input
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email"
              type="email"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />

            <input
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
              placeholder="Phone"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />

            <input
              value={orderNumber}
              onChange={(e) =>
                setOrderNumber(e.target.value)
              }
              placeholder="Order number"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
            />
          </div>

          <textarea
            value={question}
            onChange={(e) =>
              setQuestion(e.target.value)
            }
            placeholder="Describe your issue..."
            rows={7}
            className="mt-4 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-white"
          />

          {error && (
            <p className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={createTicket}
            disabled={loading}
            className="mt-5 rounded-lg bg-white px-6 py-3 font-medium text-black disabled:opacity-50"
          >
            {loading
              ? "Creating..."
              : "Submit Ticket"}
          </button>
        </div>
      </div>
    </main>
  );
}