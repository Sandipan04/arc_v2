export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    if (!db) {
      return Response.json(
        { success: false, error: "Database binding 'DB' not found." },
        { status: 500 },
      );
    }

    // D1 blocks querying sqlite_schema directly for security reasons (SQLITE_AUTH).
    // Instead, we explicitly list the tables we expect from your schema.sql.
    // Add or remove table names here as your database grows.
    const knownTables = [
      "users",
      "schools",
      "courses",
      "iterations",
      "items",
      "comments",
    ];

    const stats = {};

    for (const tableName of knownTables) {
      try {
        // Query row count directly
        const countQuery = await db
          .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
          .first();
        stats[tableName] = countQuery ? countQuery.count : 0;
      } catch (err) {
        // If a table doesn't exist yet, catch the error so it doesn't break the loop
        stats[tableName] = "Not found / Not created yet";
      }
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: stats,
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
