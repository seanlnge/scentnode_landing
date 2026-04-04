import type { APIRoute } from 'astro';

import { sanitizeDiscoveryAnswers } from '../../lib/discover-profile';
import { loadAccordList } from '../../lib/server/accord-list';
import { generateScentProfile } from '../../lib/server/openai-scent';

export const prerender = false;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
		},
	});
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const payload = await request.json();
		const answers = sanitizeDiscoveryAnswers(payload);
		const accordList = await loadAccordList();
		const profile = await generateScentProfile(answers, accordList);

		return json({ profile });
	} catch (error) {
		if (error instanceof SyntaxError) {
			return json({ error: 'Invalid JSON body.' }, 400);
		}

		if (error instanceof Error) {
			const isValidationError =
				error.message.includes('share at least') || error.message.includes('expected');
			return json({ error: error.message }, isValidationError ? 400 : 500);
		}

		return json({ error: 'Unable to generate a scent profile right now.' }, 500);
	}
};
