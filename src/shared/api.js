/**
 * DocMind AI - API Manager & Shared Utilities
 * Encapsulates background-script message passing and format rendering.
 */
class DocMindAPI {
  /**
   * Sends prompt payload to Service Worker (background.js).
   * @param {string} prompt 
   * @returns {Promise<string>}
   */
  static async ask(prompt) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'askAI', prompt }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (res && res.error) {
          reject(new Error(res.error));
        } else {
          resolve(res ? res.result : '');
        }
      });
    });
  }

  /**
   * Helper utility to render basic markdown in UI elements.
   * @param {string} text 
   * @returns {string} Safe HTML representation of markdown
   */
  static parseMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\`\`\`([\s\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
      .replace(/\`([^`]+)\`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }
}
