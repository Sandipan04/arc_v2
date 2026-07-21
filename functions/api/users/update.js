import { verifyToken } from "@clerk/backend";

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;

  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    const userId = session.sub;

    const data = await request.json();

    // Ensure variables are strictly null if missing to prevent D1 bind errors
    const name = data.username || "Unknown";
    const program = data.program || null;
    const school = data.school || null;
    const batch = data.batch ? parseInt(data.batch) : null;
    const about = data.about || null;

    await env.DB.prepare(
      `
            UPDATE users
            SET name = ?, program = ?, school_abbr = ?, batch = ?, about = ?
            WHERE id = ?
        `,
    )
      .bind(name, program, school, batch, about, userId)
      .run();

    return Response.json({ success: true });
  } catch (error) {
    // Return the exact error message to the frontend for debugging
    return Response.json({ error: error.message }, { status: 400 });
  }
}
