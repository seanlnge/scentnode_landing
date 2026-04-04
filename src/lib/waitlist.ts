import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	doc,
	setDoc,
	serverTimestamp,
	type Firestore,
} from 'firebase/firestore';

export const WAITLIST_STORAGE_KEY = 'scentnode_waitlist_email';

export type FragranceProfile = {
	accords: Array<{
		accord: string;
		concentration: number;
	}>;
};

export function readStoredWaitlistEmail(): string | null {
	try {
		return localStorage.getItem(WAITLIST_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function writeStoredWaitlistEmail(email: string): void {
	try {
		localStorage.setItem(WAITLIST_STORAGE_KEY, email.trim().toLowerCase());
	} catch {
		/* ignore */
	}
}

function readPublicEnv(): Record<string, string> {
	return {
		apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY ?? '',
		authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
		projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID ?? '',
		storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
		messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
		appId: import.meta.env.PUBLIC_FIREBASE_APP_ID ?? '',
	};
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getClientDb(): Firestore {
	if (db) return db;
	const cfg = readPublicEnv();
	if (
		!cfg.apiKey ||
		!cfg.authDomain ||
		!cfg.projectId ||
		!cfg.appId
	) {
		throw new Error(
			'Firebase env missing. Copy .env.example to .env and set PUBLIC_FIREBASE_* values.',
		);
	}
	if (!getApps().length) {
		app = initializeApp({
			apiKey: cfg.apiKey,
			authDomain: cfg.authDomain,
			projectId: cfg.projectId,
			storageBucket: cfg.storageBucket || undefined,
			messagingSenderId: cfg.messagingSenderId || undefined,
			appId: cfg.appId,
		});
	} else {
		app = getApps()[0]!;
	}
	db = getFirestore(app);
	return db;
}

/** Stable Firestore doc id from email (URL-safe, collision-resistant for typical emails). */
export function waitlistDocId(email: string): string {
	const normalized = email.trim().toLowerCase();
	let binary = '';
	for (const byte of new TextEncoder().encode(normalized)) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\//g, '_')
		.replace(/\+/g, '-')
		.replace(/=/g, '');
}

export async function submitWaitlistEmail(
	email: string,
	source: string,
	fragranceProfile?: FragranceProfile,
): Promise<void> {
	const firestore = getClientDb();
	const id = waitlistDocId(email);
	const ref = doc(firestore, 'waitlist', id);
	await setDoc(
		ref,
		{
			email: email.trim().toLowerCase(),
			source,
			...(fragranceProfile ? { fragranceProfile } : {}),
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);
}
