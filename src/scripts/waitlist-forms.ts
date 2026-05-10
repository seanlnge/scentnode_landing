import {
	readStoredWaitlistEmail,
	writeStoredWaitlistEmail,
	submitWaitlistEmail,
	type WaitlistIntake,
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

function ensureQualifier(form: HTMLFormElement): HTMLElement {
	const existing = form.querySelector<HTMLElement>('[data-waitlist-qualifier]');
	if (existing) return existing;

	const qualifier = document.createElement('fieldset');
	qualifier.className = 'waitlist-qualifier';
	qualifier.setAttribute('data-waitlist-qualifier', '');
	qualifier.hidden = true;
	qualifier.innerHTML = `
		<legend class="waitlist-qualifier__legend">A couple quick questions</legend>
		<div class="waitlist-qualifier__group">
			<p class="waitlist-qualifier__prompt">Are you joining for business or personal use?</p>
			<label><input type="radio" name="audience" value="business" /> Business</label>
			<label><input type="radio" name="audience" value="personal" /> Personal</label>
		</div>
		<div class="waitlist-qualifier__business" data-business-fields hidden>
			<div class="waitlist-qualifier__group">
				<label for="business-size-select">Size of business</label>
				<select id="business-size-select" name="businessSize">
					<option value="">Select one</option>
					<option value="solo">Solo founder</option>
					<option value="small">2-10 team members</option>
					<option value="growing">11-50 team members</option>
					<option value="established">51-200 team members</option>
					<option value="enterprise">200+ team members</option>
				</select>
			</div>
			<div class="waitlist-qualifier__group">
				<p class="waitlist-qualifier__prompt">What do you sell? (Select all that apply)</p>
				<label><input type="checkbox" name="businessCategory" value="fashion" /> Fashion</label>
				<label><input type="checkbox" name="businessCategory" value="jewelry" /> Jewelry</label>
				<label><input type="checkbox" name="businessCategory" value="skincare-beauty" /> Skincare / Beauty</label>
				<label><input type="checkbox" name="businessCategory" value="candles-home-fragrance" /> Candles / Home Fragrance</label>
				<label><input type="checkbox" name="businessCategory" value="handmade-goods" /> Handmade Goods</label>
				<label><input type="checkbox" name="businessCategory" value="art-prints" /> Art / Prints</label>
				<label><input type="checkbox" name="businessCategory" value="other" data-business-other-toggle /> Other</label>
				<input
					type="text"
					name="businessCategoryOther"
					placeholder="Tell us what you sell"
					data-business-other-input
					hidden
				/>
			</div>
		</div>
	`;

	const actions = form.querySelector<HTMLElement>('button[type="submit"]')?.closest('div');
	if (actions) form.insertBefore(qualifier, actions);
	else form.appendChild(qualifier);

	const audienceRadios = qualifier.querySelectorAll<HTMLInputElement>('input[name="audience"]');
	const businessFields = qualifier.querySelector<HTMLElement>('[data-business-fields]');
	const otherToggle = qualifier.querySelector<HTMLInputElement>('[data-business-other-toggle]');
	const otherInput = qualifier.querySelector<HTMLInputElement>('[data-business-other-input]');

	for (const radio of audienceRadios) {
		radio.addEventListener('change', () => {
			const isBusiness = radio.value === 'business' && radio.checked;
			if (businessFields) businessFields.hidden = !isBusiness;
			if (!isBusiness) {
				qualifier
					.querySelectorAll<HTMLInputElement>('input[name="businessCategory"]')
					.forEach((input) => {
						input.checked = false;
					});
				const sizeSelect = qualifier.querySelector<HTMLSelectElement>('select[name="businessSize"]');
				if (sizeSelect) sizeSelect.value = '';
				if (otherInput) {
					otherInput.hidden = true;
					otherInput.value = '';
				}
			}
		});
	}

	otherToggle?.addEventListener('change', () => {
		if (!otherInput) return;
		otherInput.hidden = !otherToggle.checked;
		if (!otherToggle.checked) otherInput.value = '';
	});

	return qualifier;
}

function readIntake(form: HTMLFormElement): { intake?: WaitlistIntake; error?: string } {
	const qualifier = ensureQualifier(form);
	const audience = qualifier.querySelector<HTMLInputElement>('input[name="audience"]:checked')?.value;
	if (!audience) return { error: 'Please choose business or personal to continue.' };

	if (audience === 'personal') {
		return {
			intake: {
				audience: 'personal',
			},
		};
	}

	const size = qualifier.querySelector<HTMLSelectElement>('select[name="businessSize"]')?.value ?? '';
	if (!size) {
		return { error: 'Please select your business size.' };
	}

	const categories = Array.from(
		qualifier.querySelectorAll<HTMLInputElement>('input[name="businessCategory"]:checked'),
	).map((input) => input.value);
	if (!categories.length) {
		return { error: 'Please choose at least one product category.' };
	}

	const otherText =
		qualifier.querySelector<HTMLInputElement>('input[name="businessCategoryOther"]')?.value.trim() ?? '';
	if (categories.includes('other') && !otherText) {
		return { error: 'Please tell us what you sell for "Other".' };
	}

	return {
		intake: {
			audience: 'business',
			businessSize: size as WaitlistIntake['businessSize'],
			businessCategories: categories,
			...(otherText ? { businessCategoryOther: otherText } : {}),
		},
	};
}

function openQualifier(form: HTMLFormElement): void {
	const qualifier = ensureQualifier(form);
	qualifier.hidden = false;
	form.dataset.qualifierOpen = 'true';
}

async function onSubmit(
	form: HTMLFormElement,
	source: string,
	email: string,
	intake: WaitlistIntake,
): Promise<void> {
	clearMessage(form);
	const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (btn) btn.disabled = true;
	try {
		await submitWaitlistEmail(email, source, undefined, intake);
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
	ensureQualifier(form);

	form.addEventListener('submit', (ev) => {
		ev.preventDefault();
		const fd = new FormData(form);
		const email = String(fd.get('email') ?? '').trim();
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			showError(form, 'Please enter a valid email.');
			return;
		}

		if (form.dataset.qualifierOpen !== 'true') {
			openQualifier(form);
			showError(form, 'One more step: tell us who you are signing up for.');
			return;
		}

		const { intake, error } = readIntake(form);
		if (!intake) {
			showError(form, error ?? 'Please answer the questions above.');
			return;
		}

		void onSubmit(form, source, email, intake);
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
