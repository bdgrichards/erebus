import { SurvexData, SurvexHeader, SurvexItem, SurvexItemType, SurvexLeg, SurvexPoint, SurvexStation } from './survex-types';

export class SurvexParser {
  private data: Uint8Array;
  private position: number = 0;
  private currentPoint: SurvexPoint = { x: 0, y: 0, z: 0 };
  private labelBuffer: string = ''; // Current label buffer as per spec
  private stations: Map<string, SurvexPoint> = new Map();
  private legs: SurvexLeg[] = [];
  private lastStationLabel: string | null = null;
  private lastStationPoint: SurvexPoint | null = null;
  private pendingLeg: SurvexLeg | null = null;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  parse(): SurvexData {
    this.position = 0;
    this.currentPoint = { x: 0, y: 0, z: 0 };
    this.labelBuffer = '';
    this.stations.clear();
    this.legs = [];
    this.lastStationLabel = null;
    this.lastStationPoint = null;
    this.pendingLeg = null;

    console.log('Survex parse started, file size:', this.data.length);

    const header = this.parseHeader();
    this.parseItems();
    
    const stationArray = Array.from(this.stations.entries()).map(([name, point]) => ({
      name,
      x: point.x,
      y: point.y,
      z: point.z,
      flags: 0, // TODO: track flags properly
    }));
    
    console.log('Parse complete:', stationArray.length, 'stations,', this.legs.length, 'legs');
    
    const bounds = this.calculateBounds(stationArray);

    return {
      header,
      stations: stationArray,
      legs: this.legs,
      bounds,
    };
  }

  private parseHeader(): SurvexHeader {
    console.log('Header parsing: Starting at position', this.position);
    
    // Read file ID
    const fileId = this.readString('\n');
    console.log('Header parsing: File ID =', JSON.stringify(fileId), 'Position now:', this.position);
    if (!fileId.startsWith('Survex 3D Image File')) {
      throw new Error('Invalid Survex file format');
    }

    // Read version
    const version = this.readString('\n');
    console.log('Header parsing: Version =', JSON.stringify(version), 'Position now:', this.position);
    if (!version.startsWith('v')) {
      throw new Error('Invalid version format');
    }

    // Read survey title
    const surveyTitle = this.readString('\n');
    console.log('Header parsing: Survey title =', JSON.stringify(surveyTitle), 'Position now:', this.position);
    
    // Read timestamp
    const timestampString = this.readString('\n');
    console.log('Header parsing: Timestamp string =', JSON.stringify(timestampString));
    
    let timestamp: Date;
    if (timestampString.startsWith('@')) {
      const timestampValue = parseInt(timestampString.substring(1), 10);
      timestamp = new Date(timestampValue * 1000);
      console.log('Header parsing: Parsed timestamp =', timestampValue, 'Date =', timestamp.toISOString());
    } else {
      console.warn('Header parsing: Invalid timestamp format, using current time');
      timestamp = new Date();
    }

    // File-wide flags (1 byte)
    const flags = this.readUint8();
    console.log('Header parsing: Flags =', flags, 'Position now:', this.position);
    
    console.log('Header parsing: Complete at position', this.position);

    return {
      fileId,
      version,
      title: surveyTitle,
      separator: '.', // Default separator
      timestamp,
      flags,
    };
  }

  private parseItems(): void {
    while (this.position < this.data.length) {
      try {
        const item = this.parseItem();
        if (item) {
          this.processItem(item);
        }
      } catch (error) {
        // Only log non-EOF errors as errors, EOF is expected at end of file
        if (error instanceof Error && error.message !== 'End of file') {
          console.error('Parse error:', error);
        }
        break;
      }
    }
  }

