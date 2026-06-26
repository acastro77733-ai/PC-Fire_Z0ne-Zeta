
export interface Attachment {
  id: string;
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64 for binary, plain text for code/text files
  name: string;
  isText: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  attachments?: Attachment[];
}

export interface GithubConfig {
  id: string;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  allowWriteAccess?: boolean;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
}

export type RuntimeMode = 'browser' | 'local' | 'electron';

export interface BridgeStatus {
  isConnected: boolean;
  version?: string;
  os?: string;
  pythonVersion?: string;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  sha?: string;
  url?: string;
}

export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
}

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

export interface FileNode {
  name: string;
  kind: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

// Electron API Definition
export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  selectDirectory: () => Promise<string | null>;
  readFile: (path: string) => Promise<{ success: boolean, content?: string, error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean, error?: string }>;
  readDir: (path: string) => Promise<{ success: boolean, files?: {name: string, kind: 'file'|'directory', path: string}[], error?: string }>;
  runShell: (cmd: string, env: Record<string, string>) => Promise<{ success: boolean, stdout: string, stderr: string }>;
}

// Extend Window interface
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    mammoth: any;
    electron?: ElectronAPI;
  }
}