
import { EnvVar, GithubConfig, RuntimeMode } from "../types";
import { pushFileToGithub, fetchFileContent, triggerWorkflowDispatch, fetchRepoZip } from "./githubService";
import { executeOnBridge } from "./bridgeService";

let pyodideInstance: any = null;
let isLoading = false;

let onStdout: ((msg: string) => void) | null = null;
let onStderr: ((msg: string) => void) | null = null;

export const setOutputCallbacks = (stdout: (msg: string) => void, stderr: (msg: string) => void) => {
  onStdout = stdout;
  onStderr = stderr;
  
  if (pyodideInstance) {
     pyodideInstance.setStdout({ batched: (msg: string) => onStdout?.(msg + '\r\n') });
     pyodideInstance.setStderr({ batched: (msg: string) => onStderr?.(msg + '\r\n') });
  }
};

export const getPyodide = async () => {
  if (pyodideInstance) return pyodideInstance;
  if (isLoading) {
    while (isLoading) {
        await new Promise(r => setTimeout(r, 100));
        if (pyodideInstance) return pyodideInstance;
    }
  }
  isLoading = true;
  try {
    console.log("Initializing Pyodide...");
    // @ts-ignore
    pyodideInstance = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" });
    await pyodideInstance.loadPackage(["micropip"]);
    pyodideInstance.setStdout({ batched: (msg: string) => onStdout?.(msg + '\r\n') });
    pyodideInstance.setStderr({ batched: (msg: string) => onStderr?.(msg + '\r\n') });
    console.log("Pyodide ready.");
  } catch (e) {
    console.error("Failed to load Pyodide:", e);
    throw e;
  } finally {
    isLoading = false;
  }
  return pyodideInstance;
};

export const writeFileToVFS = async (path: string, content: string) => {
    // If Electron is active, we could write to temp, but usually VFS implies Browser Memory
    const pyodide = await getPyodide();
    const parts = path.split('/');
    const filename = parts.pop();
    const dir = parts.join('/');
    if (dir) { try { pyodide.FS.mkdirTree(dir); } catch(e) { } }
    pyodide.FS.writeFile(path, content, { encoding: "utf8" });
};

const installPackages = async (packages: string[]) => {
    const pyodide = await getPyodide();
    onStdout?.(`> Installing ${packages.join(', ')} via micropip (Browser)...\r\n`);
    try {
        await pyodide.runPythonAsync(`import micropip\nawait micropip.install(${JSON.stringify(packages)})\nprint(f"Successfully installed: {', '.join(packages)}")`);
    } catch (e: any) { throw e; }
};

const readFileFromVFS = async (path: string): Promise<string | null> => {
    const pyodide = await getPyodide();
    try {
        if (pyodide.FS.analyzePath(path).exists) {
             return pyodide.FS.readFile(path, { encoding: 'utf8' });
        }
    } catch (e) {}
    return null;
};

/**
 * Intelligent command executor
 */
