import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type CloseTicketBody = {
  user_id: number;
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
      (await request.json()) as CloseTicketBody;

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
        status,
        response,
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
        {
          error:
            "Ticket is already closed",
        },
        { status: 400 }
      );
    }

    if (!ticket.final_department_id) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket has not been finalized",
        },
        { status: 400 }
      );
    }

    if (!ticket.response) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket must have a response before closing",
        },
        { status: 400 }
      );
    }

    const userResult = await client.query(
      `
      SELECT
        id,
        role,
        department_id
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

    if (
      user.role !== "director" &&
      user.department_id !==
        ticket.final_department_id
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "You cannot close this ticket",
        },
        { status: 403 }
      );
    }

    await client.query(
      `
      UPDATE tickets
      SET
        status = 'closed',
        updated_at = NOW(),
        closed_at = NOW()
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
        'closed',
        $2,
        $2,
        $3,
        'Ticket closed after response'
      )
      `,
      [
        ticketId,
        ticket.final_department_id,
        userId,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Ticket closed",
      ticket_id: ticketId,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Close ticket error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to close ticket",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}