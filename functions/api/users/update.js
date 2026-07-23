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
        const userId = session.sub;

        const data = await request.json();

        // Safely check for either the new profile page keys OR the older keys
        const name = data.name || data.username || "Unknown";
        const program = data.program || null;
        const school = data.school_abbr || data.school || null;
        const batch = data.batch ? parseInt(data.batch) : null;
        const about = data.about || null;
        const avatarConfig = data.avatar_config || "?seed=default";

        await env.DB.prepare(
            `
            UPDATE users
            SET name = ?, program = ?, school_abbr = ?, batch = ?, about = ?, avatar_config = ?
            WHERE id = ?
            `
        )
        .bind(name, program, school, batch, about, avatarConfig, userId)
        .run();

        return Response.json({ success: true });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 400 });
    }
}
