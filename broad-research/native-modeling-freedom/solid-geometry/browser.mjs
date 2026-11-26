import { run } from './experiments.mjs';

const result = document.querySelector('#result');
const params = new URLSearchParams(location.search);

try {
  const start = performance.now();
  const { default: Module } = await import('./.kernel/manifold.js');
  const api = await Module();
  api.setup();
  const pageInitMs = performance.now() - start;
  const { exact } = await run(api);
  const golden = await (await fetch('./goldens.json')).json();
  if (JSON.stringify(exact) !== JSON.stringify(golden)) throw new Error('Page exact golden mismatch');
  const workerStart = performance.now();
  const worker = new Worker('./worker.mjs', { type: 'module' });
  let measured;
  try {
    measured = await new Promise((resolve, reject) => {
      worker.onerror = event => reject(new Error(event.message));
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve({
        ...data, workerRoundTripMs: performance.now() - workerStart,
      });
      worker.postMessage({ timings: params.has('timings') });
    });
  } finally {
    worker.terminate();
  }
  if (JSON.stringify(exact) !== JSON.stringify(measured.exact)) throw new Error('Worker exact golden mismatch');
  const evidence = { userAgent: navigator.userAgent, pageInitMs, ...measured };
  result.textContent = JSON.stringify(evidence, null, 2);
  result.dataset.verdict = 'pass';
} catch (error) {
  result.textContent = error.stack ?? String(error);
  result.dataset.verdict = 'fail';
}
if (params.has('post')) {
  await fetch('/report', { method: 'POST', body: JSON.stringify({ verdict: result.dataset.verdict, content: result.textContent }) });
}
