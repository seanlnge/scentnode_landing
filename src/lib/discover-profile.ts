import { z } from 'zod';

const DISCOVERY_FIELD_LIMIT = 400;
const PROFILE_PRECISION = 10_000;

const discoveryAnswersSchema = z
	.object({
		memory: z.string().max(DISCOVERY_FIELD_LIMIT).catch(''),
		favoriteThings: z.string().max(DISCOVERY_FIELD_LIMIT).catch(''),
		favoriteColor: z.string().max(80).catch(''),
		favoriteFood: z.string().max(120).catch(''),
		vibe: z.string().max(160).catch(''),
		avoid: z.string().max(160).catch(''),
	})
	.transform((answers) => ({
		memory: answers.memory.trim(),
		favoriteThings: answers.favoriteThings.trim(),
		favoriteColor: answers.favoriteColor.trim(),
		favoriteFood: answers.favoriteFood.trim(),
		vibe: answers.vibe.trim(),
		avoid: answers.avoid.trim(),
	}));

export const scentProfileResponseSchema = z.object({
	accords: z
		.array(
			z.object({
				accord: z.string().trim().min(1),
				concentration: z.number().refine(Number.isFinite, 'Expected a finite concentration'),
			}),
		)
		.min(1)
		.max(10),
});

export type DiscoveryAnswers = z.infer<typeof discoveryAnswersSchema>;
export type RawAccordWeight = z.infer<typeof scentProfileResponseSchema>['accords'][number];
export type NormalizedAccordWeight = {
	accord: string;
	concentration: number;
};

export function sanitizeDiscoveryAnswers(input: unknown): DiscoveryAnswers {
	const answers = discoveryAnswersSchema.parse(input);
	const hasSignal = Object.values(answers).some((value) => value.length > 0);

	if (!hasSignal) {
		throw new Error('Please share at least one memory or preference.');
	}

	return answers;
}

export function normalizeAccordProfile(
	rawAccords: readonly RawAccordWeight[],
	allowedAccords: readonly string[],
): NormalizedAccordWeight[] {
	const allowed = new Set(allowedAccords.map((accord) => accord.trim().toLowerCase()));
	const totals = new Map<string, number>();

	for (const item of rawAccords) {
		const accord = item.accord.trim().toLowerCase();
		if (!allowed.has(accord) || !Number.isFinite(item.concentration) || item.concentration <= 0) {
			continue;
		}

		totals.set(accord, (totals.get(accord) ?? 0) + item.concentration);
	}

	const entries = Array.from(totals.entries());
	const total = entries.reduce((sum, [, concentration]) => sum + concentration, 0);

	if (!entries.length || total <= 0) {
		throw new Error('No valid accords were returned.');
	}

	const normalized = entries.map(([accord, concentration]) => {
		const scaled = (concentration / total) * PROFILE_PRECISION;
		const basisPoints = Math.floor(scaled);
		return {
			accord,
			basisPoints,
			remainder: scaled - basisPoints,
		};
	});

	let remainder = PROFILE_PRECISION - normalized.reduce((sum, item) => sum + item.basisPoints, 0);

	normalized
		.slice()
		.sort((left, right) => {
			if (right.remainder !== left.remainder) {
				return right.remainder - left.remainder;
			}
			return left.accord.localeCompare(right.accord);
		})
		.forEach((item) => {
			if (remainder <= 0) return;
			item.basisPoints += 1;
			remainder -= 1;
		});

	return normalized
		.filter((item) => item.basisPoints > 0)
		.map((item) => ({
			accord: item.accord,
			concentration: item.basisPoints / PROFILE_PRECISION,
		}))
		.sort((left, right) => {
			if (right.concentration !== left.concentration) {
				return right.concentration - left.concentration;
			}
			return left.accord.localeCompare(right.accord);
		});
}

export function buildDiscoveryPrompt(
	answers: DiscoveryAnswers,
	allowedAccords: readonly string[],
): string {
	const promptSections = [
		'Translate the user into a fragrance accord profile.',
		`Allowed accords only: ${allowedAccords.join(', ')}.`,
		'Return 3 to 8 accords that best match the user.',
		'Each concentration must be positive.',
		'The concentrations do not need to sum to 1; they will be normalized after parsing.',
		'Do not include any accord outside the allowlist.',
		'Prefer emotionally coherent blends over covering every detail.',
		'User input:',
		`Memory: ${answers.memory || 'None provided.'}`,
		`Favorite things: ${answers.favoriteThings || 'None provided.'}`,
		`Favorite color: ${answers.favoriteColor || 'None provided.'}`,
		`Favorite food: ${answers.favoriteFood || 'None provided.'}`,
		`Desired vibe: ${answers.vibe || 'None provided.'}`,
		`Avoid: ${answers.avoid || 'None provided.'}`,
	];

	return promptSections.join('\n');
}
