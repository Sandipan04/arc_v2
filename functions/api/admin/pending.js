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

    // 1. Security Check: Is the caller an Admin or Moderator?
    const caller = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.sub)
      .first();
    if (!caller || caller.role === "student") {
      return Response.json(
        { error: "Forbidden. Insufficient permissions." },
        { status: 403 },
      );
    }

    // 2. Fetch Pending Users (Removed created_at)
    const { results: pendingUsers } = await env.DB.prepare(
      `
                SELECT id, name, email
                FROM users
                WHERE status = 'pending'
            `,
    ).all();

    // 3. Fetch Pending Courses (Removed created_at)
    const { results: pendingCourses } = await env.DB.prepare(
      `
                SELECT courses.id, courses.code, courses.name, schools.abbr as school_abbr
                FROM courses
                JOIN schools ON courses.school_id = schools.id
                WHERE courses.status = 'pending'
            `,
    ).all();

    return Response.json({
      success: true,
      users: pendingUsers,
      courses: pendingCourses,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
