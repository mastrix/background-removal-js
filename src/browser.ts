// Exports
export type { ImageSource, Config };

// Imports
import { runInference } from './inference';
import { Config, validateConfig } from './schema';
import { createOnnxRuntime } from './ort-web-rt';
import * as utils from './utils';
import * as Bundle from './bundle';
import { Imports } from './tensor';

import memoize from 'lodash/memoize';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;

async function createSession(config: Config, imports: Imports) {
  if (config.debug) console.debug('Loading model...');
  const model = config.model;
  const blob = await Bundle.load(model, config);
  const arrayBuffer = await blob.arrayBuffer();
  const session = await imports.createSession(arrayBuffer);
  return session;
}

async function _init(config?: Config) {
  config = validateConfig(config);
  const imports = createOnnxRuntime(config);
  const session = await createSession(config, imports);
  return { config, imports, session };
}

const init = memoize(_init, (config) => JSON.stringify(config));

interface configData {
  config: Config | undefined;
  imports: Imports;
  session: any;
}

async function removeBackground(
  image: ImageSource,
  configuration: configData,
): Promise<Blob | object> {
  const {
    config = {
      debug: false,
      proxyToWorker: false,
      model: 'medium',
      fetchArgs: {},
      progress: undefined,
      publicPath: undefined
    },
    imports,
    session
  } = configuration;

  console.log('imports', imports);
  console.log('session', session);

  if (config?.debug) {
    config.progress =
      config?.progress ??
      ((key, current, total) => {
        console.debug(`Downloading ${key}: ${current} of ${total}`);
      });

    if (!crossOriginIsolated) {
      console.debug(
        'Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.'
      );
    }
  }

  image = await utils.imageSourceToImageData(image);

  if (!(image instanceof ImageData)) {
    throw new Error(
      'Image not an ImageData | ArrayBuffer | Uint8Array | Blob | URL | string'
    );
  }

  const imageData = await runInference(image, config, imports, session);

  return await utils.imageEncode(imageData);
}

class BackgroundRemoval {
  controller: AbortController | null = null;
  imglyProcessor: configData | null = null;
  config: Config | null = null;
  loaded: boolean = false;

  constructor(config: Config | null) {
    this.config = config;
    this.controller = null || new AbortController();
    this.imglyProcessor = null;
    this.loaded = false;
  }

  private async loadModel(): Promise<any> {
    if (this.config?.debug) {
      console.debug('Preloading model...');
    }
    this.loaded = true;
    this.imglyProcessor = await init(this.config || undefined);
    return this.imglyProcessor;
  }

  async warmpUp() {
    await this.loadModel();
    return;
  };

  async removeBackground(image: string): Promise<Blob | object | void> {
    if (!this.loaded) {
      const imglyProcessor = await this.loadModel();
      this.controller = new AbortController();
      const { signal } = this.controller;
      console.log('signal', signal);
      const result = await removeBackground(image, imglyProcessor);
      this.controller = null;
      return result;
    }
  }

  cancelBackgroundRemoval(): void {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}

export default BackgroundRemoval;
