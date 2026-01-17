/**
 * FileSystem Abstraction
 *
 * expo-file-system (Native) / Blob API (Web) を統一インターフェースで提供
 */

// 型とenumをtypes.tsから再エクスポート
export { EncodingType, type PlatformFileSystem } from './types';

// Metro/Webpack resolves platform-specific files (.native.ts, .web.ts)
export { FileSystem } from './filesystem';
