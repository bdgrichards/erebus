import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SurvexParser } from './survex-parser';
import { SurvexData } from './survex-types';

export interface FileLoadResult {
  success: boolean;
  data?: SurvexData;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

export const FileLoaderService = {
  async pickAndLoadFile(): Promise<FileLoadResult> {
    try {
      console.log('FileLoader: Opening file picker...');
      
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('FileLoader: File selection cancelled');
        return { success: false, error: 'File selection cancelled' };
      }
      
      const file = result.assets[0];
      console.log(`FileLoader: File selected: ${file.name} (${file.size} bytes)`);
      
      return await this.loadSurvexFile(file.uri, file.name, file.size);
    } catch (err) {
      console.error('FileLoader: File picker error:', err);
      return { success: false, error: 'Failed to pick file' };
    }
  },

  async loadSurvexFile(fileUri: string, fileName: string, fileSize?: number): Promise<FileLoadResult> {
    try {
      console.log(`FileLoader: Reading file: ${fileName}`);
      
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Convert base64 to Uint8Array
      const binaryString = atob(fileContent);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      console.log(`FileLoader: File read successfully, ${uint8Array.length} bytes`);
      
      // Parse the file
      const parser = new SurvexParser(uint8Array);
      const parsedData = parser.parse();
      
      console.log('FileLoader: Parsing completed successfully:', parsedData.stations.length, 'stations,', parsedData.legs.length, 'legs');
      
      return {
        success: true,
        data: parsedData,
        fileName,
        filePath: fileUri,
        fileSize
      };
    } catch (error) {
      console.error('FileLoader: Error loading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load file'
      };
    }
  }
};