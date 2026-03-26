import {
	readStoredWaitlistEmail,
	writeStoredWaitlistEmail,
	submitWaitlistEmail,
} from '../lib/waitlist';

function normalizeForms(root: ParentNode): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>('[data-waitlist-form]'));
}

function setJoinedState(container: HTMLElement, email: string): void {
	container.innerHTML = '';
	container.classList.add('waitlist--joined');
	const p = document.createElement('p');
	p.className = 'waitlist-thanks';
	if (container.closest('.cta-dark')) p.classList.add('waitlist-thanks--dark');
	p.textContent = `You’re on the list — we’ll reach out at ${email}.`;
	container.appendChild(p);
}

function showError(form: HTMLFormElement, msg: string): void {
	const el = form.querySelector<HTMLElement>('[data-waitlist-message]');
	if (el) {
		el.textContent = msg;
		el.dataset.state = 'error';
	}
}

function clearMessage(form: HTMLFormElement): void {
	const el = form.querySelector<HTMLElement>('[data-waitlist-message]');
	if (el) {
		el.textContent = '';
		el.removeAttribute('data-state');
	}
}

async function onSubmit(
	form: HTMLFormElement,
	source: string,
	email: string,
): Promise<void> {
	clearMessage(form);
	const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (btn) btn.disabled = true;
	try {
		await submitWaitlistEmail(email, source);
		writeStoredWaitlistEmail(email);
		const wrap = form.closest<HTMLElement>('[data-waitlist-wrap]');
		if (wrap) setJoinedState(wrap, email.trim().toLowerCase());
	} catch (e) {
		const msg =
			e instanceof Error ? e.message : 'Something went wrong. Please try again.';
		showError(form, msg);
	} finally {
		if (btn) btn.disabled = false;
	}
}

function bindForm(form: HTMLFormElement): void {
	const source = form.getAttribute('data-source') ?? 'unknown';
	form.addEventListener('submit', (ev) => {
		ev.preventDefault();
		const fd = new FormData(form);
		const email = String(fd.get('email') ?? '').trim();
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			showError(form, 'Please enter a valid email.');
			return;
		}
		void onSubmit(form, source, email);
	});
}

function applyAlreadyJoined(email: string): void {
	for (const form of normalizeForms(document)) {
		const wrap = form.closest<HTMLElement>('[data-waitlist-wrap]');
		if (wrap) setJoinedState(wrap, email);
	}
}

function init(): void {
	const stored = readStoredWaitlistEmail();
	if (stored) {
		applyAlreadyJoined(stored);
		return;
	}
	for (const form of normalizeForms(document)) {
		if (form.tagName === 'FORM') bindForm(form as HTMLFormElement);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
