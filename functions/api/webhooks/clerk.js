import { Webhook } from "svix";

export async function onRequestPost(context) {
  const { request, env } = context;

  // Clerk webhook secret (Set this in .dev.vars and Cloudflare dashboard)
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    return new Response("Please add CLERK_WEBHOOK_SECRET to env", {
      status: 500,
    });
  }

  // Get the headers required by Svix to verify the signature
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await request.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    return new Response("Error verifying webhook", { status: 400 });
  }

  // Process the verified payload
  if (evt.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    const email = email_addresses[0]?.email_address || "";
    const name =
      `${first_name || ""} ${last_name || ""}`.trim() || "Unknown User";

    // Auto-approve NISER emails, pending for others
    const status = email.endsWith("@niser.ac.in") ? "approved" : "pending";

    // Insert into D1
    await env.DB.prepare(
      `
            INSERT INTO users (id, name, email, status, role)
            VALUES (?, ?, ?, ?, 'student')
        `,
    )
      .bind(id, name, email, status)
      .run();
  }

  return new Response("Webhook processed successfully", { status: 200 });
}
