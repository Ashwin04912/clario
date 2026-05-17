/**
 * PopupController - Controls DOM interaction and scripting delegation inside the extension Popup.
 */
class PopupController {
  constructor() {
    this.cacheDOM();
    this.init();
  }

  cacheDOM() {
    this.form = document.getElementById('setupForm');
    this.nameInput = document.getElementById('name');
    this.providerSelect = document.getElementById('provider');
    this.apikeyInput = document.getElementById('apikey');
    
    this.setupView = document.getElementById('setup-view');
    this.dashboardView = document.getElementById('dashboard-view');
    this.welcomeText = document.getElementById('welcome-text');
    
    this.logoutBtn = document.getElementById('btn-logout');
    this.simplifyBtn = document.getElementById('btn-simplify-page');
    this.openSidebarBtn = document.getElementById('btn-open-sidebar');
  }

  async init() {
    const config = await AuthManager.getConfig();
    if (config.docMindName) this.nameInput.value = config.docMindName;
    if (config.docMindProvider) this.providerSelect.value = config.docMindProvider;
    if (config.docMindApiKey) this.apikeyInput.value = config.docMindApiKey;

    if (config.docMindApiKey) {
      this.showDashboard(config.docMindName);
    } else {
      this.showSetup();
    }

    this.bindEvents();
  }

  showDashboard(name) {
    if (this.setupView) this.setupView.style.display = 'none';
    if (this.dashboardView) this.dashboardView.style.display = 'flex';
    if (this.welcomeText) this.welcomeText.innerText = `Welcome, ${name || 'Explorer'}!`;
  }

  showSetup() {
    if (this.setupView) this.setupView.style.display = 'block';
    if (this.dashboardView) this.dashboardView.style.display = 'none';
  }

  bindEvents() {
    if (this.form) this.form.addEventListener('submit', (e) => this.handleSave(e));
    if (this.logoutBtn) this.logoutBtn.addEventListener('click', () => this.handleLogout());
    if (this.openSidebarBtn) {
      this.openSidebarBtn.addEventListener('click', () => this.handleOpenSidebar());
    }
    if (this.simplifyBtn) this.simplifyBtn.addEventListener('click', () => this.handleSimplify());
  }

  async handleSave(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = this.getSpinnerHTML('Validating...');
    btn.disabled = true;

    const isValid = await AuthManager.validateApiKey(this.providerSelect.value, this.apikeyInput.value);

    if (!isValid) {
      btn.innerHTML = `Invalid API Key`;
      btn.style.background = 'linear-gradient(to right, #EF4444, #DC2626)';
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 2500);
      return;
    }

    await AuthManager.saveConfig(this.nameInput.value, this.providerSelect.value, this.apikeyInput.value);
    
