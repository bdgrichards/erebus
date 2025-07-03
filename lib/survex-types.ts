// TypeScript types for Survex 3D file format
export interface SurvexHeader {
  fileId: string;
  version: string;
  title: string;
  separator: string;
  timestamp: Date;
  flags: number;
}

export interface SurvexStation {
  name: string;
  x: number;
  y: number;
  z: number;
  flags: number;
}

export interface SurvexLeg {
  fromStation: string;
  toStation: string;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  flags: number;
}

export interface SurvexData {
  header: SurvexHeader;
  stations: SurvexStation[];
  legs: SurvexLeg[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export enum SurvexItemType {
  MOVE = 0,
  LINE = 1,
  LABEL = 2,
  STOP = 3,
  STYLE = 4,
  XSECT = 5,
  XSECT_END = 6,
  PASSAGE = 7,
  SURFACE = 8,
  UNDERGROUND = 9,
  COLLINE = 10,
  NOSURFACE = 11,
  NOSURVEY = 12,
  PASSAGE_END = 13,
  SURFACE_END = 14,
  UNDERGROUND_END = 15,
  COLLINE_END = 16,
  NOSURFACE_END = 17,
  NOSURVEY_END = 18,
}

export interface SurvexPoint {
  x: number;
  y: number;
  z: number;
}

export interface SurvexItem {
  type: SurvexItemType;
  point?: SurvexPoint;
  label?: string;
  flags?: number;
}