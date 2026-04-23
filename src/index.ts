import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';

const INTERACTION_ID_HEADER = 'X-Interaction-Id';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		try {
			return await handleRequest(request, env);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const stack = err instanceof Error ? err.stack : undefined;
			console.error('Unhandled error:', message, stack);
			return Response.json({ error: message, stack }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

async function handleRequest(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);

	if (request.method === 'GET' && url.pathname === '/') {
		const runningMessage = 'Dev Showdown Cloudflare Starter is running.';
		const message = env.DEV_SHOWDOWN_API_KEY
			? runningMessage
			: [runningMessage, 'DEV_SHOWDOWN_API_KEY is missing.'].join('\n');

		return new Response(message, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		});
	}

	if (request.method !== 'POST' || url.pathname !== '/api') {
		return Response.json({ error: `${request.method} ${url.pathname} not found` }, { status: 404 });
	}

	const challengeType = url.searchParams.get('challengeType');
	if (!challengeType) {
		return Response.json({ error: 'Missing challengeType query parameter' }, { status: 400 });
	}

	const interactionId = request.headers.get(INTERACTION_ID_HEADER);
	if (!interactionId) {
		return Response.json({ error: `Missing ${INTERACTION_ID_HEADER} header` }, { status: 400 });
	}

	const payload = await request.json<any>();

	switch (challengeType) {
		case 'HELLO_WORLD':
			return Response.json({ greeting: `Hello ${payload.name}` });

		case 'BASIC_LLM': {
			if (!env.DEV_SHOWDOWN_API_KEY) {
				return Response.json({ error: 'DEV_SHOWDOWN_API_KEY secret is not configured' }, { status: 500 });
			}

			const workshopLlm = createWorkshopLlm(env.DEV_SHOWDOWN_API_KEY, interactionId);
			const result = await generateText({
				model: workshopLlm.chatModel('deli-4'),
				system: 'You are a trivia question player. Answer the question correctly and concisely.',
				prompt: payload.question,
			});

			return Response.json({ answer: result.text || 'N/A' });
		}

		default:
			return Response.json({ error: `No solver for challengeType: ${challengeType}` }, { status: 404 });
	}
}

function createWorkshopLlm(apiKey: string, interactionId: string) {
	return createOpenAICompatible({
		name: 'dev-showdown',
		baseURL: 'https://devshowdown.com/v1',
		supportsStructuredOutputs: true,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			[INTERACTION_ID_HEADER]: interactionId,
		},
	});
}
