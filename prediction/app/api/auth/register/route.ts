import { NextResponse } from "next/server";

import {
  hashPassword,
} from "@/lib/auth";

import { pool } from "@/lib/db";

type RegisterBody = {
  name: string;
  email: string;
  password: string;
  department_id: number;
};

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as RegisterBody;

    const name =
      body.name?.trim();

    const email =
      body.email?.trim().toLowerCase();

    const password =
      body.password;

    const departmentId =
      Number(body.department_id);

    if (
      !name ||
      !email ||
      !password ||
      !Number.isInteger(
        departmentId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "All fields are required",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least 8 characters",
        },
        { status: 400 }
      );
    }

    const department =
      await pool.query(
        `
        SELECT id
        FROM departments
        WHERE id = $1
        `,
        [departmentId]
      );

    if (
      department.rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Department does not exist",
        },
        { status: 400 }
      );
    }

    const existing =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = $1
        `,
        [email]
      );

    if (
      existing.rows.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            "An account with this email already exists",
        },
        { status: 409 }
      );
    }

    const passwordHash =
      await hashPassword(
        password
      );

    const result =
      await pool.query(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          department_id,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          'department',
          $4,
          'pending'
        )
        RETURNING
          id,
          name,
          email,
          role,
          status,
          department_id
        `,
        [
          name,
          email,
          passwordHash,
          departmentId,
        ]
      );

    return NextResponse.json(
      {
        success: true,
        message:
          "Account created. Waiting for Director approval.",
        user: result.rows[0],
      },
      { status: 201 }
    );

  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Registration failed",
      },
      { status: 500 }
    );
  }
}