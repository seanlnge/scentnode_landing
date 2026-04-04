import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

const accordListSchema = z.array(z.string().trim().min(1)).min(1);

export const ACCORD_LIST_PATH = path.resolve(process.cwd(), '..', 'accord_list.json');

export function parseAccordList(source: string): string[] {
	const accords = accordListSchema.parse(JSON.parse(source));
	return [...new Set(accords.map((accord) => accord.trim().toLowerCase()))];
}

export async function loadAccordList(): Promise<string[]> {
	const source = await readFile(ACCORD_LIST_PATH, 'utf8');
	return parseAccordList(source);
}
