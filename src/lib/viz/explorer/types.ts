/**
 * Shapes of the Colorado data files in public/data/colorado/ (written by pipeline/build_colorado.py,
 * documented in docs/data.md). Only the fields the explorer reads are typed.
 */

export interface ColoradoMeta {
  label: string;
  bbox: [number, number, number, number];
  bboxOrder: string;
  center: { lat: number; lon: number };
  width: number;
  height: number;
  cells: number;
  cellDeg: number;
  rowOrder: string;
  dtype: string;
  units: string;
  cellCenter: string;
  edgeBlocks: { lastColumnNativePx: number; lastRowNativePx: number };
  min: { value: number; cell: number; x: number; y: number; lat: number; lon: number };
  max: { value: number; cell: number; x: number; y: number; lat: number; lon: number };
  crs: string;
  verticalDatum: string;
  connectivity: number;
  tieBreak: string;
  native: {
    width: number;
    height: number;
    pixelDeg: number;
    /** Pixel-edge extent of the clipped native raster: [W, S, E, N]. */
    extent: [number, number, number, number];
  };
  derived: {
    spanDeg: { lon: number; lat: number };
    spanKm: { eastWestAtCenterLat: number; northSouth: number };
    displayAspect: number;
    displayAspectNote: string;
  };
  source: {
    name: string;
    url: string;
    registry: string;
    surfaceModel: string;
    verticalAccuracy: string;
    productHandbook: string;
  };
  licence: { name: string; url: string; requiredNotice: string; citationDoi: string };
  processing: string[];
  limitations: string[];
  hillshade: {
    file: string;
    width: number;
    height: number;
    cellDeg: number;
    extent: [number, number, number, number];
  };
  files: Record<string, { bytes: number; sha256?: string }>;
  barcode: { file: string; count: number; minPersistence: number; gridSha256: string };
  generatedAt: string;
}

/** barcode.json: columnar bars (see docs/data.md "barcode.json format"). */
export interface BarcodeFile {
  format: string;
  units: string;
  connectivity: number;
  minPersistence: number;
  grid: { file: string; width: number; height: number; bytes: number; sha256: string };
  count: number;
  stats: {
    cells: number;
    births: number;
    finiteBars: number;
    positiveBars: number;
    zeroLengthBars: number;
    exportedFinite: number;
    essential: number;
  };
  essential: { birthCell: number; birth: number };
  b: number[];
  d: (number | null)[];
  bi: number[];
  di: number[];
  mi: number[];
}