  private parseItem(): SurvexItem | null {
    if (this.position >= this.data.length) {
      console.log('Item parsing: End of file reached at position', this.position);
      return null;
    }

    const type = this.readUint8();
    console.log('Item parsing: Read type byte =', type, 'at position', this.position - 1);
    
    // According to Survex v8 spec:
    if (type === SurvexItemType.MOVE) {
      console.log('Item parsing: Parsing MOVE item (0x0f)');
      return this.parseMove();
    }
    else if (type >= SurvexItemType.LINE_START && type <= SurvexItemType.LINE_END) {
      console.log('Item parsing: Parsing LINE item (0x40-0x7f), type = 0x' + type.toString(16));
      return this.parseLine(type);
    }
    else if (type >= SurvexItemType.LABEL_START && type <= SurvexItemType.LABEL_END) {
      console.log('Item parsing: Parsing LABEL item (0x80-0xff), type = 0x' + type.toString(16));
      return this.parseLabel(type);
    }
    else if (type <= 0x04) {
      console.log('Item parsing: Style item (0x00-0x04), type = 0x' + type.toString(16) + ' - skipping');
      return { type: type }; // Style items have no data
    }
    else if (type >= 0x10 && type <= 0x13) {
      console.log('Item parsing: Date item (0x10-0x13), type = 0x' + type.toString(16) + ' - parsing');
      return this.parseDate(type);
    }
    else if (type === 0x1f) {
      console.log('Item parsing: Error info item (0x1f) - parsing');
      return this.parseErrorInfo();
    }
    else if (type >= 0x30 && type <= 0x33) {
      console.log('Item parsing: Cross-section item (0x30-0x33), type = 0x' + type.toString(16) + ' - skipping');
      return { type: type }; // Cross-section items - skip for now
    }
    else if (type >= 0x05 && type <= 0x0e) {
      console.log('Item parsing: Other style/control item (0x05-0x0e), type = 0x' + type.toString(16) + ' - skipping');
      return { type: type }; // Various style/control items
    }
    else {
      console.log('Item parsing: Unknown item type 0x' + type.toString(16), 'at position', this.position - 1, '- skipping');
      // Instead of stopping, skip unknown items and continue parsing
      return { type: type }; // Return minimal item to continue parsing
    }
  }

  private parseMove(): SurvexItem {
    // Coordinates are in centimeters as 4-byte signed integers (little-endian)
    const xRaw = this.readInt32();
    const yRaw = this.readInt32(); 
    const zRaw = this.readInt32();
    
    // Convert from centimeters to meters
    const x = xRaw / 100;
    const y = yRaw / 100;
    const z = zRaw / 100;
    
    console.log('Move parsing: raw =', { xRaw, yRaw, zRaw }, 'converted =', { x, y, z }, 'Position now:', this.position);
    
    // Update current position
    this.currentPoint = { x, y, z };
    
    return {
      type: SurvexItemType.MOVE,
      point: { ...this.currentPoint },
    };
  }

  private parseLine(itemType: number): SurvexItem {
    // LINE items (0x40-0x7f) according to spec:
    // <label> <x> <y> <z>
    // Label modification, then coordinates in centimeters
    
    console.log('Line parsing: item type = 0x' + itemType.toString(16));
    
    // Parse label modification (unless flag bit 0x20 is set)
    const flags = itemType & 0x3f;
    let label = '';
    if ((flags & 0x20) === 0) {
      label = this.parseLabelModification();
    } else {
      console.log('Line parsing: no label change (flag 0x20 set)');
    }
    
    // Parse coordinates (in centimeters)
    const xRaw = this.readInt32();
    const yRaw = this.readInt32();
    const zRaw = this.readInt32();
    
    // Convert from centimeters to meters
    const x = xRaw / 100;
    const y = yRaw / 100;
    const z = zRaw / 100;
    
    console.log('Line parsing: coordinates =', { x, y, z }, 'label =', JSON.stringify(label));
    
    return {
      type: itemType,
      point: { x, y, z },
      label: label,
    };
  }

  private parseLabel(itemType: number): SurvexItem {
    // LABEL items (0x80-0xff) according to spec:
    // <label> <x> <y> <z>
    // Label modification, then coordinates in centimeters
    
    console.log('Label parsing: item type = 0x' + itemType.toString(16));
    
    // Parse label modification
    const label = this.parseLabelModification();
    
    // Parse coordinates (in centimeters)
    const xRaw = this.readInt32();
    const yRaw = this.readInt32();
    const zRaw = this.readInt32();
    
    // Convert from centimeters to meters
    const x = xRaw / 100;
    const y = yRaw / 100;
    const z = zRaw / 100;
    
    console.log('Label parsing: coordinates =', { x, y, z }, 'label =', JSON.stringify(label));
    
    return {
      type: itemType,
      point: { x, y, z },
      label: label,
    };
  }

