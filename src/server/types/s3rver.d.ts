/**
 * `s3rver` ships no types of its own. Declared just deep enough for what the
 * backup integration test actually calls — it exists in `devDependencies`
 * purely as a stand-in S3 server for that one test file, never in anything
 * that ships.
 */
declare module "s3rver" {
  interface S3rverOptions {
    port?: number;
    address?: string;
    silent?: boolean;
    directory?: string;
    vhostBuckets?: boolean;
    resetOnClose?: boolean;
    configureBuckets?: Array<{ name: string; configs?: Array<string | Buffer> }>;
  }

  interface S3rverInfo {
    address: string;
    port: number;
  }

  export default class S3rver {
    constructor(options?: S3rverOptions);
    run(): Promise<S3rverInfo>;
    close(): Promise<void>;
  }
}
