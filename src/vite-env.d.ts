/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module "mammoth" {
  export function extractRawText(options: { arrayBuffer?: ArrayBuffer; buffer?: Buffer }): Promise<{ value: string; messages: any[] }>;
  export function convertToHtml(options: { arrayBuffer?: ArrayBuffer; buffer?: Buffer }): Promise<{ value: string; messages: any[] }>;
}
