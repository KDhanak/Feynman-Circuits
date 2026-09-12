<script lang="ts">
	import { resolve } from '$app/paths';
	// Importing the theme store applies the saved light/dark theme to this page too.
	import '$lib/stores/themeStore';

	// ── Fill these in before publishing ───────────────────────────────
	// Anything still in [square brackets] is shown highlighted on the page,
	// so it is easy to spot what is missing.
	const OPERATOR = 'Kishan Dhanak';
	const CONTACT_EMAIL = 'kishan.dhanak.tech@gmail.com';
	const DATABASE_PROVIDER = 'Neon (PostgreSQL)';
	const MIN_AGE = 13;
	const LAST_UPDATED = '13 September 2026';

	const isPlaceholder = (s: string) => s.startsWith('[');
</script>

<svelte:head>
	<title>Privacy Policy — Feynman Circuits</title>
	<meta
		name="description"
		content="How Feynman Circuits collects, uses and protects your personal data."
	/>
</svelte:head>

{#snippet fill(value: string)}
	{#if isPlaceholder(value)}
		<mark class="placeholder">{value}</mark>
	{:else}
		{value}
	{/if}
{/snippet}

{#snippet contact()}
	{#if isPlaceholder(CONTACT_EMAIL)}
		<mark class="placeholder">{CONTACT_EMAIL}</mark>
	{:else}
		<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
	{/if}
{/snippet}

<!-- The page scrolls inside its own box, so it works even if the main app
     turns off scrolling on <body>. -->
<div class="page h-screen overflow-y-auto">
	<article class="mx-auto max-w-3xl px-5 py-10 sm:py-14">
		<a href={resolve('/')} class="back">← Back to Feynman Circuits</a>

		<h1>Privacy Policy</h1>
		<p class="updated">Last updated: {LAST_UPDATED}</p>

		<p>
			This policy explains what personal data Feynman Circuits ("we", "us") collects, why we collect
			it, who we share it with, and what rights you have. Feynman Circuits is run by
			{@render fill(OPERATOR)}. If you have any question about your data, email us at
			{@render contact()}.
		</p>

		<p class="summary">
			<strong>In short:</strong> you can use the circuit builder without an account, and then we
			store nothing about you. If you create an account, we store your name, email, a scrambled
			(hashed) copy of your password and the circuits you save. We don't show ads, we don't use
			analytics or tracking cookies, and we never sell your data. You can delete your account and
			all your circuits at any time from <em>My Account</em>.
		</p>

		<h2>1. What we collect</h2>

		<h3>If you create an account</h3>
		<ul>
			<li><strong>Your email address</strong>, used to sign in and to send you account emails.</li>
			<li><strong>Your first and last name.</strong></li>
			<li>
				<strong>Your password</strong>, but only as a one-way hash. We can't see or recover your
				real password.
			</li>
			<li>The date your account was created and last changed.</li>
		</ul>

		<h3>Circuits you save</h3>
		<ul>
			<li>
				The circuit itself, its name and description, whether it is public or private, and when it
				was created and last changed.
			</li>
			<li>
				If you make a circuit <strong>public</strong>, anyone with its link can open it. Your name
				and email are never shown with a public circuit.
			</li>
			<li>
				Circuits you build without saving stay in your browser and are never sent to us. Simulations
				run in your browser too.
			</li>
		</ul>

		<h3>Share links</h3>
		<ul>
			<li>A link to a public circuit only contains the circuit's id.</li>
			<li>
				A link that holds the whole circuit (used when you share without saving) keeps the circuit
				after the <code>#</code> in the web address. Browsers never send that part to any server, so we
				never receive it.
			</li>
		</ul>

		<h3>Password resets</h3>
		<ul>
			<li>
				When you ask to reset your password, we store a 6-digit code, when it expires (after 10
				minutes) and how many times it was tried. We email the code to you.
			</li>
		</ul>

		<h3>Feedback</h3>
		<ul>
			<li>
				When you send feedback, what you type, and your name and email if you choose to add them, is
				sent to us by email. It is <strong>not</strong> stored in the app. You can send feedback without
				giving your name or email.
			</li>
		</ul>

		<h3>QEC experiments</h3>
		<ul>
			<li>
				When you run a QEC experiment, the settings you chose (number of rounds and where you placed
				errors) are sent to our server to be simulated. We don't store them, and they are not linked
				to your account.
			</li>
		</ul>

		<h3>Technical data</h3>
		<ul>
			<li>
				Like every website, the servers that host Feynman Circuits see your
				<strong>IP address</strong>, browser type and the time of each request. Our hosting
				providers may keep this in their server logs for a short time. We also use your IP address
				to limit how many requests can be made in an hour, to stop abuse.
			</li>
			<li>
				Your browser downloads the <strong>Inter font from Google Fonts</strong>, so Google receives
				your IP address when the page loads.
			</li>
		</ul>

		<h2>2. Cookies and browser storage</h2>
		<p>
			We only use what is needed for the site to work. There are no advertising or tracking cookies.
		</p>
		<div class="table-wrap">
			<table>
				<thead>
					<tr><th>Name</th><th>Type</th><th>What it is for</th><th>How long</th></tr>
				</thead>
				<tbody>
					<tr>
						<td><code>access_token</code></td>
						<td>Cookie</td>
						<td>Keeps you signed in. Only set when you sign in.</td>
						<td>30 minutes</td>
					</tr>
					<tr>
						<td><code>refresh_token</code></td>
						<td>Cookie</td>
						<td>Signs you back in when <code>access_token</code> runs out.</td>
						<td>7 days</td>
					</tr>
					<tr>
						<td><code>theme</code>, settings, tour progress, code panel view</td>
						<td>Local storage</td>
						<td>
							Remembers your light/dark theme, your settings, whether you have seen the tour, and
							which code view you picked. This stays on your device and is never sent to us.
						</td>
						<td>Until you clear it</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p>
			The two login cookies can't be read by JavaScript, and are only sent over a secure (HTTPS)
			connection. Because they are strictly needed to sign you in, they don't need your consent.
		</p>

		<h2>3. Why we use your data (legal bases)</h2>
		<ul>
			<li>
				<strong>To provide the service you asked for</strong> (creating your account, signing you in,
				saving your circuits, resetting your password). Under GDPR this is "performance of a contract".
			</li>
			<li>
				<strong>To keep the service safe</strong> (rate limits, stopping abuse, security emails such as
				"your password was changed"). Under GDPR this is our "legitimate interest".
			</li>
			<li>
				<strong>To answer your feedback</strong>, only if you chose to give your email. This is
				based on your consent, and you can take it back at any time.
			</li>
		</ul>
		<p>
			Under India's Digital Personal Data Protection Act, 2023, we process your data based on the
			consent you give when you create an account or send feedback, and for the purposes listed
			above only.
		</p>

		<h2>4. Who we share it with</h2>
		<p>
			We don't sell, rent or trade your personal data, and we don't share it for advertising. We
			only use these service providers, who handle data for us to run the site:
		</p>
		<ul>
			<li><strong>Vercel</strong>: serves the website to your browser.</li>
			<li><strong>Render</strong>: runs our backend server.</li>
			<li><strong>{@render fill(DATABASE_PROVIDER)}</strong>: stores our database.</li>
			<li>
				<strong>Resend</strong>: sends our emails (password reset codes, account emails, feedback).
			</li>
			<li><strong>Google Fonts</strong>: provides the font used on the site.</li>
		</ul>
		<p>
			We may also share data if the law requires it, for example because of a valid court order.
		</p>

		<h2>5. International transfers</h2>
		<p>
			Our service providers may store or process data in the United States and other countries.
			Where data from the EU, UK or India leaves those regions, we rely on the safeguards our
			providers offer, such as the European Commission's Standard Contractual Clauses.
		</p>

		<h2>6. How long we keep it</h2>
		<ul>
			<li>
				<strong>Account details and saved circuits:</strong> until you delete them or delete your account.
			</li>
			<li>
				<strong>Password reset codes:</strong> stop working after 10 minutes, and are deleted with your
				account.
			</li>
			<li>
				<strong>Login records:</strong> each login stops working after 7 days at most.
			</li>
			<li>
				<strong>Feedback emails:</strong> kept in our inbox only as long as we need them to handle your
				feedback. Ask us and we will delete them.
			</li>
			<li>
				<strong>Server logs and backups:</strong> kept by our hosting providers for a limited time under
				their own policies. Deleted data may stay in a backup for a short time before it is overwritten.
			</li>
		</ul>

		<h2>7. Your rights</h2>
		<p>Depending on where you live, you have some or all of these rights:</p>
		<ul>
			<li>
				<strong>See your data</strong>: ask us for a copy of the personal data we hold about you.
			</li>
			<li>
				<strong>Correct it</strong>: change your name in <em>My Account</em>, or ask us to fix
				anything else.
			</li>
			<li>
				<strong>Delete it</strong>: use <em>My Account → Delete Account</em>. This deletes your
				account and all your saved circuits straight away, and we send one last email to confirm
				what was deleted.
			</li>
			<li>
				<strong>Take it with you</strong>: download any circuit as JSON, OpenQASM or Qiskit from the
				code panel, or ask us for all your data.
			</li>
			<li>
				<strong>Object or limit</strong>: ask us to stop or limit how we use your data.
			</li>
			<li><strong>Take back consent</strong> at any time, for anything based on consent.</li>
			<li>
				<strong>Complain</strong> to your data protection authority (in the EU/UK), or to the Data Protection
				Board of India.
			</li>
		</ul>
		<p>
			<strong>India (DPDP Act):</strong> you can also name someone to use these rights for you if
			you die or become unable to. For any complaint about your data, contact our grievance contact, {@render fill(
				OPERATOR
			)}, at {@render contact()}. Please contact us before going to the Data Protection Board.
		</p>
		<p>
			<strong>California (CCPA):</strong> you have the right to know what personal information we collect,
			to delete it, to correct it, and not to be treated differently for using these rights. We do not
			sell or share personal information, as those words are defined in the CCPA.
		</p>
		<p>
			To use any of these rights, email {@render contact()}. We will reply within 30 days. We may
			ask you to confirm the request from your account's email address, to make sure it is really
			you.
		</p>

		<h2>8. How we protect your data</h2>
		<ul>
			<li>Passwords are stored only as a one-way hash.</li>
			<li>All traffic uses HTTPS, and the database connection is encrypted.</li>
			<li>Login cookies are secure and can't be read by JavaScript.</li>
			<li>Sign-in, password reset and feedback have rate limits to stop guessing and abuse.</li>
		</ul>
		<p>
			No system is perfectly secure. If a data breach affects your personal data, we will tell you
			and the authorities when the law requires it.
		</p>

		<h2>9. Children</h2>
		<p>
			You must be at least {MIN_AGE} to create an account, or have permission from a parent or guardian.
			We don't knowingly collect data from children under 13. If you think a child has given us their
			data, email {@render contact()} and we will delete it.
		</p>

		<h2>10. Changes to this policy</h2>
		<p>
			If we change this policy, we will update the date at the top of this page. If the change is
			important, we will also tell signed-in users in the app or by email.
		</p>

		<h2>11. Contact</h2>
		<p>
			{@render fill(OPERATOR)}<br />
			Email: {@render contact()}
		</p>
	</article>
</div>

<style>
	.page {
		background-color: var(--color-background);
		color: var(--color-text);
	}
	article {
		line-height: 1.65;
		font-size: 0.95rem;
	}
	h1 {
		font-size: 2rem;
		font-weight: 700;
		margin-top: 1.5rem;
		color: var(--color-branding);
	}
	h2 {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 2.25rem;
		margin-bottom: 0.5rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid var(--color-border);
	}
	h3 {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 1.25rem;
		margin-bottom: 0.25rem;
	}
	p {
		margin-top: 0.75rem;
	}
	ul {
		list-style: disc;
		padding-left: 1.25rem;
		margin-top: 0.5rem;
	}
	li {
		margin-top: 0.35rem;
	}
	a {
		color: var(--color-ternary-1);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.back {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.updated {
		font-size: 0.85rem;
		opacity: 0.7;
		margin-top: 0.25rem;
	}
	.summary {
		margin-top: 1.25rem;
		padding: 0.9rem 1rem;
		border-radius: 0.25rem;
		background-color: var(--color-surface);
		border-left: 4px solid var(--color-branding);
	}
	code {
		font-size: 0.85em;
		padding: 0.05rem 0.3rem;
		border-radius: 0.2rem;
		background-color: var(--color-surface);
	}
	.table-wrap {
		overflow-x: auto;
		margin-top: 0.75rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
		background-color: var(--color-surface);
	}
	th,
	td {
		text-align: left;
		vertical-align: top;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--color-border);
	}
	th {
		font-weight: 600;
	}
	/* Unfilled placeholders are bright so they can't be missed before publishing. */
	.placeholder {
		background-color: #fde047;
		color: #0f172a;
		padding: 0 0.2rem;
		border-radius: 0.15rem;
	}
</style>
