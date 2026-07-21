export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Fetch all structural data (only approved courses/iterations to keep the tree clean)
    const { results: schools } = await env.DB.prepare(
      "SELECT id, abbr FROM schools ORDER BY abbr ASC",
    ).all();
    const { results: courses } = await env.DB.prepare(
      "SELECT id, school_id, code FROM courses WHERE status = 'approved' ORDER BY code ASC",
    ).all();
    const { results: iterations } = await env.DB.prepare(
      "SELECT id, course_id, year, sem FROM iterations WHERE status = 'approved' ORDER BY year DESC, sem ASC",
    ).all();

    // Stitch the tree together
    const tree = schools.map((school) => {
      const schoolCourses = courses.filter((c) => c.school_id === school.id);
      return {
        ...school,
        courses: schoolCourses.map((course) => ({
          ...course,
          iterations: iterations.filter((i) => i.course_id === course.id),
        })),
      };
    });

    return Response.json({ success: true, tree });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
