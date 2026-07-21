import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;

  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });

    const caller = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.sub)
      .first();
    if (!caller || caller.role === "student") {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const { results: users } = await env.DB.prepare(
      `
            SELECT id, name, email, role, status, created_at
            FROM users
            ORDER BY created_at DESC
        `,
    ).all();

    return Response.json({ success: true, users });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
