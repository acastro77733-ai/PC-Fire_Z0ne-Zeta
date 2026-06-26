
/**
 * Service for interacting with the File System.
 * Supports Browser Native (File System Access API) and Electron Native.
 */
import { FileNode } from '../types';

export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
  values: () => AsyncIterableIterator<FileSystemHandle>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  createWritable: () => Promise<FileSystemWritableFileStream>;
  getFile: () => Promise<File>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write: (data: string | BufferSource | Blob) => Promise<void>;
  seek: (position: number) => Promise<void>;
  truncate: (size: number) => Promise<void>;
  close: () => Promise<void>;
}

export const selectLocalDirectory = async (): Promise<FileSystemDirectoryHandle | string> => {
  // 1. Electron Mode
  if (window.electron) {
      const path = await window.electron.selectDirectory();
      if (!path) throw new Error("Selection cancelled");
      return path; // Returns string path in Electron
  }

  // 2. Browser Mode
  if (!('showDirectoryPicker' in window)) {
    throw new Error("Your browser does not support the File System Access API. Please use Chrome, Edge, or Opera.");
  }
  try {
    // @ts-ignore
    return await window.showDirectoryPicker({
      mode: 'readwrite'
    });
  } catch (error: any) {
    if (error.name === 'SecurityError' || (error.message && error.message.includes('Cross origin sub frames'))) {
        throw new Error("Access Denied: The File System API is blocked in this embedded view. Please open the app in a full browser window or use the Download button instead.");
    }
    throw error;
  }
};

export const saveToLocalFile = async (
  rootHandle: FileSystemDirectoryHandle | string, 
  path: string, 
  content: string
): Promise<void> => {
  // Electron Mode
  if (typeof rootHandle === 'string' && window.electron) {
      const fullPath = path.startsWith(rootHandle) ? path : `${rootHandle}/${path}`;
      const res = await window.electron.writeFile(fullPath, content);
      if (!res.success) throw new Error(res.error);
      return;
  }

  // Browser Mode
  const handle = rootHandle as FileSystemDirectoryHandle;
  const parts = path.split('/').filter(p => p.trim() !== '');
  const filename = parts.pop();
  
  if (!filename) throw new Error("Invalid file path");

  let currentHandle = handle;

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await currentHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
};

export const readFileFromLocal = async (
    rootHandle: FileSystemDirectoryHandle | string,
    path: string
): Promise<{ content: string; mimeType: string }> => {
    // Electron Mode
    if (typeof rootHandle === 'string' && window.electron) {
        const fullPath = path.startsWith(rootHandle) ? path : `${rootHandle}/${path}`;
        const res = await window.electron.readFile(fullPath);
        if (!res.success) throw new Error(res.error);
        // Simple mime detection based on extension
        const ext = fullPath.split('.').pop()?.toLowerCase();
        let mime = 'text/plain';
        if (ext === 'json') mime = 'application/json';
        if (ext === 'js') mime = 'text/javascript';
        if (ext === 'html') mime = 'text/html';
        return { content: res.content || '', mimeType: mime };
    }

    // Browser Mode
    const handle = rootHandle as FileSystemDirectoryHandle;
    const parts = path.split('/').filter(p => p.trim() !== '');
    const filename = parts.pop();
    if (!filename) throw new Error("Invalid file path");

    let currentHandle = handle;
    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
    }
    
    const fileHandle = await currentHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const text = await file.text();
    
    return {
        content: text,
        mimeType: file.type || 'text/plain'
    };
};

export const getFileTree = async (
    dirHandle: FileSystemDirectoryHandle | string, 
    pathPrefix: string = ''
): Promise<FileNode[]> => {
    // Electron Mode
    if (typeof dirHandle === 'string' && window.electron) {
        const res = await window.electron.readDir(dirHandle);
        if (!res.success || !res.files) throw new Error(res.error);
        
        const nodes: FileNode[] = [];
        const ignoredFolders = new Set(['node_modules', '.git', '.venv', '__pycache__', 'dist', 'build', '.idea', '.vscode']);

        for (const file of res.files) {
            if (ignoredFolders.has(file.name)) continue;
            if (file.name.startsWith('.')) continue;

            if (file.kind === 'directory') {
                nodes.push({
                    name: file.name,
                    kind: 'directory',
                    path: file.path,
                    children: await getFileTree(file.path, '') // Recursively fetch
                });
            } else {
                nodes.push({
                    name: file.name,
                    kind: 'file',
                    path: file.path
                });
            }
        }
        return nodes.sort((a, b) => {
            if (a.kind === b.kind) return a.name.localeCompare(b.name);
            return a.kind === 'directory' ? -1 : 1;
        });
    }

    // Browser Mode
    const handle = dirHandle as FileSystemDirectoryHandle;
    const nodes: FileNode[] = [];
    const ignoredFolders = new Set(['node_modules', '.git', '.venv', '__pycache__', 'dist', 'build', '.idea', '.vscode']);
    
    // @ts-ignore
    for await (const entry of handle.values()) {
        if (entry.kind === 'directory') {
            if (ignoredFolders.has(entry.name)) continue;
            const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
            const children = await getFileTree(entry as FileSystemDirectoryHandle, fullPath);
            nodes.push({
                name: entry.name,
                kind: 'directory',
                path: fullPath,
                children: children.sort((a, b) => a.name.localeCompare(b.name))
            });
        } else {
            if (entry.name.startsWith('.')) continue;
            nodes.push({
                name: entry.name,
                kind: 'file',
                path: pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
            });
        }
    }

    return nodes.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
    });
};

export const buildVirtualFileTree = (files: FileList): { tree: FileNode[], fileMap: Map<string, File> } => {
  const tree: FileNode[] = [];
  const fileMap = new Map<string, File>();
  const ignoredFolders = new Set(['node_modules', '.git', '.venv', '__pycache__', 'dist', 'build', '.idea', '.vscode']);

  const getOrCreateDir = (path: string, name: string, parentChildren: FileNode[]): FileNode => {
     let node = parentChildren.find(n => n.name === name && n.kind === 'directory');
     if (!node) {
       node = { name, kind: 'directory', path, children: [] };
       parentChildren.push(node);
     }
     return node;
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const pathParts = file.webkitRelativePath.split('/');
    const fileName = pathParts.pop()!;
    if (fileName.startsWith('.') || pathParts.some(p => ignoredFolders.has(p))) continue;

    let currentLevel = tree;
    let currentPath = '';
    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const dirNode = getOrCreateDir(currentPath, part, currentLevel);
      currentLevel = dirNode.children!;
    }
    const fullPath = file.webkitRelativePath;
    fileMap.set(fullPath, file);
    currentLevel.push({ name: fileName, kind: 'file', path: fullPath });
  }
  
  const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
          if (a.kind === b.kind) return a.name.localeCompare(b.name);
          return a.kind === 'directory' ? -1 : 1;
      });
      nodes.forEach(n => { if (n.children) sortNodes(n.children); });
  };
  sortNodes(tree);
  return { tree, fileMap };
};