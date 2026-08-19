import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = Number(
      searchParams.get("user_id")
    );

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        {
          error: "Valid user_id is required",
        },
        { status: 400 }
      );
    }

    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        role
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.role !== "director") {
      return NextResponse.json(
        {
          error:
            "Only the Director can access all tickets",
        },
        { status: 403 }
      );
    }

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.customer_name,
        t.customer_email,
        t.customer_phone,
        t.order_number,
        t.question,

        t.ai_confidence,
        t.ai_model_version,

        t.status,
        t.response,

        t.created_at,
        t.updated_at,
        t.closed_at,

        ai_dept.id AS ai_department_id,
        ai_dept.name AS ai_department,

        current_dept.id AS current_department_id,
        current_dept.name AS current_department,

        final_dept.id AS final_department_id,
        final_dept.name AS final_department,

        u.id AS accepted_by_id,
        u.name AS accepted_by_name

      FROM tickets t

      LEFT JOIN departments ai_dept
        ON ai_dept.id = t.ai_department_id

      LEFT JOIN departments current_dept
        ON current_dept.id =
           t.current_department_id

      LEFT JOIN departments final_dept
        ON final_dept.id =
           t.final_department_id

      LEFT JOIN users u
        ON u.id = t.accepted_by

      ORDER BY
        t.updated_at DESC
      `
    );

    return NextResponse.json({
      success: true,
      tickets: result.rows,
    });

  } catch (error) {
    console.error(
      "Director tickets error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch director tickets",
      },
      { status: 500 }
    );
  }
}