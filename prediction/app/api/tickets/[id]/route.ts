import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ticketId = Number(id);

    if (!Number.isInteger(ticketId)) {
      return NextResponse.json(
        { error: "Invalid ticket id" },
        { status: 400 }
      );
    }

    const ticketResult = await pool.query(
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

        accepted_user.id AS accepted_by_id,
        accepted_user.name AS accepted_by_name

      FROM tickets t

      LEFT JOIN departments ai_dept
        ON ai_dept.id = t.ai_department_id

      LEFT JOIN departments current_dept
        ON current_dept.id =
           t.current_department_id

      LEFT JOIN departments final_dept
        ON final_dept.id =
           t.final_department_id

      LEFT JOIN users accepted_user
        ON accepted_user.id =
           t.accepted_by

      WHERE t.id = $1
      `,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: "Ticket not found",
        },
        { status: 404 }
      );
    }

    const historyResult =
      await pool.query(
        `
        SELECT
          h.id,
          h.action,

          h.from_department_id,
          from_dept.name AS from_department,

          h.to_department_id,
          to_dept.name AS to_department,

          h.performed_by,

          u.name AS performed_by_name,
          u.role AS performed_by_role,

          h.response,
          h.note,
          h.created_at

        FROM ticket_history h

        LEFT JOIN departments from_dept
          ON from_dept.id =
             h.from_department_id

        LEFT JOIN departments to_dept
          ON to_dept.id =
             h.to_department_id

        LEFT JOIN users u
          ON u.id = h.performed_by

        WHERE h.ticket_id = $1

        ORDER BY
          h.created_at ASC,
          h.id ASC
        `,
        [ticketId]
      );

    return NextResponse.json({
      success: true,

      ticket: ticketResult.rows[0],

      history: historyResult.rows,
    });

  } catch (error) {
    console.error(
      "Ticket detail error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to fetch ticket",
      },
      { status: 500 }
    );
  }
}