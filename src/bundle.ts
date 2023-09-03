export { preload, load };

import { Config } from './schema';

type Entry = {
  url: string;
  size: number;
  mime: string;
};

const bundle: Map<string, Entry> = new Map([
  [
    'small',
    {
      url: require('../bundle/models/a620c8c752bdf5c69d98.onnx'),
      size: 44342436,
      mime: 'application/octet-stream'
    }
  ],
  [
    'medium',
    {
      url: require('../bundle/models/2ebb460f4adfe0ebf34d.onnx'),
      size: 88188479,
      mime: 'application/octet-stream'
    }
  ],
  [
    'ort-wasm-simd-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
      size: 10281838,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-simd.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'),
      size: 10335238,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm'),
      size: 9413659,
      mime: 'application/wasm'
    }
  ],
  [
    'ort-wasm.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm.wasm'),
      size: 9487920,
      mime: 'application/wasm'
    }
  ]
]);

async function load(key: string, config: Config) {
  const entry = bundle.get(key)!;
  let url = entry.url;
  if (config.publicPath) {
    url = new URL(url.split('/').pop()!, config.publicPath).toString();
  }

  const userConfig = config.fetchArgs ?? {};

  const defaultFetchOptions = {
    headers: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=3600',
      'If-Modified-Since': new Date().toUTCString()
    }
  };

  console.log('config', { config });
  console.log({ url, publicPath: config.publicPath, entry: entry.url });

  const response = await fetch(url, {
    ...userConfig,
    ...defaultFetchOptions
  });

  const chunks = config.progress
    ? await fetchChunked(response, entry, config, key)
    : [await response.blob()];

  const data = new Blob(chunks, { type: entry.mime });
  if (data.size !== entry.size) {
    throw new Error(
      `Failed to fetch ${key} with size ${entry.size} but got ${data.size}`
    );
  }
  return data;
}

async function fetchChunked(
  response: Response,
  entry: any,
  config: Config,
  key: string
) {
  const reader = response.body!.getReader();
  // let contentLength = Number(response.headers.get('Content-Length'));
  const contentLength = entry.size ?? 0;
  let receivedLength = 0;

  let chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    receivedLength += value.length;
    if (config.progress)
      config.progress(`fetch:${key}`, receivedLength, contentLength);
  }
  return chunks;
}

async function preload(config: Config) {
  // This will warmup the caches
  let result = new Map(bundle);
  result.forEach(async (_, key) => {
    await load(key, config);
  });
  return result;
}