    btn.innerHTML = `Saved & Ready!`;
    btn.style.background = 'linear-gradient(to right, #10B981, #059669)';
    
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
      btn.disabled = false;
      this.showDashboard(this.nameInput.value);
    }, 1500);
  }

  async handleLogout() {
    await AuthManager.clearApiKey();
    if (this.apikeyInput) this.apikeyInput.value = '';
    this.showSetup();
  }

  async handleOpenSidebar() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { action: 'openSidebar' });
        window.close();
      }
    } catch {
      alert("Please refresh the current webpage first so the extension can attach itself!");
    }
  }

  async handleSimplify() {
    const originalContent = this.simplifyBtn.innerHTML;
    this.simplifyBtn.innerHTML = this.getSpinnerHTML('Analyzing Selection...');
    this.simplifyBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url.startsWith('http')) {
        throw new Error("Cannot run on this page.");
      }

      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (res) => {
          if (chrome.runtime.lastError) reject(new Error("Service Worker inactive. Re-open extension!"));
          else resolve(res);
        });
      });

      const learningStyle = document.getElementById('learning-style').value;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.toString().trim() === "") {
            return null;
          }
          const range = selection.getRangeAt(0);
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(range.cloneContents());
          tempDiv.querySelectorAll('script, style').forEach(el => el.remove());
          return tempDiv.innerHTML;
        }
      });

      const pageText = results[0].result;
      if (!pageText) {
        throw new Error("Please highlight some text on the page first!");
      }

      const prompt = `You are a helpful AI assistant. The user highlighted the following text on a documentation page: "${pageText}".
Target Audience & Style: ${learningStyle}

Instructions:
1. If it's a short word/topic, give a short, concise explanation of what it means.
2. If it's a longer paragraph/sentence, provide a simplified, beginner-friendly rewrite/summary of what it is saying.
3. Keep it brief since this will be displayed inside a small tooltip. Do NOT use fake image URLs. Use simple HTML formatting like <strong>, <code>, or <ul> if needed.
4. Return ONLY the raw HTML content, without any markdown wrappers like \`\`\`html.`;

      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'askAI', prompt }, (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      });

      if (response.error) throw new Error(response.error);

      const finalHtml = response.result.replace(/```html/g, '').replace(/```/g, '');

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (htmlContent) => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          
          const selectedText = selection.toString().trim();
          const range = selection.getRangeAt(0);
          const originalFragment = range.extractContents();
          
          const wrapper = document.createElement('span');
          wrapper.style.cssText = 'background: rgba(255, 0, 122, 0.15); border-bottom: 2px dashed #FF007A; cursor: help; position: relative; border-radius: 4px; padding: 0 4px; transition: background 0.2s; display: inline-block;';
          
          const icon = document.createElement('span');
          icon.innerHTML = ' 💬';
          icon.style.fontSize = '14px';
          icon.style.verticalAlign = 'text-bottom';
          
          const tooltip = document.createElement('div');
          tooltip.style.cssText = 'display: none; position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%); width: 350px; padding: 16px; background: #0A0A0C; color: #E5E7EB; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); border: 1.5px solid #00F0FF; z-index: 2147483647; line-height: 1.6; font-weight: normal; text-align: left; cursor: default;';
          tooltip.innerHTML = `
            <div style="font-size: 11px; font-weight: 700; color: #00F0FF; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">clario explanation</div>
            <div style="max-height: 300px; overflow-y: auto;">
              ${htmlContent}
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 12px; height: 12px; background: #0A0A0C; border-right: 1.5px solid #00F0FF; border-bottom: 1.5px solid #00F0FF;"></div>
          `;
          
          wrapper.appendChild(originalFragment);
          wrapper.appendChild(icon);
          wrapper.appendChild(tooltip);
          
          let timeout;
          wrapper.addEventListener('mouseenter', () => {
            clearTimeout(timeout);
            tooltip.style.display = 'block';
          });
          wrapper.addEventListener('mouseleave', () => {
            timeout = setTimeout(() => { tooltip.style.display = 'none'; }, 200);
          });
          
          wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
          });
          
          range.insertNode(wrapper);
          selection.removeAllRanges();

          // Store in shared history list
          if (!window.docMindHistory) window.docMindHistory = [];
          const exists = window.docMindHistory.some(item => item.topic.toLowerCase() === selectedText.toLowerCase());
          if (!exists) {
            window.docMindHistory.push({
              topic: selectedText,
              explanation: htmlContent
            });
            window.dispatchEvent(new CustomEvent('docMindTopicSimplified'));
          }
        },
        args: [finalHtml]
      });

      this.simplifyBtn.innerHTML = `Success!`;
      this.simplifyBtn.style.background = 'linear-gradient(to right, #10B981, #059669)';
    } catch (err) {
      console.error(err);
      let errMsg = err.message || "Cannot run here";
      if (errMsg.length > 30) errMsg = errMsg.substring(0, 30) + '...';
      this.simplifyBtn.innerHTML = `Error: ${errMsg}`;
      this.simplifyBtn.style.background = '#DC2626';
    }

    setTimeout(() => {
      this.simplifyBtn.innerHTML = originalContent;
      this.simplifyBtn.style.background = '';
      this.simplifyBtn.disabled = false;
    }, 3000);
  }

  getSpinnerHTML(text) {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" style="margin-right: 4px; vertical-align: middle;">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      </svg>
      ${text}
    `;
  }
}
