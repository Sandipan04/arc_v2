import { verifyToken } from "@clerk/backend";

export async function onRequestGet(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;

  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    const caller = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.sub)
      .first();
    if (!caller || caller.role === "student")
      return Response.json({ error: "Forbidden." }, { status: 403 });

    const url = new URL(request.url);
    const level = url.searchParams.get("level") || "schools";
    const parentId = url.searchParams.get("parentId");

    let data = [];

    if (level === "schools") {
      data = (
        await env.DB.prepare(
          "SELECT id, name, abbr as details FROM schools ORDER BY name ASC",
        ).all()
      ).results;
    } else if (level === "courses") {
      data = (
        await env.DB.prepare(
          "SELECT id, name, code as details FROM courses WHERE school_id = ? ORDER BY code ASC",
        )
          .bind(parentId)
          .all()
      ).results;
    } else if (level === "iterations") {
      // Using your exact schema columns: year, sem, and inst
      data = (
        await env.DB.prepare(
          `
                    SELECT id, year || ' ' || sem as name, 'Instructor: ' || inst as details
                    FROM iterations
                    WHERE course_id = ?
                    ORDER BY year DESC, sem ASC
                `,
        )
          .bind(parentId)
          .all()
      ).results;
    } else if (level === "items") {
      // Include description and is_flagged so the frontend modal can access them
      data = (
        await env.DB.prepare(
          `
                    SELECT id, name, status as details, description, is_flagged
                    FROM items
                    WHERE iteration_id = ?
                    ORDER BY created_at DESC
                `,
        )
          .bind(parentId)
          .all()
      ).results;
    }

    return Response.json({ success: true, level, data });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function onRequestPost(context) {
  return handleMutation(context, "POST");
}

export async function onRequestPut(context) {
  return handleMutation(context, "PUT");
}

export async function onRequestDelete(context) {
  return handleMutation(context, "DELETE");
}

async function handleMutation(context, method) {
  const { request, env } = context;
  const authHeader = request.headers.get("authorization");
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const session = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    const caller = await env.DB.prepare("SELECT role FROM users WHERE id = ?")
      .bind(session.sub)
      .first();
    if (!caller || caller.role === "student")
      return Response.json({ error: "Forbidden." }, { status: 403 });

    const data = await request.json();
    const { level, id, parentId, payload } = data; // payload contains form fields

    if (method === "DELETE") {
      const table = level === "items" ? "items" : level; // schools, courses, iterations, items
      await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
      return Response.json({ success: true });
    }

    if (method === "POST") {
      if (level === "schools") {
        const newId = `school_${payload.abbr.toLowerCase()}`;
        await env.DB.prepare(
          "INSERT INTO schools (id, abbr, name) VALUES (?, ?, ?)",
        )
          .bind(newId, payload.abbr.toUpperCase(), payload.name)
          .run();
      } else if (level === "courses") {
        const newId = `course_${parentId}_${payload.code.toLowerCase().replace(/\s+/g, "")}`;
        await env.DB.prepare(
          "INSERT INTO courses (id, school_id, code, name, status, created_by) VALUES (?, ?, ?, ?, 'approved', ?)",
        )
          .bind(
            newId,
            parentId,
            payload.code.toUpperCase(),
            payload.name,
            session.sub,
          )
          .run();
      } else if (level === "iterations") {
        const newId = `iter_${parentId}_${payload.year}_${payload.sem.toLowerCase()}`;
        await env.DB.prepare(
          "INSERT INTO iterations (id, course_id, year, sem, inst, status, created_by) VALUES (?, ?, ?, ?, ?, 'approved', ?)",
        )
          .bind(
            newId,
            parentId,
            payload.year,
            payload.sem.toUpperCase(),
            payload.inst,
            session.sub,
          )
          .run();
      }
      return Response.json({ success: true });
    }

    if (method === "PUT") {
      if (level === "schools") {
        await env.DB.prepare(
          "UPDATE schools SET abbr = ?, name = ? WHERE id = ?",
        )
          .bind(payload.abbr.toUpperCase(), payload.name, id)
          .run();
      } else if (level === "courses") {
        await env.DB.prepare(
          "UPDATE courses SET code = ?, name = ? WHERE id = ?",
        )
          .bind(payload.code.toUpperCase(), payload.name, id)
          .run();
      } else if (level === "iterations") {
        await env.DB.prepare(
          "UPDATE iterations SET year = ?, sem = ?, inst = ? WHERE id = ?",
        )
          .bind(payload.year, payload.sem.toUpperCase(), payload.inst, id)
          .run();
      } else if (level === "items") {
        // NEW: Update file metadata and moderation flags
        await env.DB.prepare(
          "UPDATE items SET name = ?, description = ?, status = ?, is_flagged = ? WHERE id = ?",
        )
          .bind(
            payload.name,
            payload.description || null,
            payload.status,
            payload.is_flagged,
            id,
          )
          .run();
      }
      return Response.json({ success: true });
    }
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
