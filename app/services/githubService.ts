
import { GithubConfig, FileOperationResult } from '../types';
import { isGitHubWriteAllowed, getGitHubWriteGuardMessage } from './safety.mjs';

const BASE_URL = 'https://api.github.com';

/**
 * Helper to safely extract error message from GitHub API response
 */
const parseGithubError = (data: any, defaultMsg: string = 'Unknown Error'): string => {
  if (!data) return defaultMsg;
  
  let msg = data.message || defaultMsg;
  
  // Ensure msg is a string
  if (typeof msg !== 'string') {
      try {
        msg = JSON.stringify(msg);
      } catch (e) {
        msg = 'Complex error object';
      }
  }

  // Specific hint for the "Resource not accessible..." error (Common with Fine-grained tokens)
  if (msg.includes('Resource not accessible by personal access token') || (data.status === '403' && msg === 'Forbidden')) {
      return "Permission Denied: Your token is missing Write access. For Fine-grained tokens, enable 'Contents: Read and Write'. For Classic tokens, ensure the 'repo' scope is checked.";
  }

  // Append validation errors if present (e.g. "Validation Failed")
  if (data.errors && Array.isArray(data.errors)) {
      const details = data.errors.map((e: any) => e.message || e.code).join(', ');
      msg += ` (${details})`;
  }
  
  return msg;
};

/**
 * Fetches the authenticated user's login (username) and avatar.
 */
export const getAuthenticatedUser = async (token: string): Promise<{ login: string, avatar_url: string } | null> => {
  try {
    const response = await fetch(`${BASE_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { login: data.login, avatar_url: data.avatar_url };
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Fetches a list of repositories for the authenticated user.
 * Sorted by 'pushed' to show recently active repos first.
 */
export const getUserRepositories = async (token: string, page: number = 1, perPage: number = 100): Promise<any[]> => {
  try {
    // sort=pushed puts recently active repos at the top, better for workflow
    const response = await fetch(`${BASE_URL}/user/repos?sort=pushed&direction=desc&per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
        const err = await response.json();
        console.error("Failed to fetch repos:", err);
        return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return [];
  }
};

/**
 * Fetches repository details to validate existence and get default branch.
 */
export const getRepoDetails = async (token: string, owner: string, repo: string) => {
  try {
    const response = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching repo:', error);
    return null;
  }
};

/**
 * Creates or updates a file in the repository
 */
export const pushFileToGithub = async (
  config: GithubConfig,
  path: string,
  content: string,
  message: string
): Promise<FileOperationResult> => {
  if (!isGitHubWriteAllowed(config)) {
    return { success: false, message: getGitHubWriteGuardMessage() };
  }

  try {
    // 1. Check if file exists to get SHA (required for updates)
    let sha: string | undefined;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    
    const getResponse = await fetch(
      `${BASE_URL}/repos/${config.owner}/${config.repo}/contents/${cleanPath}?ref=${config.branch}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (getResponse.ok) {
      try {
        const data = await getResponse.json();
        sha = data.sha;
      } catch (e) {
        // JSON parse error on GET, unlikely but possible
      }
    } else if (getResponse.status !== 404) {
      // Real error, not just "file not found"
      let errData;
      try {
          errData = await getResponse.json();
      } catch (e) {
          return { success: false, message: `Fetch failed: ${getResponse.status} ${getResponse.statusText}` };
      }
      return { success: false, message: `Fetch Error: ${parseGithubError(errData)}` };
    }

    // 2. Encode content to Base64 (handles UTF-8 correctly)
    const contentEncoded = btoa(unescape(encodeURIComponent(content)));

    // 3. PUT request to create/update
    const putResponse = await fetch(
      `${BASE_URL}/repos/${config.owner}/${config.repo}/contents/${cleanPath}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message || `Update ${cleanPath} via PowerCoder-Z`,
          content: contentEncoded,
          branch: config.branch,
          sha: sha, // Include SHA if updating
        }),
      }
    );

    let resultData;
    try {
        resultData = await putResponse.json();
    } catch (e) {
        // Handling non-JSON responses (e.g., 500 server errors sent as HTML)
        return { 
            success: false, 
            message: `GitHub API Error (Non-JSON): ${putResponse.status} ${putResponse.statusText}` 
        };
    }

    if (putResponse.ok) {
      return {
        success: true,
        message: sha ? `Updated ${cleanPath}` : `Created ${cleanPath}`,
        url: resultData.content?.html_url,
      };
    } else {
      console.error("GitHub Push Failed Full Response:", JSON.stringify(resultData, null, 2));
      const errorMsg = parseGithubError(resultData, 'Unknown Git Error');
      return { success: false, message: errorMsg };
    }

  } catch (error: any) {
    console.error("Network/Logic Error:", error);
    return { success: false, message: error.message || 'Network error during push' };
  }
};

