import { NextResponse } from "next/server";

const AI_URL = process.env.AI_URL!;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.question?.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${AI_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: body.question,
      }),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("AI prediction error:", error);

    return NextResponse.json(
      {
        error: "AI service unavailable",
      },
      { status: 503 }
    );
  }
}