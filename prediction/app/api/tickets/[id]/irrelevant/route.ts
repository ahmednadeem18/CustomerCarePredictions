import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type IrrelevantTicketBody = {
  user_id: number;
  note?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();

  try {
    const { id } = await params;
    const ticketId = Number(id);

    if (!Number.isInteger(ticketId)) {
      return NextResponse.json(
        { error: "Invalid ticket id" },
        { status: 400 }
      );
    }

    const body =
      (await request.json()) as IrrelevantTicketBody;

    const userId = Number(body.user_id);

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        { error: "Valid user_id is required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const ticketResult = await client.query(
      `
      SELECT
        id,
        question,
        status,
        current_department_id,
        final_department_id
      FROM tickets
      WHERE id = $1
      FOR UPDATE
      `,
      [ticketId]
    );

    if (ticketResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    const ticket = ticketResult.rows[0];

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "Ticket is already closed" },
        { status: 400 }
      );
    }

    if (ticket.final_department_id) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket has already been finalized",
        },
        { status: 400 }
      );
    }

    if (!ticket.current_department_id) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket has no current department",
        },
        { status: 400 }
      );
    }

    const userResult = await client.query(
      `
      SELECT
        id,
        department_id,
        role
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (user.role !== "department") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Only department members can mark tickets irrelevant",
        },
        { status: 403 }
      );
    }

    if (
      user.department_id !==
      ticket.current_department_id
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "You can only mark tickets irrelevant from your own department",
        },
        { status: 403 }
      );
    }

    const departmentResult =
      await client.query(
        `
        SELECT name
        FROM departments
        WHERE id = $1
        `,
        [ticket.current_department_id]
      );

    if (departmentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "Department not found",
        },
        { status: 400 }
      );
    }

    const department =
      departmentResult.rows[0];

    await client.query(
      `
      UPDATE tickets
      SET
        current_department_id = NULL,
        status = 'director_review',
        updated_at = NOW()
      WHERE id = $1
      `,
      [ticketId]
    );

    await client.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        action,
        from_department_id,
        to_department_id,
        performed_by,
        note
      )
      VALUES (
        $1,
        'marked_irrelevant',
        $2,
        NULL,
        $3,
        $4
      )
      `,
      [
        ticketId,
        ticket.current_department_id,
        userId,
        body.note?.trim() ||
          `Marked irrelevant by ${department.name} and sent to Director for review`
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message:
        "Ticket sent to Director for review",
      ticket_id: ticketId,
      status: "director_review"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Mark irrelevant error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to mark ticket irrelevant"
      },
      { status: 500 }
    );

  } finally {
    client.release();
  }
}