/**
 * Fetches file content from GitHub (Simulating Git Pull)
 */
export const fetchFileContent = async (config: GithubConfig, path: string): Promise<{ content: string, success: boolean, message?: string }> => {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    try {
        const response = await fetch(
            `${BASE_URL}/repos/${config.owner}/${config.repo}/contents/${cleanPath}?ref=${config.branch}`,
            {
                headers: {
                    Authorization: `Bearer ${config.token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (!response.ok) {
             return { success: false, content: '', message: `Failed to fetch: ${response.statusText}` };
        }

        const data = await response.json();
        if (data.content && data.encoding === 'base64') {
             // Decode base64
             const decoded = decodeURIComponent(escape(atob(data.content)));
             return { success: true, content: decoded };
        }
        return { success: false, content: '', message: 'Invalid file format or not a file' };

    } catch (e: any) {
        return { success: false, content: '', message: e.message };
    }
};

/**
 * Fetches the entire repository as a Zip Archive (ArrayBuffer)
 */
export const fetchRepoZip = async (config: GithubConfig): Promise<{ success: boolean, data?: ArrayBuffer, message?: string }> => {
    try {
        // We use the api endpoint which redirects to codeload
        const response = await fetch(
            `${BASE_URL}/repos/${config.owner}/${config.repo}/zipball/${config.branch}`,
            {
                headers: {
                    Authorization: `Bearer ${config.token}`,
                    Accept: 'application/vnd.github.v3+json',
                },
            }
        );

        if (!response.ok) {
            // Check for CORS-like symptoms (status 0 or generic error often masked by fetch)
            const isCorsLikely = response.status === 0 || (response.type === 'opaque');
            if (isCorsLikely || response.status === 404) {
                 return { 
                    success: false, 
                    message: `Fetch failed (${response.status}). Private repositories often block direct browser downloads due to CORS. Use the manual download fallback.` 
                };
            }
            return { 
                success: false, 
                message: `Fetch failed (${response.status})` 
            };
        }

        const arrayBuffer = await response.arrayBuffer();
        return { success: true, data: arrayBuffer };
    } catch (e: any) {
        return { 
            success: false, 
            message: `${e.message}. (Hint: CORS blocks redirects for private repos. Please use the manual download link provided below.)` 
        };
    }
};

/**
 * Triggers a GitHub Actions Workflow (Cloud Run)
 */
export const triggerWorkflowDispatch = async (
    config: GithubConfig, 
    workflowId: string, 
    ref: string
): Promise<FileOperationResult> => {
    try {
        // Note: workflowId can be the filename (e.g., main.yml) or the numeric ID
        const response = await fetch(
            `${BASE_URL}/repos/${config.owner}/${config.repo}/actions/workflows/${workflowId}/dispatches`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.token}`,
                    Accept: 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ref: ref || config.branch })
            }
        );

        if (response.ok) {
             return { success: true, message: `Triggered workflow '${workflowId}' on branch '${ref || config.branch}'` };
        } else {
             let errData;
             try { errData = await response.json(); } catch (e) {}
             const msg = parseGithubError(errData, 'Failed to trigger workflow');
             return { success: false, message: msg };
        }
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};
