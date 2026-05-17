console.log("DocMind AI Background Script Booted Up.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (request.action === 'askAI') {
    handleAIRequest(request.prompt).then((res) => {
      console.log("Sending response back to popup:", res);
      sendResponse(res);
    }).catch((err) => {
      console.error("Handler error:", err);
      sendResponse({ error: err.toString() });
    });
    return true; // Indicates asynchronous response
  }
});

async function handleAIRequest(prompt) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['docMindProvider', 'docMindApiKey'], async (config) => {
      if (!config.docMindApiKey) {
        resolve({ error: "API key is missing. Please set it in the extension popup." });
        return;
      }

      try {
        let textResponse = "";
        
        if (config.docMindProvider === 'openai') {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.docMindApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: prompt }]
            })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          textResponse = data.choices[0].message.content;
          
        } else if (config.docMindProvider === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': config.docMindApiKey
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          textResponse = data.candidates[0].content.parts[0].text;
        }

        resolve({ result: textResponse });
      } catch (err) {
        resolve({ error: err.message || "Failed to fetch from AI provider." });
      }
    });
  });
}
