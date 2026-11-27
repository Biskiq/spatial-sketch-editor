import { run, timings } from './experiments.mjs';

self.onmessage = async ({ data }) => {
  try {
    const start = performance.now();
    const { default: Module } = await import('./.kernel/manifold.js');
    const api = await Module();
    api.setup();
    const workerInitMs = performance.now() - start;
    const { exact } = await run(api);
    const workerCorpusMs = performance.now() - start - workerInitMs;
    self.postMessage({ exact, workerInitMs, workerCorpusMs, performance: data.timings ? timings(api) : undefined });
  } catch (error) {
    self.postMessage({ error: error.stack ?? String(error) });
  }
};
