import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod/v3';

import {
	buildDiscoveryPrompt,
	type DiscoveryAnswers,
	normalizeAccordProfile,
} from '../discover-profile';

const rawProfileSchema = z.object({
	accords: z
		.array(
			z.object({
				accord: z.string(),
				concentration: z.number(),
			}),
		)
		.min(3)
		.max(8),
});

let client: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
	if (client) return client;

	const apiKey = import.meta.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error('OPENAI_API_KEY is missing.');
	}

	client = new OpenAI({ apiKey });
	return client;
}

function getModelName(): string {
	return import.meta.env.OPENAI_SCENT_MODEL ?? process.env.OPENAI_SCENT_MODEL ?? 'gpt-4o-mini';
}

export async function generateScentProfile(
	answers: DiscoveryAnswers,
	allowedAccords: readonly string[],
) {
	const completion = await getOpenAiClient().chat.completions.parse({
		model: getModelName(),
		temperature: 0.8,
		messages: [
			{
				role: 'system',
				content:
					'You are a perfumer translating lifestyle cues into fragrance accord blends. Use only the provided accord allowlist. Respond with emotionally coherent fragrance structures, not prose.',
			},
			{
				role: 'user',
				content: buildDiscoveryPrompt(answers, allowedAccords),
			},
		],
		response_format: zodResponseFormat(rawProfileSchema, 'scent_profile'),
	});

	const parsed = completion.choices[0]?.message?.parsed;
	if (!parsed) {
		throw new Error('The model did not return a structured fragrance profile.');
	}

	return normalizeAccordProfile(parsed.accords, allowedAccords);
}
