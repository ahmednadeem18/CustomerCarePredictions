"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Department = {
  id: number;
  name: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [departments, setDepartments] =
    useState<Department[]>([]);

  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [departmentId, setDepartmentId] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    async function loadDepartments() {
      const response =
        await fetch(
          "/api/departments"
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setDepartments(
        data.departments
      );
    }

    loadDepartments();
  }, []);

  async function register(
    event: FormEvent
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name,
              email,
              password,
              department_id:
                Number(departmentId),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Registration failed"
        );
      }

      setMessage(
        "Account created successfully. Wait for Director approval before logging in."
      );

      setName("");
      setEmail("");
      setPassword("");
      setDepartmentId("");

    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">
          Create Staff Account
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Your account must be approved by
          the Director.
        </p>

        <form
          onSubmit={register}
          className="mt-6 space-y-4"
        >
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            required
            minLength={8}
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
          />

          <select
            value={departmentId}
            onChange={(e) =>
              setDepartmentId(
                e.target.value
              )
            }
            required
            className="w-full rounded-lg border px-4 py-3 outline-none focus:border-black"
          >
            <option value="">
              Select department
            </option>

            {departments.map(
              (department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              )
            )}
          </select>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading
              ? "Creating..."
              : "Create Account"}
          </button>
        </form>

        <button
          onClick={() =>
            router.push("/login")
          }
          className="mt-5 w-full text-sm text-gray-600 hover:text-black"
        >
          Already have an account?
          {" "}Sign in
        </button>
      </div>
    </main>
  );
}