export const executeTerminalCommand = async (
    command: string, 
    envVars: EnvVar[],
    githubConfig: GithubConfig | null,
    mode: RuntimeMode = 'browser'
) => {
    const trimmed = command.trim();
    if (!trimmed) return;
    
    const envObj = envVars.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

    // --- ELECTRON MODE ---
    if (window.electron) {
        onStdout?.(`> [Electron] ${trimmed}\r\n`);
        try {
            const res = await window.electron.runShell(trimmed, envObj);
            if (res.stdout) onStdout?.(res.stdout.replace(/\n/g, '\r\n') + '\r\n');
            if (res.stderr) onStderr?.(res.stderr.replace(/\n/g, '\r\n') + '\r\n');
        } catch (e: any) {
            onStderr?.(`Electron Shell Error: ${e.message}\r\n`);
        }
        return;
    }

    // --- LOCAL BRIDGE MODE ---
    if (mode === 'local') {
        if (trimmed.startsWith('pip install')) {
             onStdout?.(`> Executing '${trimmed}' on Local Machine...\r\n`);
             const code = `import subprocess\nimport sys\nsubprocess.check_call([sys.executable, "-m", "pip", "install", "${trimmed.split(' ').slice(2).join(' ')}"])`;
             try {
                const res = await executeOnBridge(code, envObj);
                if (res.success) onStdout?.(res.stdout + '\r\n');
                else onStderr?.(res.stderr + '\r\n');
             } catch (e: any) { onStderr?.(e.message + '\r\n'); }
             return;
        }
        await runPythonCode(trimmed, envVars, 'local');
        return;
    }

    // --- BROWSER MODE (Pyodide) ---
    const parts = trimmed.split(' ');
    const cmd = parts[0];

    try {
        if (cmd === 'pip' && parts[1] === 'install') {
            const packages = parts.slice(2);
            if (packages.length === 0) return;
            await installPackages(packages);
            return;
        }
        if (cmd === 'git' && githubConfig) {
             if (parts[1] === 'push') {
                 const filename = parts[2];
                 const message = parts[4] || `Update ${filename}`;
                 const content = await readFileFromVFS(filename);
                 if (!content) { onStderr?.(`File ${filename} not found\r\n`); return; }
                 const result = await pushFileToGithub(githubConfig, filename, content, message);
                 result.success ? onStdout?.(`✓ ${result.message}\r\n`) : onStderr?.(`✗ ${result.message}\r\n`);
                 return;
             }
             if (parts[1] === 'pull') {
                 const filename = parts[2];
                 const result = await fetchFileContent(githubConfig, filename);
                 if (result.success) { await writeFileToVFS(filename, result.content); onStdout?.(`✓ Synced ${filename}\r\n`); } 
                 else { onStderr?.(`✗ ${result.message}\r\n`); }
                 return;
             }
        }
        if (cmd === 'zip') { await createZipArchive(mode); return; }
        if (cmd === 'python' && parts[1]) { await runPythonScript(parts[1], envVars); return; }
        await runPythonCode(trimmed, envVars, 'browser');
    } catch (e: any) { onStderr?.(`${e.toString()}\r\n`); }
};

export const deployRepoToVFS = async (githubConfig: GithubConfig, manualZipData?: ArrayBuffer): Promise<boolean> => {
    let arrayBuffer = manualZipData;
    if (!arrayBuffer) {
        onStdout?.(`> Fetching ${githubConfig.repo} from GitHub...\r\n`);
        const zipResult = await fetchRepoZip(githubConfig);
        if (!zipResult.success || !zipResult.data) {
            onStderr?.(`\x1b[31mFailed to download repo: ${zipResult.message}\x1b[0m\r\n`);
            return false;
        }
        arrayBuffer = zipResult.data;
    }
    onStdout?.(`> Extracting to Virtual File System...\r\n`);
    return await loadZipToVFS(arrayBuffer);
};

export const loadZipToVFS = async (arrayBuffer: ArrayBuffer): Promise<boolean> => {
    const pyodide = await getPyodide();
    const zipPath = "/tmp_repo.zip";
    pyodide.FS.writeFile(zipPath, new Uint8Array(arrayBuffer));
    const unzipScript = `
import zipfile
import os
import shutil
zip_path = "${zipPath}"
extract_root = "/home/pyodide"
success = False
try:
    if not os.path.exists(extract_root): os.makedirs(extract_root)
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_root)
    
    # Flatten directory if nested (GitHub standard)
    items = os.listdir(extract_root)
    github_root = None
    for item in items:
        full_path = os.path.join(extract_root, item)
        if os.path.isdir(full_path) and item != 'repo_temp' and item != '__pycache__':
             # Check if it looks like a repo root (uuid-like or name-sha)
             if len([i for i in items if not i.startswith('.')]) == 1:
                 github_root = item
                 break
    
    if github_root:
        full_root = os.path.join(extract_root, github_root)
        for item in os.listdir(full_root):
            if item != '__pycache__':
                src = os.path.join(full_root, item)
                dst = os.path.join(extract_root, item)
                if os.path.isdir(dst):
                    try: shutil.rmtree(dst)
                    except: pass
                elif os.path.exists(dst):
                    try: os.remove(dst)
                    except: pass
                shutil.move(src, extract_root)
    print(f"Project loaded to {extract_root}")
    success = True
except Exception as e:
    print(f"Extraction Error: {e}")
    success = False

if os.path.exists(zip_path): os.remove(zip_path)
success
`;
    try {
        const result = await pyodide.runPythonAsync(unzipScript);
        if (result) {
            onStdout?.(`✓ Project Loaded.\r\n`);
            return true;
        } else {
            return false;
        }
    } catch (e: any) {
        onStderr?.(`Load failed: ${e.message}\r\n`);
        return false;
    }
};

