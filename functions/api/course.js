export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const courseId = url.searchParams.get("id");

    if (!courseId) {
      return Response.json(
        { success: false, error: "Course ID is required" },
        { status: 400 },
      );
    }

    // 1. Fetch Course Details and join with Schools to get the abbreviation
    const course = await env.DB.prepare(
      `
            SELECT courses.*, schools.abbr as school_abbr
            FROM courses
            JOIN schools ON courses.school_id = schools.id
            WHERE courses.id = ?
        `,
    )
      .bind(courseId)
      .first();

    if (!course) {
      return Response.json(
        { success: false, error: "Course not found" },
        { status: 404 },
      );
    }

    // 2. Fetch all Iterations for this course
    const { results: iterations } = await env.DB.prepare(
      `
            SELECT * FROM iterations
            WHERE course_id = ?
            ORDER BY year DESC, sem ASC
        `,
    )
      .bind(courseId)
      .all();

    // 3. Fetch all active Items (files) for these iterations and join the Uploader's name
    const { results: items } = await env.DB.prepare(
      `
            SELECT items.*, users.name as uploader_name
            FROM items
            LEFT JOIN users ON items.uploaded_by = users.id
            WHERE items.iteration_id IN (SELECT id FROM iterations WHERE course_id = ?)
            AND items.is_deleted = 0
            ORDER BY items.created_at DESC
        `,
    )
      .bind(courseId)
      .all();

    // 4. Map the items into their respective iterations
    const formattedIterations = iterations.map((it) => ({
      ...it,
      items: items.filter((item) => item.iteration_id === it.id),
    }));

    return Response.json({
      success: true,
      course: course,
      iterations: formattedIterations,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
