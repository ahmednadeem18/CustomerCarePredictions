import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type ForwardTicketBody = {
  user_id: number;
  to_department_id: number | null;
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
        {
          error: "Invalid ticket id",
        },
        { status: 400 }
      );
    }

    const body =
      (await request.json()) as ForwardTicketBody;

    const userId = Number(body.user_id);

    if (!Number.isInteger(userId)) {
      return NextResponse.json(
        {
          error: "Valid user_id is required",
        },
        { status: 400 }
      );
    }

    if (
      body.to_department_id !== null &&
      !Number.isInteger(
        Number(body.to_department_id)
      )
    ) {
      return NextResponse.json(
        {
          error:
            "to_department_id must be a valid department id or null",
        },
        { status: 400 }
      );
    }

    const toDepartmentId =
      body.to_department_id === null
        ? null
        : Number(body.to_department_id);

    const note =
      body.note?.trim() || null;

    await client.query("BEGIN");

    /*
     * Lock only the ticket row.
     */
    const ticketResult =
      await client.query(
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
        {
          error: "Ticket not found",
        },
        { status: 404 }
      );
    }

    const ticket =
      ticketResult.rows[0];

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

    if (ticket.status === "closed") {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          error: "Ticket is already closed",
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
     * Get user.
     */
    const userResult =
      await client.query(
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
        {
          error: "User not found",
        },
        { status: 404 }
      );
    }

    const user =
      userResult.rows[0];

    /*
     * Only the current department can forward
     * its ticket.
     *
     * Director is handled separately later.
     */
    if (user.role !== "director") {
      if (
        user.department_id !==
        ticket.current_department_id
      ) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "You cannot forward a ticket assigned to another department",
          },
          { status: 403 }
        );
      }
    }

    /*
     * If a department is supplied,
     * verify that it exists.
     *
     * null means the ticket is being sent
     * to the Director.
     */
    let destinationName = "Director";

    if (toDepartmentId !== null) {
      const departmentResult =
        await client.query(
          `
          SELECT
            id,
            name
          FROM departments
          WHERE id = $1
          `,
          [toDepartmentId]
        );

      if (
        departmentResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "Destination department not found",
          },
          { status: 404 }
        );
      }

      destinationName =
        departmentResult.rows[0].name;

      /*
       * Don't allow forwarding to
       * the same department.
       */
      if (
        toDepartmentId ===
        ticket.current_department_id
      ) {
        await client.query("ROLLBACK");

        return NextResponse.json(
          {
            error:
              "Ticket is already assigned to this department",
          },
          { status: 400 }
        );
      }
    }

    /*
     * Forward to another department.
     */
    if (toDepartmentId !== null) {
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
          toDepartmentId,
          ticketId,
        ]
      );
    }

    /*
     * Forward to Director.
     *
     * We don't have a director department
     * in the current schema, so current_department_id
     * becomes NULL.
     */
    else {
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
    }

    /*
     * Keep complete routing history.
     */
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
        'forwarded',
        $2,
        $3,
        $4,
        $5
      )
      `,
      [
        ticketId,
        ticket.current_department_id,
        toDepartmentId,
        userId,
        note ||
          `Ticket forwarded to ${destinationName}`,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      message:
        `Ticket forwarded to ${destinationName}`,
      ticket_id: ticketId,
      from_department_id:
        ticket.current_department_id,
      to_department_id:
        toDepartmentId,
      destination:
        destinationName,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Forward ticket error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to forward ticket",
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}