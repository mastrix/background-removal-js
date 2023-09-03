export { preload, load };
import { Config } from './schema';
type Entry = {
    url: string;
    size: number;
    mime: string;
    blobUrl: any;
};
declare function load(key: string, config: Config): Promise<any>;
declare function preload(config: Config): Promise<Map<string, Entry>>;
