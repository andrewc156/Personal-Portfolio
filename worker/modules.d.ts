// dist/_headers is imported as a string by wrangler's `Text` module rule (wrangler.jsonc).
declare module '*/_headers' {
  const text: string;
  export default text;
}
