import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type DirectorRequestBody = {
  user_id: number;
  action: "route" | "irrelevant";
  department_id?: number;
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
      (await request.json()) as DirectorRequestBody;

    const userId = Number(body.user_id);

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        { error: "Valid user_id is required" },
        { status: 400 }
      );
    }

    if (
      body.action !== "route" &&
      body.action !== "irrelevant"
    ) {
      return NextResponse.json(
        {
          error:
            "Action must be 'route' or 'irrelevant'",
        },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const userResult = await client.query(
      `
      SELECT
        id,
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

    if (user.role !== "director") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Only the Director can make this decision",
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

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "Ticket is already closed",
        },
        { status: 400 }
      );
    }

    if (
      ticket.status !== "director_review"
    ) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "Ticket is not waiting for Director review",
        },
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

    /*
     * DIRECTOR CLOSES AS IRRELEVANT
     */

    if (body.action === "irrelevant") {
      await client.query(
        `
        UPDATE tickets
        SET
          current_department_id = NULL,
          final_department_id = NULL,
          status = 'closed',
          closed_at = NOW(),
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
          'director_closed_irrelevant',
          NULL,
          NULL,
          $2,
          $3
        )
        `,
        [
          ticketId,
          userId,
          body.note?.trim() ||
            "Director finalized the ticket as irrelevant"
        ]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        message:
          "Ticket permanently closed as irrelevant",
        ticket_id: ticketId,
        status: "closed"
      });
    }

    /*
     * DIRECTOR ROUTES TO DEPARTMENT
     */

    const departmentId = Number(
      body.department_id
    );

    if (!Number.isInteger(departmentId)) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error:
            "department_id is required when routing a ticket",
        },
        { status: 400 }
      );
    }

    const departmentResult =
      await client.query(
        `
        SELECT
          id,
          name
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
            "Target department not found",
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
        status = 'open',
        updated_at = NOW()
      WHERE id = $2
      `,
      [
        departmentId,
        ticketId
      ]
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
        NULL,
        $2,
        $3,
        $4
      )
      `,
      [
        ticketId,
        departmentId,
        userId,
        body.note?.trim() ||
          `Director routed ticket to ${department.name}`
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message:
        "Ticket routed successfully",
      ticket_id: ticketId,
      department:
        department.name,
      status: "open"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Director decision error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to process Director decision"
      },
      { status: 500 }
    );

  } finally {
    client.release();
  }
}