export interface NativeParam {
  name: string;
  type: string;
  description?: string;
}

export interface NativeFunction {
  id: string;
  name: string;
  luaName: string;
  namespace: string;
  hash: string;
  altHash?: string;
  signature: string;
  returnType: string;
  params: NativeParam[];
  description: string;
  examples?: string;
}

export interface NativesDatabase {
  version: string;
  generatedAt: string;
  source: string;
  count: number;
  namespaces: string[];
  natives: NativeFunction[];
}