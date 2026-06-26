const ALLOWED_SHELL_COMMANDS = new Set([
  'python',
  'python3',
  'pip',
  'git',
  'node',
  'npm',
  'ls',
  'pwd',
  'cat',
  'echo',
  'which',
  'uname'
]);

const ALLOWED_PIP_PACKAGES = new Set([
  'numpy',
  'requests',
  'beautifulsoup4',
  'flask',
  'flask-cors'
]);

const DANGEROUS_SHELL_PATTERN = /[;&|`$<>]/;
const BLOCKED_PYTHON_PATTERNS = [
  /\bexec\s*\(/,
  /\beval\s*\(/,
  /\b__import__\s*\(/,
  /\bos\.system\s*\(/,
  /\bsubprocess\b/,
  /\bopen\s*\(/,
  /\binput\s*\(/,
  /\bctypes\b/
];

export function sanitizeShellCommand(command) {
  const trimmed = typeof command === 'string' ? command.trim() : '';
  if (!trimmed) {
    return { allowed: false, reason: 'Empty command.' };
  }

  if (DANGEROUS_SHELL_PATTERN.test(trimmed)) {
    return { allowed: false, reason: 'Shell metacharacters are blocked for safety.' };
  }

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  if (!ALLOWED_SHELL_COMMANDS.has(cmd)) {
    return { allowed: false, reason: `Command '${cmd}' is not on the allowlist.` };
  }

  if (cmd === 'pip' && parts[1] === 'install') {
    const packages = parts.slice(2);
    const disallowed = packages.filter((pkg) => !ALLOWED_PIP_PACKAGES.has(pkg));
    if (disallowed.length > 0) {
      return { allowed: false, reason: `Pip packages ${disallowed.join(', ')} are not allowed.` };
    }
  }

  return { allowed: true, command: trimmed };
}

export function sanitizePythonCode(code) {
  const trimmed = typeof code === 'string' ? code.trim() : '';
  if (!trimmed) {
    return { allowed: false, reason: 'Empty code.' };
  }

  const normalized = trimmed.toLowerCase();
  const blocked = BLOCKED_PYTHON_PATTERNS.find((pattern) => pattern.test(normalized));
  if (blocked) {
    return { allowed: false, reason: 'This code uses blocked execution primitives.' };
  }

  return { allowed: true, code: trimmed };
}

export function getAllowedOrigins() {
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:1234',
    'http://127.0.0.1:1234'
  ];
}

export function isOriginAllowed(origin) {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
}

export function isGitHubWriteAllowed(config) {
  return Boolean(config && config.allowWriteAccess);
}

export function getGitHubWriteGuardMessage() {
  return 'GitHub write access is disabled by default for safety. Enable it explicitly in settings before pushing changes.';
}

export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
