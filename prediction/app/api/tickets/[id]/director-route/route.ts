import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type DirectorRouteBody = {
  user_id: number;
  to_department_id: number;
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
      (await request.json()) as DirectorRouteBody;

    const userId = Number(body.user_id);
    const departmentId = Number(
      body.to_department_id
    );

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        { error: "Valid user_id is required" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(departmentId)) {
      return NextResponse.json(
        {
          error:
            "Valid to_department_id is required",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT id, name, role
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

    if (user.role !== "director") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Only the Director can route a ticket",
        },
        { status: 403 }
      );
    }

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

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "Ticket is already closed",
        },
        { status: 400 }
      );
    }

    const departmentResult =
      await client.query(
        `
        SELECT id, name
        FROM departments
        WHERE id = $1
        `,
        [departmentId]
      );

    if (departmentResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Destination department not found",
        },
        { status: 404 }
      );
    }

    const department =
      departmentResult.rows[0];

    await client.query(
      `
      UPDATE tickets
      SET
        current_department_id = $1,
        final_department_id = $1,
        status = 'open',
        updated_at = NOW()
      WHERE id = $2
      `,
      [departmentId, ticketId]
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
        'director_routed',
        $2,
        $3,
        $4,
        $5
      )
      `,
      [
        ticketId,
        ticket.current_department_id,
        departmentId,
        userId,
        body.note?.trim() ||
          `Director finalized ticket to ${department.name}`,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message:
        "Ticket permanently routed by Director",
      ticket_id: ticketId,
      final_department_id: departmentId,
      department: department.name,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Director route error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to route ticket",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}