import { describe, expect, it } from 'vitest';

import {
	normalizeAccordProfile,
	sanitizeDiscoveryAnswers,
} from '../src/lib/discover-profile';
import { parseAccordList } from '../src/lib/server/accord-list';

describe('sanitizeDiscoveryAnswers', () => {
	it('trims answers and keeps optional fields stable', () => {
		expect(
			sanitizeDiscoveryAnswers({
				memory: ' rain on warm pavement ',
				favoriteThings: ' vinyl records, bookstores ',
				favoriteColor: ' olive ',
				favoriteFood: ' peaches ',
				vibe: ' calm and radiant ',
				avoid: ' overpowering sweetness ',
			}),
		).toEqual({
			memory: 'rain on warm pavement',
			favoriteThings: 'vinyl records, bookstores',
			favoriteColor: 'olive',
			favoriteFood: 'peaches',
			vibe: 'calm and radiant',
			avoid: 'overpowering sweetness',
		});
	});

	it('rejects empty submissions', () => {
		expect(() =>
			sanitizeDiscoveryAnswers({
				memory: '   ',
				favoriteThings: '',
				favoriteColor: '',
				favoriteFood: '',
				vibe: '',
				avoid: '',
			}),
		).toThrow(/share at least/i);
	});
});

describe('normalizeAccordProfile', () => {
	it('drops invalid accords, combines duplicates, and normalizes to one', () => {
		const profile = normalizeAccordProfile(
			[
				{ accord: 'citrus', concentration: 0.4 },
				{ accord: 'woody', concentration: 0.35 },
				{ accord: 'citrus', concentration: 0.25 },
				{ accord: 'imaginary', concentration: 0.9 },
				{ accord: 'green', concentration: 0 },
			],
			['citrus', 'woody', 'green'],
		);

		expect(profile).toEqual([
			{ accord: 'citrus', concentration: 0.65 },
			{ accord: 'woody', concentration: 0.35 },
		]);
		expect(profile.reduce((total, item) => total + item.concentration, 0)).toBe(1);
	});

	it('rounds a valid profile to an exact total of one', () => {
		const profile = normalizeAccordProfile(
			[
				{ accord: 'citrus', concentration: 1 },
				{ accord: 'woody', concentration: 1 },
				{ accord: 'sweet', concentration: 1 },
			],
			['citrus', 'woody', 'sweet'],
		);

		expect(profile.reduce((total, item) => total + item.concentration, 0)).toBe(1);
		expect(profile).toHaveLength(3);
	});

	it('throws when no valid accord remains', () => {
		expect(() =>
			normalizeAccordProfile(
				[
					{ accord: 'imaginary', concentration: 0.6 },
					{ accord: 'ghost', concentration: 0.4 },
				],
				['citrus', 'woody'],
			),
		).toThrow(/valid accords/i);
	});
});

describe('parseAccordList', () => {
	it('returns a cleaned list of accord slugs', () => {
		expect(parseAccordList('[" citrus ","woody","sweet","woody"]')).toEqual([
			'citrus',
			'woody',
			'sweet',
		]);
	});

	it('rejects invalid accord payloads', () => {
		expect(() => parseAccordList('{"accords":["citrus"]}')).toThrow(/array/i);
	});
});
