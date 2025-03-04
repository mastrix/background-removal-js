// Exports
export type { ImageSource, Config };

// Imports
import { runInference } from './inference';
import { Config, validateConfig } from './schema';
import { createOnnxRuntime } from './ort-web-rt';
import * as utils from './utils';
import { Imports } from './tensor';

import memoize from 'lodash/memoize';

type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;


async function createSession(config: Config, imports: Imports) {
  if (config.debug) console.debug('Loading model...');
  const arrayBuffer = await utils.modelToBuffer(config);
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

async function removeBackgroundInternal(
  image: ImageSource,
  configuration: configData
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
  imglyProcessor: configData | null = null;
  config: Config | null = null;
  loaded: boolean = false;
  session: any = null;
  imports: Imports | null = null;
  modelData: any = null;
  imageToProcess: any = null;

  constructor(config: Config | null) {
    this.config = config;
    this.imglyProcessor = null;
    this.loaded = false;
  }

  private async loadModel(): Promise<any> {
    if (this.config?.debug) {
      console.debug('Preloading model with config:', this.config);
    }
    // @ts-ignore
    const { imports, session, config } = await init(this.config);
    this.session = session;
    this.imports = imports;
    // this.modelData = utils.modelData.model;
    this.imglyProcessor = {
      imports: this.imports,
      session: this.session,
      config
    };

    this.loaded = true;
    return this.imglyProcessor;
  }

  async warmpUp() {
    await this.loadModel();
    return;
  }

  async removeBackground(image: string): Promise<Blob | object | void> {
    if (!this.loaded) {
      await this.loadModel();
    }
    if (this.session && this.imageToProcess) {
      // @ts-ignore
      const modelData = await utils.modelToBuffer(this.config);

      // @ts-ignore
      this.session = await this.imports.createSession(modelData);
    }

    this.imageToProcess = image;

    // @ts-ignore
    const result = await removeBackgroundInternal(
      image,
      // @ts-ignore
      this.imglyProcessor
    );
    return result;
  }
}

export default BackgroundRemoval;
