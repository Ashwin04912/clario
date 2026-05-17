/**
 * AuthManager - Controls saving, fetching, and validating provider configurations
 * and credentials via Gemini/OpenAI endpoints.
 */
class AuthManager {
  /**
   * Verifies if the target API Key is valid with the provider.
   * @param {string} provider 
   * @param {string} apiKey 
   * @returns {Promise<boolean>}
   */
  static async validateApiKey(provider, apiKey) {
    try {
      if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return res.ok;
      } else if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ping' }] }]
          })
        });
        return res.ok;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Saves settings to Chrome storage.
   */
  static saveConfig(name, provider, apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        docMindName: name,
        docMindProvider: provider,
        docMindApiKey: apiKey
      }, resolve);
    });
  }

  /**
   * Clears API credentials from storage.
   */
  static clearApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['docMindApiKey'], resolve);
    });
  }

  /**
   * Fetches saved configuration from storage.
   * @returns {Promise<Object>}
   */
  static getConfig() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['docMindName', 'docMindProvider', 'docMindApiKey'], resolve);
    });
  }
}