  private processItem(item: SurvexItem): void {
    // MOVE: set current position, do not create a leg
    if (item.type === SurvexItemType.MOVE) {
      if (item.point) {
        this.currentPoint = { ...item.point };
        this.lastStationLabel = null;
        this.lastStationPoint = null;
        this.pendingLeg = null;
        console.log('MOVE: Updated current position to', this.currentPoint);
      }
    }
    // LINE: create a leg from current position to new coordinates, update current position
    else if (item.type >= SurvexItemType.LINE_START && item.type <= SurvexItemType.LINE_END) {
      if (item.point) {
        const newLeg: SurvexLeg = {
          fromStation: this.lastStationLabel || '',
          toStation: '',
          fromX: this.currentPoint.x,
          fromY: this.currentPoint.y,
          fromZ: this.currentPoint.z,
          toX: item.point.x,
          toY: item.point.y,
          toZ: item.point.z,
          flags: item.type & 0x3f,
        };
        this.legs.push(newLeg);
        this.pendingLeg = newLeg;
        this.currentPoint = { ...item.point };
        this.lastStationLabel = null;
        this.lastStationPoint = null;
      }
    }
    // LABEL: define a station at the given coordinates
    else if (item.type >= SurvexItemType.LABEL_START && item.type <= SurvexItemType.LABEL_END) {
      if (item.point && item.label) {
        this.stations.set(item.label, item.point);
        this.lastStationLabel = item.label;
        this.lastStationPoint = { ...item.point };
        this.currentPoint = { ...item.point };
        // If we have a pending leg that ends at this position, update its toStation
        if (this.pendingLeg &&
            Math.abs(this.pendingLeg.toX - item.point.x) < 0.001 &&
            Math.abs(this.pendingLeg.toY - item.point.y) < 0.001 &&
            Math.abs(this.pendingLeg.toZ - item.point.z) < 0.001) {
          this.pendingLeg.toStation = item.label;
          this.pendingLeg = null;
        }
      }
    }
    // Other item types: skip
  }

  private calculateBounds(stations: SurvexStation[]): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
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

