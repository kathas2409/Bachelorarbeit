export async function onRequestPost(context) {
  const body = await context.request.json();

  const { sessionId, ipHash, message, timestamp } = body;

  const db = context.env.DB; // kommt aus wrangler.toml

  await db.prepare(
    `INSERT INTO chats (session_id, ip_hash, message, timestamp)
     VALUES (?, ?, ?, ?)`
  )
  .bind(sessionId, ipHash, message, timestamp)
  .run();

  return new Response("Nachricht gespeichert", { status: 200 });
}
