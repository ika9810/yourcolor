// Runs entirely in a local Web Worker. No image data is sent over the network.
import * as ort from '../vendor/onnxruntime-web-1.22.0/ort.wasm.min.mjs';

ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
ort.env.wasm.wasmPaths = new URL('../vendor/onnxruntime-web-1.22.0/', import.meta.url).href;
let session;
let queue = Promise.resolve();

async function segment({id, pixels}) {
  const start = performance.now();
  try {
    if (!session) {
      postMessage({id, status: 'loading'});
      session = await ort.InferenceSession.create(new URL('../models/u2netp.onnx', import.meta.url).href, {
        executionProviders: ['wasm'], graphOptimizationLevel: 'all'
      });
    }
    postMessage({id, status: 'running'});
    const rgba = new Uint8ClampedArray(pixels);
    const size = 320 * 320;
    const input = new Float32Array(size * 3);
    const mean = [.485, .456, .406], std = [.229, .224, .225];
    let max = 1;
    for (let i = 0; i < size; i++) for (let c = 0; c < 3; c++) max = Math.max(max, rgba[i * 4 + c]);
    for (let c = 0; c < 3; c++) for (let i = 0; i < size; i++) {
      input[c * size + i] = (rgba[i * 4 + c] / max - mean[c]) / std[c];
    }
    const tensor = new ort.Tensor('float32', input, [1, 3, 320, 320]);
    let outputs;
    try {
      outputs = await session.run({[session.inputNames[0]]: tensor});
      const data = outputs[session.outputNames[0]].data;
      let low = Infinity, high = -Infinity;
      for (const v of data) { low = Math.min(low, v); high = Math.max(high, v); }
      if (!Number.isFinite(high) || high - low < 1e-5) throw new Error('Empty mask');
      const alpha = new Uint8ClampedArray(size);
      let selected = 0;
      for (let i = 0; i < size; i++) {
        // Suppress background haze while retaining a soft edge.
        const t = Math.max(0, Math.min(1, ((data[i] - low) / (high - low) - .1) / .8));
        alpha[i] = Math.round(t * t * (3 - 2 * t) * 255);
        if (alpha[i] > 127) selected++;
      }
      const coverage = selected / size;
      if (coverage < .002 || coverage > .98) throw new Error('No distinct subject');
      postMessage({id, status: 'ready', alpha: alpha.buffer, elapsed: performance.now() - start, coverage}, [alpha.buffer]);
    } finally {
      tensor.dispose();
      if (outputs) Object.values(outputs).forEach(output => output.dispose());
    }
  } catch (error) {
    postMessage({id, status: 'error', message: String(error?.message || error)});
  }
}

self.onmessage = ({data}) => { queue = queue.then(() => segment(data)); };