export const installRepoRequirements = async () => {
    const pyodide = await getPyodide();
    const script = `
import os
import micropip
if os.path.exists("requirements.txt"):
    print("Found requirements.txt. Installing...")
    with open("requirements.txt", "r") as f:
        packages = [line.strip() for line in f if line.strip() and not line.startswith("#")]
    # Filter for pure python packages likely to work in Pyodide
    safe_packages = [p for p in packages if not any(x in p for x in ["PyQt", "tkinter", "mysql", "psycopg2"])]
    if safe_packages:
        await micropip.install(safe_packages)
        print(f"Installed: {', '.join(safe_packages)}")
    else:
        print("No compatible packages found in requirements.txt")
else:
    print("No requirements.txt found.")
`;
    try {
        await pyodide.runPythonAsync(script);
    } catch (e: any) {
        onStderr?.(`Dependency Install Warning: ${e.message}\r\n`);
    }
};

export const detectAndRunEntryPoint = async (envVars: EnvVar[]) => {
    const pyodide = await getPyodide();
    const script = `
import os
entry_points = ["main.py", "app.py", "run.py", "index.py", "script.py"]
found = None
for ep in entry_points:
    if os.path.exists(ep):
        found = ep
        break
found
`;
    try {
        const entryPoint = await pyodide.runPythonAsync(script);
        if (entryPoint) {
            onStdout?.(`> Auto-running detected entry point: ${entryPoint}\r\n`);
            await runPythonScript(entryPoint, envVars);
        } else {
            onStdout?.(`> No obvious entry point found (main.py, app.py, etc.). Use 'python <file>' to run.\r\n`);
            // List files to help user
            await pyodide.runPythonAsync("import os; print('Files:', os.listdir('.'))");
        }
    } catch (e: any) {
        onStderr?.(`Auto-run failed: ${e.message}\r\n`);
    }
};

export const runPythonScript = async (path: string, envVars: EnvVar[] = []) => {
    const pyodide = await getPyodide();
    if (envVars.length > 0) {
      const envSetup = `import os\n${envVars.map(v => `os.environ['${v.key}'] = '${v.value.replace(/'/g, "\\'")}'`).join('\n')}`;
      await pyodide.runPythonAsync(envSetup);
    }
    onStdout?.(`> python ${path}\r\n`);
    try {
        const code = `
import sys
import os
if '.' not in sys.path: sys.path.append('.')
if os.path.exists("${path}"):
    with open("${path}", "r") as f:
        exec(f.read())
else:
    print(f"File not found: ${path}", file=sys.stderr)
`;
        await pyodide.runPythonAsync(code);
        const images = await scanForImages(pyodide);
        return { text: "Script finished", images };
    } catch (e: any) {
        onStderr?.(e.toString() + '\r\n');
        throw e;
    }
};

