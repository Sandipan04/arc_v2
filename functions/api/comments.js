import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathSlug = url.searchParams.get("path");

  if (!pathSlug) {
    return Response.json(
      { success: false, error: "Path slug is required" },
      { status: 400 },
    );
  }

  try {
    const { results } = await env.DB.prepare(
      `
            SELECT comments.*, users.name as user_name
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE path_slug = ?
            ORDER BY created_at DESC
        `,
    )
      .bind(pathSlug)
      .all();

    return Response.json({ success: true, comments: results });
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
    const { path_slug, content } = await request.json();

    if (!path_slug || !content.trim()) {
      return Response.json(
        { error: "Path and content are required" },
        { status: 400 },
      );
    }

    const commentId = "comment_" + crypto.randomUUID();

    await env.DB.prepare(
      "INSERT INTO comments (id, user_id, path_slug, content) VALUES (?, ?, ?, ?)",
    )
      .bind(commentId, session.sub, path_slug, content.trim())
      .run();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