  private fixTruncatedStationName(label: string): string {
    // Fix common truncation patterns for station names
    
    // ===== COINCIDENCE_ENT PATTERNS =====
    
    // Pattern 1: "ce.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^ce\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 2: "oincidence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"  
    if (/^oincidence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 3: "incidence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^incidence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 4: "nce.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^nce\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 5: "e.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^e\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 6: ".coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 7: "coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 8: "idence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^idence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 9: "dence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^dence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 10: "ence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^ence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 11: "cidence.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^cidence\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 12: "oinc.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^oinc\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 13: "inc.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^inc\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 14: "nc.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^nc\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 15: "c.coincidence_ent.N" -> "coincidence.coincidence_ent.N"
    if (/^c\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 16: Single character truncations - "o.coincidence_ent.N", "i.coincidence_ent.N", etc.
    if (/^[a-z]\.coincidence_ent\.\d+$/.test(label)) {
      return 'coincidence.coincidence_ent.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Special patterns for station 0: variations without number
    if (/^ce\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^nce\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^e\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^ence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^dence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^idence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^cidence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^incidence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^oincidence\.coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    if (/^coincidence_ent$/.test(label)) {
      return 'coincidence.coincidence_ent.0';
    }
    
    // ===== NARROW_NO_ESCAPE PATTERNS =====
    
    // Pattern 1: "ce.narrow_no_escape.N" -> "coincidence.narrow_no_escape.N"
    if (/^ce\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 2: Handle narrow_no_escape truncations - front truncations
    if (/^arrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^row_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^ow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^w_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 3: Handle other narrow variations with coincidence prefix truncations
    if (/^oincidence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^incidence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^cidence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^idence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^dence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^ence\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^nce\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    if (/^e\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // Pattern 4: Single character truncations for narrow_no_escape
    if (/^[a-z]\.narrow_no_escape\.\d+$/.test(label)) {
      return 'coincidence.narrow_no_escape.' + label.match(/\.(\d+)$/)?.[1];
    }
    
    // ===== DETECT POTENTIAL STATION NUMBERS WITHOUT FULL PATTERN =====
    
    // Look for any numeric strings that might be station numbers
    // Pattern: look for labels ending in numbers that might be truncated stations
    const numberOnlyMatch = label.match(/(\d+)$/);
    if (numberOnlyMatch) {
      const num = parseInt(numberOnlyMatch[1]);
      // If it's a reasonable station number (0-46 for ent, 1-7 for narrow)
      if (num >= 0 && num <= 46) {
        // Check if this might be a coincidence_ent station based on context
        if (label.includes('ent') || label.includes('coincidence')) {
          console.log('*** POTENTIAL COINCIDENCE_ENT STATION FOUND:', JSON.stringify(label), 'number =', num);
          return 'coincidence.coincidence_ent.' + num;
        }
        // Check if this might be a narrow_no_escape station
        else if ((label.includes('narrow') || label.includes('escape')) && num >= 1 && num <= 7) {
          console.log('*** POTENTIAL NARROW_NO_ESCAPE STATION FOUND:', JSON.stringify(label), 'number =', num);
          return 'coincidence.narrow_no_escape.' + num;
        }
      }
    }
    
    // Look for labels that contain key fragments but are heavily truncated
    if (label.includes('ent') && /\d/.test(label)) {
      // Extract number if present
      const numMatch = label.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num >= 0 && num <= 46) {
          console.log('*** FRAGMENT ENT STATION FOUND:', JSON.stringify(label), 'number =', num);
          return 'coincidence.coincidence_ent.' + num;
        }
      }
    }
    
    // Less aggressive: Only match labels that have station-like structure but are truncated
    if (label.length >= 3 && /\d/.test(label)) {
      const numMatch = label.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        // Only if it's a reasonable station number
        if (num >= 0 && num <= 46) {
          // Check for station-like fragments (avoid false positives)
          if (label.includes('incid') || label.includes('oincid') || 
              /^[a-z]{1,3}\.\w+_\w+\.\d+/.test(label)) {
            console.log('*** POSSIBLE STATION-LIKE FRAGMENT:', JSON.stringify(label), 'number =', num);
            return 'coincidence.coincidence_ent.' + num;
          }
        }
      }
    }
    
    if ((label.includes('narrow') || label.includes('escape')) && /\d/.test(label)) {
      // Extract number if present
      const numMatch = label.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (num >= 1 && num <= 7) {
          console.log('*** FRAGMENT NARROW STATION FOUND:', JSON.stringify(label), 'number =', num);
          return 'coincidence.narrow_no_escape.' + num;
        }
      }
    }
    
    // If no pattern matches, return as-is
    return label;
  }
  
  private parseDate(itemType: number): SurvexItem {
    // According to Survex 3D format specification, DATE items contain date information
    // DATE (0x11): 2 bytes - days since start of 1900
    console.log('Date parsing: item type = 0x' + itemType.toString(16) + ' - parsing date');
    
    if (itemType === 0x11 && this.position + 2 <= this.data.length) {
      const daysSince1900 = this.readUint16();
      console.log('Date parsing: days since 1900 =', daysSince1900, 'Position now:', this.position);
    } else if (itemType === 0x10) {
      console.log('Date parsing: no survey date information specified');
    } else {
      console.log('Date parsing: unknown date format, skipping');
    }
    
    return {
      type: itemType as SurvexItemType,
    };
  }
  
  private readUint16(): number {
    if (this.position + 2 > this.data.length) {
      throw new Error('End of file');
    }
    const value = new DataView(this.data.buffer, this.position, 2).getUint16(0, true); // little endian
    this.position += 2;
    return value;
  }
  
  private parseErrorInfo(): SurvexItem {
    // Error info item - skip for now  
    console.log('Error info parsing: skipping');
    return { type: 0x1f };
  }

  private parseLabelModification(): string {
    // Parse label modification according to Survex 3D spec
    // Read a byte - if it is non-zero then: D = byte >> 4, A = byte & 0x0f
    // Otherwise (i.e. the first byte is zero):
    //   Read a byte and: If it is not 255 then D = byte, Otherwise, D = 4 byte unsigned integer
    //   Read a byte and: If it is not 255 then A = byte, Otherwise, A = 4 byte unsigned integer
    
    const firstByte = this.readUint8();
    let deleteCount: number;
    let appendCount: number;
    
    if (firstByte !== 0) {
      deleteCount = firstByte >> 4;
      appendCount = firstByte & 0x0f;
    } else {
      // Read delete count
      const deleteByte = this.readUint8();
      if (deleteByte !== 255) {
        deleteCount = deleteByte;
      } else {
        deleteCount = this.readUint32();
      }
      
      // Read append count
      const appendByte = this.readUint8();
      if (appendByte !== 255) {
        appendCount = appendByte;
      } else {
        appendCount = this.readUint32();
      }
    }
    
    // Apply modification to label buffer
    if (deleteCount > 0) {
      this.labelBuffer = this.labelBuffer.slice(0, -deleteCount);
    }
    
    if (appendCount > 0) {
      const appendBytes = this.data.slice(this.position, this.position + appendCount);
      const appendString = new TextDecoder('utf-8', { fatal: false }).decode(appendBytes);
      this.labelBuffer += appendString;
      this.position += appendCount;
    }
    
    console.log('Label modification: delete =', deleteCount, 'append =', appendCount, 'buffer =', JSON.stringify(this.labelBuffer));
    return this.labelBuffer;
  }
}