const scanForImages = async (pyodide: any) => {
    const images: { name: string, data: string, mimeType: string }[] = [];
    try {
        if (!pyodide.FS) return []; 
        const files = pyodide.FS.readdir('.');
        for (const file of files) {
            if (['.png', '.jpg', '.svg'].some(ext => file.endsWith(ext))) {
                const content = pyodide.FS.readFile(file, { encoding: 'binary' });
                let binary = '';
                for (let i = 0; i < content.byteLength; i++) binary += String.fromCharCode(content[i]);
                images.push({ name: file, data: btoa(binary), mimeType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/png' });
                pyodide.FS.unlink(file);
            }
        }
    } catch (e) {}
    return images;
};

export const runPythonCode = async (code: string, envVars: EnvVar[] = [], mode: RuntimeMode = 'browser'): Promise<{ text: string, images: any[] }> => {
  const envObj = envVars.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});

  // Electron Mode
  if (window.electron) {
      try {
          // Create a temporary python script file and run it
          // This is a simplification. For a real REPL, we'd spawn a persistent shell.
          const res = await window.electron.runShell(`python -c "${code.replace(/"/g, '\\"')}"`, envObj);
          if (res.success) return { text: res.stdout, images: [] };
          throw new Error(res.stderr);
      } catch (e: any) { throw new Error(e.message); }
  }

  // Local Bridge Mode
  if (mode === 'local') {
      try {
          const result = await executeOnBridge(code, envObj);
          if (result.success) return { text: result.stdout, images: [] };
          throw new Error(result.stderr || 'Unknown Bridge Error');
      } catch (e: any) { throw new Error(e.message); }
  }

  // Browser Mode
  try {
    const pyodide = await getPyodide();
    if (envVars.length > 0) {
        const envSetup = `import os\n${envVars.map(v => `os.environ['${v.key}'] = '${v.value.replace(/'/g, "\\'")}'`).join('\n')}`;
        await pyodide.runPythonAsync(envSetup);
    }
    const result = await pyodide.runPythonAsync(code);
    const text = result !== undefined ? String(result) : "";
    const images = await scanForImages(pyodide);
    return { text, images };
  } catch (error: any) { throw new Error(error.message); }
};

export const createZipArchive = async (mode: RuntimeMode = 'browser', returnBlob: boolean = false): Promise<Blob | void> => {
    onStdout?.(`> Creating project zip archive in ${mode} mode...\r\n`);
    
    if (window.electron) {
        onStderr?.("Zip creation via Electron not yet implemented in this version.\r\n");
        return;
    }

    if (mode === 'local') {
        const code = `import shutil\nimport os\ntry:\n    shutil.make_archive('project_backup', 'zip', '.')\n    print(f"Created project_backup.zip in {os.getcwd()}")\nexcept Exception as e:\n    print(f"Error: {e}")`;
        try {
            const result = await executeOnBridge(code, {});
            if (result.success) onStdout?.(result.stdout + '\r\n');
        } catch (e: any) { onStderr?.(e.message + '\r\n'); }
        return;
    }

    try {
        const pyodide = await getPyodide();
        const code = `
import shutil
import os
import zipfile
zip_path = 'project_backup.zip'
try:
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk('.'):
            for file in files:
                if file != zip_path and 'tmp' not in root:
                    zipf.write(os.path.join(root, file))
    print("Zip created successfully")
except Exception as e:
    print(f"Zip Error: {e}")
`;
        await pyodide.runPythonAsync(code);
        if (pyodide.FS.analyzePath('project_backup.zip').exists) {
            const content = pyodide.FS.readFile('project_backup.zip', { encoding: 'binary' });
            const blob = new Blob([content], { type: 'application/zip' });
            pyodide.FS.unlink('project_backup.zip');
            if (returnBlob) return blob;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'project_backup.zip';
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            onStdout?.("✓ Downloaded project_backup.zip\r\n");
        } else { onStderr?.("Failed to create zip file\r\n"); }
    } catch (e: any) { onStderr?.(`Failed to zip: ${e.message}\r\n`); }
};
