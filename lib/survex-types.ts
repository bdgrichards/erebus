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
  // Style items
  NORMAL_STYLE = 0x00,
  DIVING_STYLE = 0x01,
  CARTESIAN_STYLE = 0x02, 
  CYLINDER_STYLE = 0x03,
  NOSURVEY_STYLE = 0x04,
  
  // Movement and positioning
  MOVE = 0x0f,
  
  // Date items
  DATE1 = 0x10,
  DATE2 = 0x11,
  
  // Error information
  ERROR_INFO = 0x1f,
  
  // Cross-sections
  XSECT = 0x30,
  XSECT_END = 0x31,
  
  // Line segments (0x40-0x7f)
  LINE_START = 0x40,
  LINE_END = 0x7f,
  
  // Station labels (0x80-0xff)
  LABEL_START = 0x80,
  LABEL_END = 0xff,
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