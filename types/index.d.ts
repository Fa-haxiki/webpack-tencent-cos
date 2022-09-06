type CosPluginOptions = {
  path?: string;
  batch?: number;
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  setCosPath: (filePath: string) => string;
}

declare class CosPlugin {
  private options;
  constructor(options: CosPluginOptions | undefined);
  apply(compiler: any): void;
}

export = CosPlugin;
