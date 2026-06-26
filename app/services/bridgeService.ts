
import { BridgeStatus } from "../types";
import { getAllowedOrigins, isOriginAllowed, isSafeUrl } from "./safety.mjs";

const BRIDGE_URL = "http://localhost:8000";

export const BRIDGE_SERVER_SCRIPT = `
import sys
import os
import subprocess
import json
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS

# --- PowerCoder-Z Local Bridge ---
# Run this script to enable local execution and web crawling capabilities.
# Install requirements: pip install flask flask-cors requests beautifulsoup4

app = Flask(__name__)
allowed_origins = {origin for origin in os.getenv('POWERCODER_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000').split(',') if origin}
CORS(app, origins=allowed_origins, supports_credentials=False)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok", 
        "os": os.name, 
        "python": sys.version.split()[0],
        "cwd": os.getcwd()
    })

@app.route('/execute', methods=['POST'])
def execute():
    data = request.json
    code = data.get('code', '')
    env_vars = data.get('env', {})
    
    # Inject Env Vars for this execution context
    original_env = os.environ.copy()
    os.environ.update(env_vars)

    output_capture = []
    
    def custom_print(*args, **kwargs):
        sep = kwargs.get('sep', ' ')
        end = kwargs.get('end', '\\n')
        msg = sep.join(map(str, args)) + end
        output_capture.append(msg)

    try:
        # Capture stdout by redirecting print
        # Note: This is a simplified execution model. 
        # For heavy tasks, we might use subprocess, but exec() shares state better for notebooks.
        
        global_context = {
            "print": custom_print, 
            "os": os, 
            "sys": sys, 
            "subprocess": subprocess
        }
        
        exec(code, global_context)
        
        return jsonify({
            "success": True,
            "stdout": "".join(output_capture),
            "stderr": ""
        })
    except Exception as e:
        tb = traceback.format_exc()
        return jsonify({
            "success": False,
            "stdout": "".join(output_capture),
            "stderr": tb
        })
    finally:
        # Restore Env
        os.environ.clear()
        os.environ.update(original_env)

@app.route('/crawl', methods=['POST'])
def crawl():
    # Helper endpoint that uses simple requests+bs4
    # This prevents the need to generate complex boilerplate in the frontend
    try:
        import requests
        from bs4 import BeautifulSoup
        
        url = request.json.get('url')
        if not url: return jsonify({"error": "No URL provided"}), 400
        if not isSafeUrl(url):
            return jsonify({"error": "Only http/https URLs are allowed."}), 400
        
        headers = {"User-Agent": "PowerCoder-Z/1.0"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Remove scripts and styles
        for script in soup(["script", "style"]):
            script.extract()
            
        text = soup.get_text(separator='\\n')
        clean_text = '\\n'.join([line.strip() for line in text.splitlines() if line.strip()])
        
        return jsonify({
            "success": True,
            "url": url,
            "title": soup.title.string if soup.title else "",
            "content": clean_text[:50000] # Limit return size
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    print(f"🚀 PowerCoder-Z Bridge running on {BRIDGE_URL}")
    print("Press Ctrl+C to stop")
    app.run(host='localhost', port=8000)
`;

/**
 * Checks if the local bridge is running
 */
export const checkBridgeHealth = async (): Promise<BridgeStatus> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${BRIDGE_URL}/health`, { 
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                isConnected: true,
                os: data.os,
                pythonVersion: data.python,
                version: "1.0"
            };
        }
    } catch (e) {}
    
    return { isConnected: false };
};

/**
 * Executes Python code on the local machine
 */
export const executeOnBridge = async (code: string, env: Record<string, string>) => {
    try {
        const response = await fetch(`${BRIDGE_URL}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, env })
        });
        
        if (!response.ok) {
            throw new Error(`Bridge Error: ${response.statusText}`);
        }
        
        return await response.json(); // returns { success, stdout, stderr }
    } catch (e: any) {
        throw new Error(`Failed to communicate with Bridge: ${e.message}`);
    }
};

/**
 * Uses the bridge's built-in crawler
 */
export const crawlViaBridge = async (url: string) => {
    try {
        const response = await fetch(`${BRIDGE_URL}/crawl`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        return await response.json();
    } catch (e: any) {
        throw new Error(`Crawler Error: ${e.message}`);
    }
};
