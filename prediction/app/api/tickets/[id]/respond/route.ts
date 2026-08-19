import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type RespondBody = {
  user_id: number;
  response: string;
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
      (await request.json()) as RespondBody;

    const userId = Number(body.user_id);
    const response = body.response?.trim();

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        { error: "Valid user_id is required" },
        { status: 400 }
      );
    }

    if (!response) {
      return NextResponse.json(
        { error: "Response is required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const ticketResult = await client.query(
      `
      SELECT
        id,
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

    if (!ticket.final_department_id) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket must be finalized to a department before responding",
        },
        { status: 400 }
      );
    }

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "Ticket is already closed",
        },
        { status: 400 }
      );
    }

    const userResult = await client.query(
      `
      SELECT
        id,
        name,
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
            "You cannot respond to this ticket",
        },
        { status: 403 }
      );
    }

    await client.query(
      `
      UPDATE tickets
      SET
        response = $1,
        status = 'in_progress',
        updated_at = NOW()
      WHERE id = $2
      `,
      [response, ticketId]
    );

    await client.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        action,
        from_department_id,
        to_department_id,
        performed_by,
        response,
        note
      )
      VALUES (
        $1,
        'response_sent',
        $2,
        $2,
        $3,
        $4,
        'Department response sent'
      )
      `,
      [
        ticketId,
        ticket.final_department_id,
        userId,
        response,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message: "Response saved",
      ticket_id: ticketId,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Ticket response error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to save response",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}