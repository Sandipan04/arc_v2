export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const action = url.searchParams.get("action") || "view"; // defaults to view

  if (!id) {
    return new Response("Missing file ID", { status: 400 });
  }

  try {
    // 1. Fetch file metadata from D1
    const item = await env.DB.prepare(
      "SELECT name, r2_key FROM items WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!item) {
      return new Response("File not found in database", { status: 404 });
    }

    // 2. Fetch the actual file stream from R2
    const file = await env.BUCKET.get(item.r2_key);
    if (!file) {
      return new Response("File not found in storage", { status: 404 });
    }

    // 3. Prepare headers (Cloudflare sets Content-Type automatically if stored)
    const headers = new Headers();
    file.writeHttpMetadata(headers);
    headers.set("etag", file.httpEtag);

    // Fallback content type if missing
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/octet-stream");
    }

    // Sanitize the filename to prevent header parsing errors
    let safeName = item.name.replace(/[^a-zA-Z0-9.\-_ ]/g, "").trim();

    // Ensure PDFs have the correct extension for downloading
    if (
      headers.get("content-type") === "application/pdf" &&
      !safeName.toLowerCase().endsWith(".pdf")
    ) {
      safeName += ".pdf";
    }

    // 4. Set Content-Disposition based on the requested action
    const disposition = action === "download" ? "attachment" : "inline";
    headers.set(
      "Content-Disposition",
      `${disposition}; filename="${safeName}"`,
    );

    // 5. Return the file stream
    return new Response(file.body, { headers });
  } catch (error) {
    return new Response(`Error retrieving file: ${error.message}`, {
      status: 500,
    });
  }
}
