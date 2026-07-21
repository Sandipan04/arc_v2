import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    const iteration = await env.DB.prepare(
      `
            SELECT iterations.*, courses.code as course_code, courses.name as course_name, schools.abbr as school_abbr
            FROM iterations
            JOIN courses ON iterations.course_id = courses.id
            JOIN schools ON courses.school_id = schools.id
            WHERE iterations.id = ?
        `,
    )
      .bind(id)
      .first();

    const { results: items } = await env.DB.prepare(
      `
            SELECT items.*, users.name as uploader_name
            FROM items LEFT JOIN users ON items.uploaded_by = users.id
            WHERE items.iteration_id = ? AND items.is_deleted = 0
            ORDER BY items.created_at DESC
        `,
    )
      .bind(id)
      .all();

    return Response.json({ success: true, iteration, items });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    const { course_id, year, sem, inst } = await request.json();

    // Generate a standard ID string: e.g., "iter_course_m101_2024_odd"
    const iterId = `iter_${course_id}_${year}_${sem.toLowerCase()}`;

    await env.DB.prepare(
      "INSERT INTO iterations (id, course_id, year, sem, inst, status, created_by) VALUES (?, ?, ?, ?, ?, 'approved', ?)",
    )
      .bind(iterId, course_id, year, sem, inst, session.sub)
      .run();

    return Response.json({ success: true });
  } catch (e) {
    // Handle unique constraint failure naturally
    if (e.message.includes("UNIQUE constraint failed")) {
      return Response.json(
        { success: false, error: "This iteration already exists." },
        { status: 400 },
      );
    }
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
