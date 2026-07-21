import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const schoolAbbr = url.searchParams.get("school");

    if (!schoolAbbr) {
      return Response.json(
        { error: "School abbreviation is required" },
        { status: 400 },
      );
    }

    // Fetch courses for this specific school by joining the schools table
    const { results } = await env.DB.prepare(
      `
            SELECT courses.*
            FROM courses
            JOIN schools ON courses.school_id = schools.id
            WHERE schools.abbr = ?
            ORDER BY courses.code ASC
        `,
    )
      .bind(schoolAbbr.toUpperCase())
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

    // 1. Resolve the school_id from the abbreviation
    const school = await env.DB.prepare("SELECT id FROM schools WHERE abbr = ?")
      .bind(school_abbr.toUpperCase())
      .first();
    if (!school) {
      return Response.json(
        { error: "Invalid school abbreviation." },
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
