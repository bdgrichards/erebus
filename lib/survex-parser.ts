import { SurvexData, SurvexHeader, SurvexStation, SurvexLeg, SurvexItemType, SurvexItem, SurvexPoint } from './survex-types';

export class SurvexParser {
  private data: Uint8Array;
  private position: number = 0;
  private stations: Map<string, SurvexPoint> = new Map();
  private currentStation: string = '';
  private currentPoint: SurvexPoint = { x: 0, y: 0, z: 0 };

  constructor(data: Uint8Array) {
    this.data = data;
  }

  parse(): SurvexData {
    this.position = 0;
    this.stations.clear();
    this.currentStation = '';
    this.currentPoint = { x: 0, y: 0, z: 0 };

    console.log('Survex parse started, file size:', this.data.length);

    const header = this.parseHeader();
    const items = this.parseItems();
    const { stations, legs } = this.processItems(items);
    
    console.log('Parse complete:', stations.length, 'stations,', legs.length, 'legs');
    
    const bounds = this.calculateBounds(stations);

    return {
      header,
      stations,
      legs,
      bounds,
    };
  }

  private parseHeader(): SurvexHeader {
    // Read file ID
    const fileId = this.readString('\n');
    if (!fileId.startsWith('Survex 3D Image File')) {
      throw new Error('Invalid Survex file format');
    }

    // Read version
    const version = this.readString('\n');
    if (!version.startsWith('v')) {
      throw new Error('Invalid version format');
    }

    // Read title
    const title = this.readString('\0');

    // Read separator (usually '.')
    const separator = this.readString('\0');

    // Read timestamp (32-bit Unix timestamp)
    const timestamp = new Date(this.readUint32() * 1000);

    // Read flags
    const flags = this.readUint8();

    return {
      fileId,
      version,
      title,
      separator,
      timestamp,
      flags,
    };
  }

  private parseItems(): SurvexItem[] {
    const items: SurvexItem[] = [];
    
    while (this.position < this.data.length) {
      try {
        const item = this.parseItem();
        if (item) {
          items.push(item);
        }
      } catch (error) {
        // Only log non-EOF errors as errors, EOF is expected at end of file
        if (error.message !== 'End of file') {
          console.error('Parse error:', error);
        }
        break;
      }
    }
    return items;
  }

  private parseItem(): SurvexItem | null {
    if (this.position >= this.data.length) {
      return null;
    }

    const type = this.readUint8();
    
    switch (type) {
      case SurvexItemType.MOVE:
        return this.parseMove();
      case SurvexItemType.LINE:
        return this.parseLine();
      case SurvexItemType.LABEL:
        return this.parseLabel();
      case SurvexItemType.STOP:
        return { type: SurvexItemType.STOP };
      default:
        // Skip unknown items
        return null;
    }
  }

  private parseMove(): SurvexItem {
    const x = this.readInt32();
    const y = this.readInt32();
    const z = this.readInt32();
    
    this.currentPoint = { x, y, z };
    
    return {
      type: SurvexItemType.MOVE,
      point: { ...this.currentPoint },
    };
  }

  private parseLine(): SurvexItem {
    const dx = this.readInt32();
    const dy = this.readInt32();
    const dz = this.readInt32();
    
    const fromPoint = { ...this.currentPoint };
    
    this.currentPoint.x += dx;
    this.currentPoint.y += dy;
    this.currentPoint.z += dz;
    
    return {
      type: SurvexItemType.LINE,
      point: { ...this.currentPoint },
    };
  }

  private parseLabel(): SurvexItem {
    const x = this.readInt32();
    const y = this.readInt32();
    const z = this.readInt32();
    const flags = this.readUint32();
    const label = this.readString('\0');
    
    // Ensure label is always a valid string
    const safeLabel = (label || '').trim();
    
    const point = { x, y, z };
    this.stations.set(safeLabel, point);
    
    return {
      type: SurvexItemType.LABEL,
      point,
      label: safeLabel,
      flags,
    };
  }

  private processItems(items: SurvexItem[]): { stations: SurvexStation[]; legs: SurvexLeg[] } {
    const stations: SurvexStation[] = [];
    const legs: SurvexLeg[] = [];
    
    let currentPoint: SurvexPoint = { x: 0, y: 0, z: 0 };
    let previousPoint: SurvexPoint | null = null;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      switch (item.type) {
        case SurvexItemType.MOVE:
          if (item.point) {
            previousPoint = { ...currentPoint }; // Save current as previous
            currentPoint = { ...item.point };
          }
          break;
          
        case SurvexItemType.LINE:
          if (item.point) {
            const fromPoint = { ...currentPoint };
            currentPoint = { ...item.point };
            
            // Create a leg from previous position to new position
            legs.push({
              fromStation: '',
              toStation: '',
              fromX: fromPoint.x,
              fromY: fromPoint.y,
              fromZ: fromPoint.z,
              toX: currentPoint.x,
              toY: currentPoint.y,
              toZ: currentPoint.z,
              flags: 0,
            });
            
            previousPoint = fromPoint;
          }
          break;
          
        case SurvexItemType.LABEL:
          if (item.point && item.label) {
            // Ensure the label is always a valid string
            const safeName = (item.label || '').toString();
            stations.push({
              name: safeName,
              x: item.point.x,
              y: item.point.y,
              z: item.point.z,
              flags: item.flags || 0,
            });
          }
          break;
      }
    }
    return { stations, legs };
  }

  private calculateBounds(stations: SurvexStation[]) {
    if (stations.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
    }

    let minX = stations[0].x;
    let maxX = stations[0].x;
    let minY = stations[0].y;
    let maxY = stations[0].y;
    let minZ = stations[0].z;
    let maxZ = stations[0].z;

    for (const station of stations) {
      minX = Math.min(minX, station.x);
      maxX = Math.max(maxX, station.x);
      minY = Math.min(minY, station.y);
      maxY = Math.max(maxY, station.y);
      minZ = Math.min(minZ, station.z);
      maxZ = Math.max(maxZ, station.z);
    }

    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  // Binary reading utilities
  private readUint8(): number {
    if (this.position >= this.data.length) {
      throw new Error('End of file');
    }
    return this.data[this.position++];
  }

  private readUint32(): number {
    if (this.position + 4 > this.data.length) {
      throw new Error('End of file');
    }
    const value = new DataView(this.data.buffer, this.position, 4).getUint32(0, true); // little endian
    this.position += 4;
    return value;
  }

  private readInt32(): number {
    if (this.position + 4 > this.data.length) {
      throw new Error('End of file');
    }
    const value = new DataView(this.data.buffer, this.position, 4).getInt32(0, true); // little endian
    this.position += 4;
    return value;
  }

  private readString(delimiter: string): string {
    try {
      const start = this.position;
      const delimiterCode = delimiter.charCodeAt(0);
      
      while (this.position < this.data.length && this.data[this.position] !== delimiterCode) {
        this.position++;
      }
      
      if (this.position >= this.data.length && delimiter !== '\0') {
        throw new Error('End of file while reading string');
      }
      
      const str = new TextDecoder('utf-8', { fatal: false }).decode(this.data.slice(start, this.position));
      
      if (this.position < this.data.length) {
        this.position++; // Skip delimiter
      }
      
      // Ensure we always return a string, never undefined/null
      return str || '';
    } catch (error) {
      console.error('Error in readString:', error);
      return '';
    }
  }
}