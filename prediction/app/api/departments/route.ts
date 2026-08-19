import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result =
      await pool.query(
        `
        SELECT
          id,
          name
        FROM departments
        ORDER BY name
        `
      );

    return NextResponse.json({
      departments:
        result.rows,
    });

  } catch (error) {
    console.error(
      "Departments error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load departments",
      },
      { status: 500 }
    );
  }
}