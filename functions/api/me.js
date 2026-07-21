import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;

  if (!token) return new Response("Unauthorized", { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    const userId = session.sub;

    // Fetch user from D1
    const { results } = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .all();

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    const user = results[0];

    // Check if profile needs completion (e.g., missing program/school)
    const needsOnboarding = !user.program || !user.school_abbr;

    return new Response(JSON.stringify({ user, needsOnboarding }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response("Invalid session", { status: 403 });
  }
}
