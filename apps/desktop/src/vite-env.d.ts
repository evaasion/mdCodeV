/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "@mdcodev/natives-core/data" {
  import type { NativesDatabase } from "@mdcodev/natives-core";
  const data: NativesDatabase;
  export default data;
}