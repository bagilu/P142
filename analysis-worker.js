import { analyzeSamples } from './dsp.js?v=0.002';
self.onmessage = ({ data }) => {
  try {
    const result = analyzeSamples(data.samples, data.sampleRate, data.options, progress => self.postMessage({ type: 'progress', progress }));
    self.postMessage({ type: 'complete', result });
  } catch (error) { self.postMessage({ type: 'error', message: error.message || '分析未完成' }); }
};
