import {
  imageDataResize,
  imageDataToFloat32Array,
  calculateProportionalSize
} from './utils';
import { Imports } from './tensor';
import { Config } from './schema';

export async function runInference(
  imageData: ImageData,
  config: Config,
  imports: Imports,
  session: any
): Promise<ImageData> {
  if (config.progress) config.progress('compute:inference', 0, 1);
  const resolution = 1024;
  const src_width = imageData.width;
  const src_height = imageData.height;

  const dims = [1, 3, resolution, resolution];

  if (!imports || !session) return imageData;

  let tensorImage = await imageDataResize(imageData, resolution, resolution);
  const inputTensorData = imageDataToFloat32Array(tensorImage);

  const predictionsDict = await imports.runSession(
    session,
    [['input', { data: inputTensorData, shape: dims, dataType: 'float32' }]],
    ['output']
  );

  const stride = resolution * resolution;

  for (let i = 0; i < 4 * stride; i += 4) {
    let idx = i / 4;
    let alpha = predictionsDict[0].data[idx];
    tensorImage.data[i + 3] = alpha * 255;
  }

  const [width, height] = calculateProportionalSize(
    imageData.width,
    imageData.height,
    resolution,
    resolution
  );

  const dst_width = Math.min(width, src_width);
  const dst_height = Math.min(height, src_height);

  tensorImage = await imageDataResize(tensorImage, dst_width, dst_height);
  if (config.progress) config.progress('compute:inference', 1, 1);
  return tensorImage;
}
