import {
	readStoredWaitlistEmail,
	submitWaitlistEmail,
	writeStoredWaitlistEmail,
	type FragranceProfile,
} from '../lib/waitlist';

type DiscoverResponse =
	| {
			profile: FragranceProfile['accords'];
	  }
	| {
			error: string;
	  };

const discoverForm = document.querySelector<HTMLFormElement>('[data-discover-form]');
const discoverMessage = document.querySelector<HTMLElement>('[data-discover-message]');
const resultSection = document.querySelector<HTMLElement>('[data-discover-result]');
const resultList = document.querySelector<HTMLElement>('[data-profile-list]');
const resultSummary = document.querySelector<HTMLElement>('[data-profile-summary]');
const waitlistForm = document.querySelector<HTMLFormElement>('[data-discover-waitlist-form]');
const waitlistMessage = document.querySelector<HTMLElement>('[data-discover-waitlist-message]');
const waitlistCard = document.querySelector<HTMLElement>('[data-discover-waitlist-card]');
const waitlistEmailInput = document.querySelector<HTMLInputElement>('[data-discover-email]');

let currentProfile: FragranceProfile | null = null;

function setMessage(node: HTMLElement | null, message: string, state?: 'error' | 'success'): void {
	if (!node) return;
	node.textContent = message;
	if (state) node.dataset.state = state;
	else delete node.dataset.state;
}

function formatPercent(value: number): string {
	const percentage = value * 100;
	return percentage >= 10 ? `${percentage.toFixed(0)}%` : `${percentage.toFixed(1)}%`;
}

function renderProfile(profile: FragranceProfile): void {
	if (!resultList || !resultSection || !resultSummary) return;

	resultList.innerHTML = '';

	for (const item of profile.accords) {
		const row = document.createElement('div');
		row.className = 'discover-profile__row';

		const label = document.createElement('div');
		label.className = 'discover-profile__label';

		const name = document.createElement('span');
		name.textContent = item.accord.replace(/-/g, ' ');

		const value = document.createElement('strong');
		value.textContent = formatPercent(item.concentration);

		label.append(name, value);

		const bar = document.createElement('div');
		bar.className = 'discover-profile__bar';

		const fill = document.createElement('span');
		fill.style.width = `${Math.max(item.concentration * 100, 6)}%`;

		bar.appendChild(fill);
		row.append(label, bar);
		resultList.appendChild(row);
	}

	resultSummary.textContent = `A ${profile.accords.length}-accord scent sketch generated from your memory and favorites.`;
	resultSection.hidden = false;
	resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function requestProfile(form: HTMLFormElement): Promise<void> {
	const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	submitButton?.setAttribute('disabled', 'true');
	setMessage(discoverMessage, 'Generating your scent profile...');

	try {
		const response = await fetch('/api/discover', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
		});

		const payload = (await response.json()) as DiscoverResponse;
		if (!response.ok || !('profile' in payload)) {
			throw new Error('error' in payload ? payload.error : 'Unable to generate profile.');
		}

		currentProfile = { accords: payload.profile };
		renderProfile(currentProfile);
		setMessage(discoverMessage, 'Your scent profile is ready.', 'success');
		setMessage(waitlistMessage, '');
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unable to generate your scent profile right now.';
		setMessage(discoverMessage, message, 'error');
	} finally {
		submitButton?.removeAttribute('disabled');
	}
}

async function saveWaitlist(form: HTMLFormElement): Promise<void> {
	if (!currentProfile) {
		setMessage(waitlistMessage, 'Generate a scent profile before joining the waitlist.', 'error');
		return;
	}

	const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	const email = String(new FormData(form).get('email') ?? '').trim().toLowerCase();
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		setMessage(waitlistMessage, 'Please enter a valid email address.', 'error');
		return;
	}

	submitButton?.setAttribute('disabled', 'true');
	setMessage(waitlistMessage, 'Saving your fragrance profile...');

	try {
		await submitWaitlistEmail(email, 'discover', currentProfile);
		writeStoredWaitlistEmail(email);
		setMessage(waitlistMessage, `You’re on the list at ${email}.`, 'success');
		waitlistCard?.classList.add('discover-waitlist--joined');
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to save your profile.';
		setMessage(waitlistMessage, message, 'error');
	} finally {
		submitButton?.removeAttribute('disabled');
	}
}

function init(): void {
	const storedEmail = readStoredWaitlistEmail();
	if (storedEmail && waitlistEmailInput) {
		waitlistEmailInput.value = storedEmail;
	}

	discoverForm?.addEventListener('submit', (event) => {
		event.preventDefault();
		void requestProfile(discoverForm);
	});

	waitlistForm?.addEventListener('submit', (event) => {
		event.preventDefault();
		void saveWaitlist(waitlistForm);
	});
}

init();
