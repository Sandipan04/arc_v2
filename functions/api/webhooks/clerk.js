import { Webhook } from "svix";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Verify the Webhook Secret exists
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET in environment", {
      status: 500,
    });
  }

  // 2. Get the Svix headers from the request
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // 3. Get the raw body
  const payload = await request.text();
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  // 4. Verify the cryptographic signature
  try {
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Error verifying webhook:", err.message);
    return new Response("Invalid signature", { status: 400 });
  }

  // 5. Process the user.created event
  if (evt.type === "user.created") {
    const {
      id,
      email_addresses,
      primary_email_address_id,
      first_name,
      last_name,
      username,
    } = evt.data;

    // Extract the primary email
    const primaryEmailObj =
      email_addresses.find((e) => e.id === primary_email_address_id) ||
      email_addresses[0];
    const email = primaryEmailObj ? primaryEmailObj.email_address : "";

    // Construct the display name
    let name = [first_name, last_name].filter(Boolean).join(" ");
    if (!name) name = username || "Unknown User";

    // Apply your NISER business logic
    const status = email.endsWith("@niser.ac.in") ? "approved" : "pending";

    try {
      // Insert into the database (IGNORE prevents errors if Clerk sends duplicate webhooks)
      await env.DB.prepare(
        `
                INSERT OR IGNORE INTO users (id, name, email, role, status)
                VALUES (?, ?, ?, 'student', ?)
            `,
      )
        .bind(id, name, email, status)
        .run();
    } catch (dbError) {
      console.error("Database insertion error:", dbError);
      return new Response("Database error", { status: 500 });
    }
  }

  return new Response("Webhook processed successfully", { status: 200 });
}
