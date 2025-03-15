// https://github.com/janlay/openai-cloudflare/blob/master/worker.js

async function proxy(request, env) {
    const headers = new Headers(request.headers);
    const authKey = 'Authorization';
    const token = headers.get(authKey).split(' ').pop();
    if (!token) throw 'Auth required';

    // validate user
    if (token !== "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") {
        throw 'Invalid token';
    }

    const requestUrl = new URL(request.url)

    const url = "https://gateway.ai.cloudflare.com/v1/257b8498a04c58790e756df308765bd3/verifizierung-studie/openai/" + requestUrl.pathname.substring("/openai/v1/".length);
    headers.set(authKey, `Bearer ${env.OPENAPI_API_KEY}`);

    return await fetch(url, {
        method: request.method,
        headers: headers,
        body: request.body
    });
}

export async function onRequest({ request, env }) {
    const { pathname } = new URL(request.url);

    if (pathname === "/openai/v1/chat/completions") {
        return proxy(request, env)
            .catch(err => new Response(err || 'Unknown reason', { status: 403 }));
    }
    throw 'Access forbidden';
}
