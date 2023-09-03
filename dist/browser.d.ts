export type { ImageSource, Config };
import { Config } from './schema';
import { Imports } from './tensor';
type ImageSource = ImageData | ArrayBuffer | Uint8Array | Blob | URL | string;
interface configData {
    config: Config | undefined;
    imports: Imports;
    session: any;
}
declare class BackgroundRemoval {
    controller: any;
    imglyProcessor: configData | null;
    config: Config | null;
    loaded: boolean;
    session: any;
    imports: Imports | null;
    modelData: any;
    imageToProcess: any;
    constructor(config: Config | null);
    private loadModel;
    warmpUp(): Promise<void>;
    removeBackground(image: string): Promise<Blob | object | void>;
    cancelBackgroundRemoval(): void;
}
export default BackgroundRemoval;
