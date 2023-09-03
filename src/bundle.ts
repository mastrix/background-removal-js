// @ts-nocheck
import localforage from 'localforage';

const filesStorage = localforage.createInstance({
  name: 'files-storage',
  version: 1.0,
  description: 'Main storage to store background removal files'
});

export { preload, load };

import { Config } from './schema';

type Entry = {
  url: string;
  size: number;
  mime: string;
  blobUrl: any;
};

const bundle: Map<string, Entry> = new Map([
  [
    'small',
    {
      url: require('../bundle/models/a620c8c752bdf5c69d98.onnx'),
      size: 44342436,
      mime: 'application/octet-stream',
      blob: null
    }
  ],
  [
    'medium',
    {
      url: require('../bundle/models/2ebb460f4adfe0ebf34d.onnx'),
      size: 88188479,
      mime: 'application/octet-stream',
      blob: null
    }
  ],
  [
    'ort-wasm-simd-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'),
      size: 10281838,
      mime: 'application/wasm',
      blob: null
    }
  ],
  [
    'ort-wasm-simd.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm'),
      size: 10335238,
      mime: 'application/wasm',
      blob: null
    }
  ],
  [
    'ort-wasm-threaded.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm-threaded.wasm'),
      size: 9413659,
      mime: 'application/wasm',
      blob: null
    }
  ],
  [
    'ort-wasm.wasm',
    {
      url: require('../node_modules/onnxruntime-web/dist/ort-wasm.wasm'),
      size: 9487920,
      mime: 'application/wasm',
      blob: null
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

  const storedFile = await filesStorage.getItem(key);

  const defaultFetchOptions = {
    cache: 'force-cache',
    headers: {
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'public, max-age=48000, must-revalidate',
      'If-Modified-Since': storedFile?.lastModifiedDate
    }
  };

  // assuring that we're not refetching the same thing
  let data;
  let lastModifiedDate;

  if (storedFile?.file) {
    return storedFile?.file;
  } else {
    const fetchedFile = await fetch(`${url}`, {
      ...defaultFetchOptions,
      ...userConfig
    });

    if (fetchedFile.status === 200) {
      lastModifiedDate = fetchedFile.headers.get('Last-Modified');
    }

    if (config.progress) {
      const chunkedData = await fetchChunked(fetchedFile, entry, config, key);
      data = await new Blob(chunkedData, { type: entry.mime });
    } else {
      if (
        fetchedFile.body &&
        typeof fetchedFile.body.getReader === 'function'
      ) {
        const reader = fetchedFile.body.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          chunks.push(value);
        }
        data = new Blob(chunks, { type: entry.mime });
      } else {
        data = await fetchedFile.blob();
      }
    }

    if (data.size !== entry.size) {
      throw new Error(
        `Failed to fetch ${key} with size ${entry.size} but got ${data.size}`
      );
    }

    if (!storedFile?.file) {
      // lets set the blob to cache it to avoid refetch at all
      filesStorage.setItem(key, {
        file: data,
        lastModifiedDate: lastModifiedDate || entry.lastModifiedDate
      });
    }

    return data;
  }
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
