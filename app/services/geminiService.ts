
import { GoogleGenAI, Part } from "@google/genai";
import { Message, Attachment } from "../types";

// Lazy initialization
let ai: GoogleGenAI | null = null;

const getApiKey = () => {
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            return process.env.API_KEY || '';
        }
    } catch(e) {}
    return '';
};

const getAiClient = () => {
  if (!ai) {
    const apiKey = getApiKey();
    if (!apiKey) console.warn("API_KEY not found");
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
  return ai;
};

export const streamGeminiResponse = async (
  messages: Message[],
  newMessage: string,
  newAttachments: Attachment[],
  modelName: string = 'gemini-2.5-flash',
  thinkingBudget: number = 0
) => {
  
  const client = getAiClient();

  const history = messages.filter(m => !m.isStreaming).map(m => {
    const parts: Part[] = [];
    if (m.content) parts.push({ text: m.content });
    
    if (m.attachments && m.attachments.length > 0) {
      m.attachments.forEach(att => {
        if (att.isText) {
            parts.push({ text: `\n[File Attachment: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\`\n` });
        } else {
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: att.data
              }
            });
        }
      });
    }
    return { role: m.role, parts: parts };
  });

  const currentParts: Part[] = [{ text: newMessage }];
  
  if (newAttachments.length > 0) {
    newAttachments.forEach(att => {
        if (att.isText) {
            currentParts.push({ text: `\n[File Attachment: ${att.name}]\n\`\`\`\n${att.data}\n\`\`\`\n` });
        } else {
            currentParts.push({
                inlineData: {
                    mimeType: att.mimeType,
                    data: att.data
                }
            });
        }
    });
  }

  let systemInstruction = "You are PowerCoder-Z, an elite software engineer and automation expert. You write clean, efficient code.";
  systemInstruction += "\n\nRUNTIME ENVIRONMENTS:";
  systemInstruction += "\n1. BROWSER (Pyodide): Restricted sandbox. No sockets, no networking (except via micropip), no OS access. Use for pure logic, data processing, and visualization.";
  systemInstruction += "\n2. LOCAL BRIDGE (Native): Full access to the user's machine. Can run requests, selenium, docker, shell commands. Use this for Web Crawling, Scraping, and System Automation.";
  systemInstruction += "\n\nIf the user asks to 'Crawl' or 'Scrape' a website, generate a Python script using `requests` and `BeautifulSoup`. Asssume the user will run it in LOCAL mode.";
  systemInstruction += "\nWhen providing code, assume it might be run locally. Prefer standard libraries where possible.";

  const config: any = {
    systemInstruction: systemInstruction,
  };

  if (thinkingBudget > 0) {
      config.thinkingConfig = { thinkingBudget };
  }

  const chat = client.chats.create({
    model: modelName,
    config: config,
    history: history,
  });

  return await chat.sendMessageStream({ 
    message: {
      role: 'user',
      parts: currentParts 
    }
  });
};
