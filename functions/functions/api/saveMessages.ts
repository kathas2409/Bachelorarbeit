export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    const body = await request.json();
    const { sessionId, ipHash, message, timestamp } = body;

    if (!message) {
      return new Response("Missing message", { status: 400 });
    }

    await env.DB.prepare(
      `INSERT INTO chats (sessionId, ipHash, message, timestamp) VALUES (?, ?, ?, ?)`
    ).bind(sessionId, ipHash, message, timestamp).run();

    return new Response("OK", { status: 200 });
  } catch (err: any) {
    return new Response("Error: " + err.message, { status: 500 });
  }
};
