export async function onRequestGet(context) {
  try {
    const { env } = context;

    // Fetch all schools ordered by abbreviation
    const { results } = await env.DB.prepare(
      "SELECT * FROM schools ORDER BY abbr ASC",
    ).all();

    return Response.json({ success: true, schools: results });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
