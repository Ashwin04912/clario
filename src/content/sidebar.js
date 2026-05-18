/**
 * DocMindSidebar - Manages the Chat assistant sidebar view.
 * Inherits structural abstraction from BaseUIComponent.
 */
class DocMindSidebar extends BaseUIComponent {
  constructor(root) {
    super(root);
    this.activeDiggingTopic = null;
    this.buildUI();
    this.attachListeners();
  }

  buildUI() {
    // Floating Action Button
    this.fab = document.createElement('div');
    this.fab.id = 'docmind-fab';
    this.fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    this.root.appendChild(this.fab);

    // Main Chat Sidebar Overlay
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'docmind-sidebar';
    this.sidebar.innerHTML = `
      <div class="docmind-header">
        <div class="docmind-title">
          <img src="${chrome.runtime.getURL('icons/logo.png')}" class="docmind-logo" alt="clarior logo">
          clarior
        </div>
        <div class="docmind-close" id="docmind-close-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </div>
      </div>
      
      <div class="docmind-content">
        <div class="docmind-actions">
          <button class="docmind-action-btn primary" id="btn-simplify">Simplify Page</button>
          <button class="docmind-action-btn secondary" id="btn-explain-code">Explain Code</button>
        </div>

        <div class="docmind-topics-section" id="docmind-topics-section" style="display: none;">
          <div class="docmind-topics-header">🧠 Simplified Topics (Click to Dig Deeper)</div>
          <div class="docmind-topics-pills" id="docmind-topics-pills"></div>
        </div>
        
        <div class="docmind-chat" id="docmind-chat">
          <div class="docmind-message ai">Hi! I'm your documentation assistant. How can I help you today?</div>
        </div>
      </div>

      <div class="docmind-input-area">
        <div class="docmind-input-box">
          <input type="text" class="docmind-input" id="docmind-input" placeholder="Ask a question about this page...">
          <button class="docmind-send" id="docmind-send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    `;
    this.root.appendChild(this.sidebar);

    this.chatContainer = document.getElementById('docmind-chat');
    this.inputField = document.getElementById('docmind-input');
    this.sendBtn = document.getElementById('docmind-send');
    this.topicsSection = document.getElementById('docmind-topics-section');
    this.topicsPills = document.getElementById('docmind-topics-pills');
  }

  attachListeners() {
    this.fab.addEventListener('click', () => this.toggle(true));
    document.getElementById('docmind-close-btn').addEventListener('click', () => this.toggle(false));

    document.getElementById('btn-simplify').addEventListener('click', () => {
      const pageText = document.body.innerText.substring(0, 5000);
      this.handleUserRequest("Simplify this page", `Simplify this documentation page for a beginner:\n\n${pageText}`);
    });

    document.getElementById('btn-explain-code').addEventListener('click', () => {
      const pageText = document.body.innerText.substring(0, 5000);
      this.handleUserRequest("Explain the code on this page", `Explain the main code snippets found on this page:\n\n${pageText}`);
    });

    this.sendBtn.addEventListener('click', () => this.sendInputMsg());
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendInputMsg();
    });

    // Message listener to trigger view open state
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'openSidebar') {
        this.toggle(true);
        sendResponse({ status: 'opened' });
      }
    });

    // Listen for new jargon selections to update the topic history list
    window.addEventListener('docMindTopicSimplified', () => this.renderTopicsList());
  }

  renderTopicsList() {
    const history = window.docMindHistory || [];
    if (history.length === 0) {
      this.topicsSection.style.display = 'none';
      return;
    }

    this.topicsSection.style.display = 'block';
    this.topicsPills.innerHTML = '';

    history.forEach((item, index) => {
      const pill = document.createElement('div');
      pill.className = 'docmind-topic-pill';
      if (this.activeDiggingTopic && this.activeDiggingTopic.topic === item.topic) {
        pill.classList.add('active');
      }
      pill.innerText = item.topic;
      pill.title = `Click to ask questions about "${item.topic}"`;

      pill.addEventListener('click', () => {
        // Toggle active digging state
        document.querySelectorAll('.docmind-topic-pill').forEach(p => p.classList.remove('active'));

        if (this.activeDiggingTopic && this.activeDiggingTopic.topic === item.topic) {
          // Deselect
          this.activeDiggingTopic = null;
          this.addMessage("Focused back on the entire page.", 'ai');
        } else {
          // Select
          this.activeDiggingTopic = item;
          pill.classList.add('active');
          this.addMessage(`Focused on **"${item.topic}"**. I have loaded its simplified explanation. Ask me any follow-up questions about it!`, 'ai');
        }
      });

      this.topicsPills.appendChild(pill);
    });
  }

  toggle(isOpen) {
    if (isOpen) {
      this.sidebar.classList.add('open');
      this.fab.style.display = 'none';
      this.renderTopicsList(); // Refresh list on open
    } else {
      this.sidebar.classList.remove('open');
      setTimeout(() => this.fab.style.display = 'flex', 300);
    }
  }

  addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `docmind-message ${sender}`;
    msg.innerHTML = DocMindAPI.parseMarkdown(text);
    this.chatContainer.appendChild(msg);
    this.scrollToBottom();
  }

  showTyping() {
    const msg = document.createElement('div');
    msg.className = 'docmind-message ai docmind-typing-container';
    msg.innerHTML = `<div class="docmind-typing"><div class="docmind-typing-dot"></div><div class="docmind-typing-dot"></div><div class="docmind-typing-dot"></div></div>`;
    this.chatContainer.appendChild(msg);
    this.scrollToBottom();
    return msg;
  }

  scrollToBottom() {
    const contentArea = document.querySelector('.docmind-content');
    if (contentArea) contentArea.scrollTop = contentArea.scrollHeight;
  }

  async handleUserRequest(displayMsg, apiPrompt) {
    this.addMessage(displayMsg, 'user');
    const typingIndicator = this.showTyping();

    try {
      const result = await DocMindAPI.ask(apiPrompt);
      typingIndicator.remove();
      this.addMessage(result, 'ai');
    } catch (error) {
      typingIndicator.remove();
      this.addMessage(`⚠️ Error: ${error.message}`, 'ai');
    }
  }

  sendInputMsg() {
    const text = this.inputField.value.trim();
    if (!text) return;
    this.inputField.value = '';

    let prompt = "";
    if (this.activeDiggingTopic) {
      prompt = `You are a helpful AI assistant. The user is asking a follow-up question about a specific topic they previously simplified.
Topic: "${this.activeDiggingTopic.topic}"
Original AI Explanation: "${this.activeDiggingTopic.explanation}"

User Question: "${text}"

Please provide a deep, highly detailed response to answer their question. Keep it easy to understand but highly informative. Use HTML tags for formatting.`;
    } else {
      const pageText = document.body.innerText.substring(0, 3000);
      prompt = `Context from current page: ${pageText}\n\nUser Question: ${text}`;
    }

    this.handleUserRequest(text, prompt);
  }
}
