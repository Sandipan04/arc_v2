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
    const formData = await request.formData();

    const file = formData.get("file");
    const title = formData.get("title");
    const description = formData.get("description");
    const iterationId = formData.get("iteration_id");
    const fileHash = formData.get("file_hash");

    if (!file || !title || !iterationId || !fileHash) {
      return Response.json(
        { error: "Missing required fields." },
        { status: 400 },
      );
    }

    // Generate a unique identifier for the R2 storage key
    const r2Key = crypto.randomUUID() + "_" + file.name.replace(/\s+/g, "_");

    // 1. Upload the file to Cloudflare R2
    await env.BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    // 2. Insert metadata into D1 Database
    const fileId = "item_" + crypto.randomUUID();
    await env.DB.prepare(
      `
            INSERT INTO items (id, iteration_id, name, description, r2_key, file_hash, status, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
        `,
    )
      .bind(
        fileId,
        iterationId,
        title,
        description,
        r2Key,
        fileHash,
        session.sub,
      )
      .run();

    return Response.json({
      success: true,
      message: "File uploaded successfully.",
    });
  } catch (error) {
    // Handle SQLite Unique Constraint error for duplicate file hashes
    if (error.message.includes("UNIQUE constraint failed")) {
      return Response.json(
        {
          error: "This exact file has already been uploaded to this iteration.",
        },
        { status: 400 },
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}
