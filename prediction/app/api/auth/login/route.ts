import { NextResponse } from "next/server";

import {
  createSession,
  verifyPassword,
} from "@/lib/auth";

import { pool } from "@/lib/db";

type LoginBody = {
  email: string;
  password: string;
};

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as LoginBody;

    const email =
      body.email?.trim().toLowerCase();

    const password =
      body.password;

    if (!email || !password) {
      return NextResponse.json(
        {
          error:
            "Email and password are required",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash,
        role,
        status,
        department_id
      FROM users
      WHERE LOWER(email) = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password",
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    if (user.status !== "approved") {
      return NextResponse.json(
        {
          error:
            user.status === "pending"
              ? "Your account is waiting for Director approval."
              : "Your account is not active.",
        },
        { status: 403 }
      );
    }

    const valid =
      await verifyPassword(
        user.password_hash,
        password
      );

    if (!valid) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password",
        },
        { status: 401 }
      );
    }

    await createSession(
      user.id
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id:
          user.department_id,
      },
    });

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        error: "Login failed",
      },
      { status: 500 }
    );
  }
}