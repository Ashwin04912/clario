/**
 * DocMind AI - Main Entry Point (Content Script)
 * Bootstraps individual structural subcomponents loaded via manifest.js.
 */
const initDocMind = () => {
  if (document.getElementById('docmind-ai-root')) return; // Prevent double injection
  
  // Dynamically attach main fonts
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  link.rel = 'stylesheet';
  document.head.appendChild(link);

  // Setup extension root block
  const root = document.createElement('div');
  root.id = 'docmind-ai-root';
  document.body.appendChild(root);

  // Setup shared history state for Simplified Topics
  window.docMindHistory = [];

  // Instantiate Modules (defined in src/)
  new DocMindSidebar(root);
  new DocMindJargonExplainer(root);
};

// Bootstrap application immediately
initDocMind();
