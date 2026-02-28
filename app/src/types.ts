export type ColorStop = { color: string; offset: number };
export type ColorValue = 
  | { type: 'solid'; color: string }
  | { type: 'gradient'; stops: ColorStop[] };
