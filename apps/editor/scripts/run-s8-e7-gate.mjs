#!/usr/bin/env node
/**
 * Dev-only E7 gate runner: `/dev/materials?gate=e7` on each Chromium backend.
 *
 * Its checks are technical: a pass is not acceptance of F's catalogue intake.
 * It records exactly what completed. A case that did not run, observed another
 * backend, or logged an error is never recorded as a pass.
 *
 * Usage (from `apps/editor`, with the dev server running):
 *   node scripts/run-s8-e7-gate.mjs [--out evidence.json] [--shots directory]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BACKENDS, launch, openMaterials } from './s8-e7-browser.mjs';

function option(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}
const out = option('--out');
const shots = option('--shots');

const SCOPE = "automated technical checks; not acceptance of F's catalogue intake";
const cases = {};
for (const name of Object.keys(BACKENDS)) {
	let browser;
	try {
		browser = await launch(name);
		const { context, page, errors } = await openMaterials(browser, name, '?gate=e7');
		const result = JSON.parse(await page.locator('main').getAttribute('data-e7-result'));
		await context.close();
		// The gate's last check loses the device on purpose; Three logs that loss once.
		const provoked = errors.findIndex((message) => /Device Lost/.test(message));
		const expectedErrors = provoked < 0 ? [] : errors.splice(provoked, 1);
		const entry = {
			requested: name,
			browser: `Chromium ${browser.version()}`,
			pass: result.pass && result.backend === name && errors.length === 0,
			expectedErrors,
			errors,
			result
		};
		cases[name] = entry;
		if (shots !== null) {
			const visit = await openMaterials(browser, name);
			await visit.page.waitForSelector('main[data-e7-status="ready"]', { timeout: 30_000 });
			await visit.page.locator('label:has-text("Lighting") select').selectOption('world');
			await visit.page.waitForTimeout(1500);
			await visit.page.screenshot({
				path: resolve(shots, `s8-e7-${name}-world.jpg`),
				type: 'jpeg',
				quality: 80,
				fullPage: true
			});
			await visit.context.close();
		}
	} catch (error) {
		cases[name] = { ...cases[name], requested: name, pass: false, error: error instanceof Error ? error.message : String(error) };
	} finally {
		await browser?.close();
	}
	console.log(`${name}: ${cases[name].pass ? 'pass' : 'FAIL'}`);
	for (const check of cases[name].result?.checks ?? []) {
		console.log(`  ${check.pass ? 'ok  ' : 'FAIL'} ${check.id}${check.pass ? '' : ` ${JSON.stringify(check.measured)}`}`);
	}
	if (cases[name].error) console.log(`  ${cases[name].error}`);
	if (cases[name].errors?.length) console.log(`  errors: ${JSON.stringify(cases[name].errors)}`);
}

const pass = Object.values(cases).every((entry) => entry.pass);
if (out !== null) {
	writeFileSync(resolve(out), `${JSON.stringify({ scope: SCOPE, capturedAt: new Date().toISOString(), pass, cases }, null, 2)}\n`);
}
if (!pass) process.exitCode = 1;
