/**
 * DocMindJargonExplainer - Watches selection events on the page to display a floating
 * interactive button and context-appropriate AI tooltips.
 * Inherits structural blueprint from BaseUIComponent.
 */
class DocMindJargonExplainer extends BaseUIComponent {
  constructor(root) {
    super(root);
    this.currentSelectionText = '';
    this.buildUI();
    this.attachListeners();
  }

  buildUI() {
    this.btn = document.createElement('button');
    this.btn.id = 'docmind-jargon-btn';
    this.root.appendChild(this.btn);

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'docmind-jargon-tooltip';
    this.root.appendChild(this.tooltip);
  }

  attachListeners() {
    document.addEventListener('mouseup', (e) => this.handleSelection(e));
    document.addEventListener('mousedown', (e) => this.handleDismiss(e));
    this.btn.addEventListener('click', () => this.explainSelection());
  }

  handleSelection(e) {
    if (e.target.closest('#docmind-ai-root')) return;

    // Use a short delay so that browser double-click text selection resolves properly
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0 && text.length < 2000) {
        this.currentSelectionText = text;
        const rect = selection.getRangeAt(0).getBoundingClientRect();

        // Dynamically change action label based on selection content density
        this.btn.innerHTML = text.length > 80 ? `🪄 Simplify Text` : `🪄 Explain`;
        this.btn.style.display = 'flex';

        // Position immediately above selection
        setTimeout(() => {
          this.btn.style.top = `${rect.top + window.scrollY - 45}px`;
          this.btn.style.left = `${Math.max(10, rect.left + window.scrollX + (rect.width / 2) - (this.btn.offsetWidth / 2))}px`;
        }, 0);

        this.tooltip.style.display = 'none';
      } else {
        this.hideAll();
      }
    }, 10);
  }

  handleDismiss(e) {
    if (!e.target.closest('#docmind-jargon-btn') && !e.target.closest('#docmind-jargon-tooltip')) {
      this.hideAll();
    }
  }

  hideAll() {
    this.btn.style.display = 'none';
    this.tooltip.style.display = 'none';
    this.currentSelectionText = '';
  }

  async explainSelection() {
    if (!this.currentSelectionText) return;

    const btnTop = this.btn.style.top;
    const btnLeft = this.btn.style.left;

    this.btn.style.display = 'none';
    this.tooltip.style.display = 'block';
    this.tooltip.style.top = btnTop;
    this.tooltip.style.left = btnLeft;

    this.tooltip.innerHTML = `
      <div style="display:flex; justify-content:center; align-items:center; padding:10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg>
      </div>
    `;

    const prompt = this.currentSelectionText.length > 80
      ? `Rewrite this paragraph in simple, easy-to-understand English for a beginner. Keep the meaning same and make it clear and concise:\n\n"${this.currentSelectionText}"`
      : `Explain this technical term or jargon in a simple and beginner-friendly way in 1 or 2 sentences:\n\n"${this.currentSelectionText}"`;

    try {
      const result = await DocMindAPI.ask(prompt);
      this.tooltip.innerHTML = `
        <div style="font-weight: 700; color: var(--neon-cyan); margin-bottom: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">clarior dictionary</div>
        <div style="font-size: 14px; color: #FFF;">${DocMindAPI.parseMarkdown(result)}</div>
      `;

      // Store in shared history list
      if (!window.docMindHistory) window.docMindHistory = [];

      // Prevent duplicates
      const exists = window.docMindHistory.some(item => item.topic.toLowerCase() === this.currentSelectionText.toLowerCase());
      if (!exists) {
        window.docMindHistory.push({
          topic: this.currentSelectionText,
          explanation: result
        });
        window.dispatchEvent(new CustomEvent('docMindTopicSimplified'));
      }
    } catch (err) {
      this.tooltip.innerHTML = `<span style="color: #EF4444; font-size: 13px;">Error: ${err.message}</span>`;
    }
  }
}
