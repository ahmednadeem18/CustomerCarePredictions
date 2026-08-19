import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

const AI_URL = process.env.AI_URL!;

type AIPrediction = {
  department: string;
  confidence: number;
  confidence_percent: number;
  model_version: number;
};

type CreateTicketBody = {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  order_number?: string;
  question: string;
};

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body =
      (await request.json()) as CreateTicketBody;

    const {
      customer_name,
      customer_email,
      customer_phone,
      order_number,
      question,
    } = body;

    if (
      !customer_name?.trim() ||
      !customer_email?.trim() ||
      !question?.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "customer_name, customer_email and question are required",
        },
        { status: 400 }
      );
    }

    const aiResponse = await fetch(
      `${AI_URL}/predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
        }),
        cache: "no-store",
      }
    );

    if (!aiResponse.ok) {
      const error = await aiResponse.text();

      console.error(
        "AI service error:",
        error
      );

      return NextResponse.json(
        {
          error: "AI prediction failed",
        },
        { status: 503 }
      );
    }

    const ai =
      (await aiResponse.json()) as AIPrediction;

    await client.query("BEGIN");

    const departmentResult =
      await client.query(
        `
        SELECT id
        FROM departments
        WHERE name = $1
        `,
        [ai.department]
      );

    if (departmentResult.rows.length === 0) {
      throw new Error(
        `AI predicted unknown department: ${ai.department}`
      );
    }

    const departmentId =
      departmentResult.rows[0].id;

    const ticketResult =
      await client.query(
        `
        INSERT INTO tickets (
          customer_name,
          customer_email,
          customer_phone,
          order_number,
          question,
          ai_department_id,
          ai_confidence,
          ai_model_version,
          current_department_id,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          'open'
        )
        RETURNING *
        `,
        [
          customer_name.trim(),
          customer_email.trim(),
          customer_phone?.trim() || null,
          order_number?.trim() || null,
          question.trim(),
          departmentId,
          ai.confidence,
          ai.model_version,
          departmentId,
        ]
      );

    const ticket =
      ticketResult.rows[0];

    await client.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        action,
        to_department_id,
        note
      )
      VALUES (
        $1,
        'created',
        $2,
        $3
      )
      `,
      [
        ticket.id,
        departmentId,
        "Ticket created by customer",
      ]
    );

    await client.query(
      `
      INSERT INTO ticket_history (
        ticket_id,
        action,
        to_department_id,
        note
      )
      VALUES (
        $1,
        'ai_predicted',
        $2,
        $3
      )
      `,
      [
        ticket.id,
        departmentId,
        `AI predicted ${ai.department} with ${(ai.confidence * 100).toFixed(2)}% confidence using model v${ai.model_version}`,
      ]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: ticket.id,
          customer_name:
            ticket.customer_name,
          question: ticket.question,
          department: ai.department,
          confidence:
            ai.confidence,
          confidence_percent:
            ai.confidence_percent,
          model_version:
            ai.model_version,
          status: ticket.status,
        },
      },
      { status: 201 }
    );

  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "Create ticket error:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create ticket",
      },
      { status: 500 }
    );

  } finally {

    client.release();
  }
}