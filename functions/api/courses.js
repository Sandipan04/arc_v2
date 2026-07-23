import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const schoolParam = url.searchParams.get("school");

    if (!schoolParam) {
      return Response.json(
        { error: "School parameter is required" },
        { status: 400 },
      );
    }

    // Fetch courses by matching either the abbreviation or the ID
    const { results } = await env.DB.prepare(
      `
            SELECT courses.*
            FROM courses
            JOIN schools ON courses.school_id = schools.id
            WHERE schools.abbr = ? OR schools.id = ?
            ORDER BY courses.code ASC
        `,
    )
      .bind(schoolParam.toUpperCase(), schoolParam.toLowerCase())
      .all();

    return Response.json({ success: true, courses: results });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
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
    const { school_abbr, code, name } = await request.json();

    if (!school_abbr || !code || !name) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    // 1. Resolve the school_id by matching either the abbreviation or the ID
    const school = await env.DB.prepare("SELECT id FROM schools WHERE abbr = ? OR id = ?")
      .bind(school_abbr.toUpperCase(), school_abbr.toLowerCase())
      .first();

    if (!school) {
      return Response.json(
        { error: "Invalid school abbreviation or ID." },
        { status: 400 },
      );
    }

    // 2. Generate standard ID: "course_sms_m201"
    const cleanCode = code.replace(/\s+/g, "").toLowerCase();
    const courseId = `course_${school.id}_${cleanCode}`;

    // 3. Insert into database (defaults to 'pending' status)
    await env.DB.prepare(
      `
            INSERT INTO courses (id, school_id, code, name, status, created_by)
            VALUES (?, ?, ?, ?, 'pending', ?)
        `,
    )
      .bind(
        courseId,
        school.id,
        code.toUpperCase().trim(),
        name.trim(),
        session.sub,
      )
      .run();

    return Response.json({
      success: true,
      message: "Course added successfully.",
    });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return Response.json(
        { error: "This course code already exists." },
        { status: 400 },
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
