export const onRequestPost: PagesFunction = async (context) => {
  const body = await context.request.json();
  console.log("Nachricht gespeichert:", body);
  return new Response(JSON.stringify({ status: "OK" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

