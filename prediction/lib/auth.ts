import { cookies } from "next/headers";
import crypto from "crypto";
import argon2 from "argon2";

import { pool } from "@/lib/db";

const SESSION_COOKIE = "customer_support_session";

const SESSION_DURATION = 1000 * 60 * 60 * 24 * 7;

export async function hashPassword(
  password: string
) {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

export async function verifyPassword(
  hash: string,
  password: string
) {
  return argon2.verify(hash, password);
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createSession(
  userId: number
) {
  const token = createToken();

  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DURATION
  );

  await pool.query(
    `
    INSERT INTO sessions (
      user_id,
      token_hash,
      expires_at
    )
    VALUES ($1, $2, $3)
    `,
    [
      userId,
      tokenHash,
      expiresAt,
    ]
  );

  const cookieStore = await cookies();

  cookieStore.set(
    SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    }
  );
}

export async function getCurrentUser() {
  const cookieStore = await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE
    )?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.department_id,
      d.name AS department_name

    FROM sessions s

    JOIN users u
      ON u.id = s.user_id

    LEFT JOIN departments d
      ON d.id = u.department_id

    WHERE s.token_hash = $1
      AND s.expires_at > NOW()
    `,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];

  if (user.status !== "approved") {
    return null;
  }

  return user;
}

export async function logout() {
  const cookieStore = await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE
    )?.value;

  if (token) {
    const tokenHash =
      hashToken(token);

    await pool.query(
      `
      DELETE FROM sessions
      WHERE token_hash = $1
      `,
      [tokenHash]
    );
  }

  cookieStore.delete(
    SESSION_COOKIE
  );
}