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

    // 1. Authenticate & Check Base Role
    const caller = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.sub)
      .first();
    if (!caller || caller.role === "student") {
      return Response.json(
        { error: "Forbidden. Insufficient permissions." },
        { status: 403 },
      );
    }

    const { type, id, action } = await request.json();

    // 2. Process User Actions
    if (type === "user") {
      if (action === "approve") {
        if (caller.role !== "admin")
          return Response.json(
            { error: "Only Admins can approve users." },
            { status: 403 },
          );
        await env.DB.prepare(
          "UPDATE users SET status = 'approved' WHERE id = ?",
        )
          .bind(id)
          .run();
      } else if (action === "reject" || action === "revoke") {
        if (caller.role !== "admin")
          return Response.json(
            { error: "Only Admins can revoke access or reject users." },
            { status: 403 },
          );
        await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
      } else if (action === "promote_mod") {
        await env.DB.prepare("UPDATE users SET role = 'moderator' WHERE id = ?")
          .bind(id)
          .run();
      } else if (action === "demote_student") {
        await env.DB.prepare("UPDATE users SET role = 'student' WHERE id = ?")
          .bind(id)
          .run();
      }
      // NEW: Admin-to-Admin promotions and demotions
      else if (action === "promote_admin") {
        if (caller.role !== "admin")
          return Response.json(
            { error: "Only Admins can promote to Admin." },
            { status: 403 },
          );
        await env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?")
          .bind(id)
          .run();
      } else if (action === "demote_mod") {
        if (caller.role !== "admin")
          return Response.json(
            { error: "Only Admins can demote Admins." },
            { status: 403 },
          );
        await env.DB.prepare("UPDATE users SET role = 'moderator' WHERE id = ?")
          .bind(id)
          .run();
      }
    }
    // 3. Process Course Actions
    else if (type === "course") {
      if (action === "approve") {
        await env.DB.prepare(
          "UPDATE courses SET status = 'approved' WHERE id = ?",
        )
          .bind(id)
          .run();
      } else if (action === "reject") {
        await env.DB.prepare("DELETE FROM courses WHERE id = ?").bind(id).run();
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
