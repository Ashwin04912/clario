# 🌌 clarior Technical Documentation
### **The Architecture, Data Flow, and Design System of clarior**

**clarior** is an enterprise-grade, object-oriented, and highly modular Google Chrome Extension (Manifest V3) designed to serve as an intelligent, non-destructive explanation layer over complex documentation. This document provides a highly detailed guide explaining the entire technical stack, object-oriented directory structure, cross-module data flow pipelines, prompt engineering strategies, and the custom **Neon Noir** design system that powers **clarior**.

---

## 🏛️ 1. High-Level Architecture Overview

**clarior**'s execution is divided across three strictly decoupled extension environments that communicate securely using Chrome's tab messaging bus and asynchronous message passes:

```mermaid
graph TD
    subgraph Browser Action [Popup UI Environment]
        P[index.html / popup.html] --> PC[src/popup/controller.js: PopupController]
        PC --> AM[src/popup/auth.js: AuthManager]
    end

    subgraph Tab Web Page [Content Script DOM Environment]
        CS[content.js: Bootstrapper] --> S[src/content/sidebar.js: SidebarChat]
        CS --> J[src/content/jargon.js: JargonExplainer]
        S -. CustomEvent: docMindTopicSimplified .-> J
        J -. Dispatch Event .-> S
        
        S & J --> API[src/shared/api.js: DocMindAPI]
    end

    subgraph Chrome Background [Service Worker Environment]
        BG[background.js: Service Worker]
    end

    %% Communication channels
    AM -. chrome.storage.local .-> BG
    PC -. chrome.scripting.executeScript .-> Tab
    API -- chrome.runtime.sendMessage --> BG
    BG -- Fetch API Call --> Gemini[Google Gemini API]
    BG -- Fetch API Call --> OpenAI[OpenAI API]
    
    style Browser Action fill:#121214,stroke:#FF007A,stroke-width:2px,color:#FFF
    style Tab Web Page fill:#121214,stroke:#00F0FF,stroke-width:2px,color:#FFF
    style Chrome Background fill:#0A0A0C,stroke:#888,stroke-width:2px,color:#FFF
```

---

## 📂 2. Enterprise Directory & OOP Module Mapping

**clarior**'s codebase is designed with strict object-oriented programming (OOP) principles, clean class separations, inheritance, and modular interfaces:

```text
ai_doc_extension/
├── manifest.json         # Extension registry & sequential script injection
├── index.html            # Setup dashboard popup UI
├── style.css             # Neon Noir dashboard popup styling
├── content.css           # Content-script sliding sidebar & floating tooltip stylesheet
├── content.js            # Main content-script entry point bootstrapper
├── background.js         # Service worker handling secure, cross-origin AI broker requests
└── src/
    ├── shared/
    │   ├── ui-base.js    # BaseUIComponent abstract blueprint
    │   └── api.js        # Decoupled Markdown parser & API message broker
    ├── content/
    │   ├── jargon.js     # Text-selection and floating tooltip coordinator
    │   └── sidebar.js    # Dynamic chat companion & focus topic state controller
    └── popup/
        ├── auth.js       # Local credentials manager
        └── controller.js # Popup view layout and selection coordinator
```

### 🧬 Class Blueprints & Interfaces

#### 1. `BaseUIComponent` ([src/shared/ui-base.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/shared/ui-base.js))
An abstract base class that enforces design guidelines and template rules for all UI modules running inside the user's tab DOM.
*   **Constructor Guard**: Throws a `TypeError` if developer tries to instantiate it directly (`new.target === BaseUIComponent`).
*   **Parameters**: Requires a parent element `root`.
*   **Enforced Methods**:
    *   `buildUI()`: Responsible for constructing the DOM layout.
    *   `attachListeners()`: Handles connecting browser events to callback handlers.

#### 2. `DocMindAPI` ([src/shared/api.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/shared/api.js))
A helper and broker class carrying static utilities for secure message brokerage:
*   `ask(prompt)`: Wraps `chrome.runtime.sendMessage` into a clean, modern Promise pattern. It automatically catches runtime errors or failures inside background workers.
*   `parseMarkdown(text)`: A custom RegExp parser that processes Markdown syntax safely:
    *   Bold markers (`**text**` ➡️ `<strong>text</strong>`)
    *   Multi-line code snippets (` ```code``` ` ➡️ `<pre><code>code</code></pre>`)
    *   Inline code highlights (`` `code` `` ➡️ `<code>code</code>`)
    *   Line-breaks (`\n` ➡️ `<br>`)

#### 3. `DocMindJargonExplainer` ([src/content/jargon.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/content/jargon.js))
Inherits from `BaseUIComponent` and controls text highlight triggers:
*   **Highlight Watcher**: Listens to mouse actions to capture text selections between `0` and `2000` characters.
*   **Position Engine**: Calculates coordinates via `.getBoundingClientRect()` to position a floating, glowing trigger button immediately above selections.
*   **Tooltip Builder**: Displays inline overlays containing simplified text definitions and logs the simplified concept inside `window.docMindHistory` to trigger sidebar state updates.

#### 4. `DocMindSidebar` ([src/content/sidebar.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/content/sidebar.js))
Inherits from `BaseUIComponent` and manages the sliding sidebar dashboard:
*   **Interactive Sidebar panel**: Slides smoothly from the right edge.
*   **"Dig Deeper" Focus Controller**: Renders dynamic topic tags. Clicking a topic tag toggles an active topic state `activeDiggingTopic` which focuses all subsequent prompts on that jargon.

#### 5. `AuthManager` ([src/popup/auth.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/popup/auth.js))
Handles user session configuration and validation:
*   `validateApiKey(provider, apiKey)`: Executes secure fetch validations directly to OpenAI or Google Gemini REST endpoints.
*   `saveConfig()` & `getConfig()`: Integrates local storage persistence via the Chrome storage engine.

#### 6. `PopupController` ([src/popup/controller.js](file:///Users/keyloggers/extensions/ai_doc_extension/src/popup/controller.js))
Coordinates popup panels, inputs, selector configurations, and handles the **"Explain / Simplify Highlight"** trigger.

---

## 🔄 3. Data Flow & Lifecycle Pipelines

### 🔑 A. API Key Configuration & Validation Flow

When a user initializes **clarior** via the popup UI, credentials follow a secure sandbox pipeline:

```text
[Popup Input Form] --(name, provider, apiKey)--> [AuthManager.validateApiKey]
                                                            |
                                               [HTTP Fetch call validation]
                                              /                            \
                                      (Valid OK: 200)             (Invalid / Failed)
                                            |                              |
                                [chrome.storage.local]             [Popup Error Animation]
                                            |
                                  [Dashboard Rendered]
```

*   **OpenAI Validation Endpoint**: `https://api.openai.com/v1/models` (validates API key with a simple models query request).
*   **Google Gemini Validation Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent` (executes a lightweight `"ping"` content payload query).

---

### 🪄 B. Highlight-to-Simplify Pipeline

When a user highlights text inside a web documentation page, the event flows through highly synchronized UI layers:

```text
1. User Selects Text (DOM mouseup) ---> 2. JargonExplainer captures Selection
                                                       |
                                        3. Floating explain-badge is shown above text
                                                       | (User clicks badge)
                                        4. Tooltip shows Loader Animation & queries DocMindAPI
                                                       |
                                        5. Content-Script dispatches message to Service Worker
                                                       |
                                        6. Service Worker calls API Endpoint and returns Markdown
                                                       |
                                        7. Markdown parsed by DocMindAPI and inserted into Tooltip
                                                       |
                                        8. Selection details pushed to window.docMindHistory
                                                       |
                                        9. CustomEvent 'docMindTopicSimplified' dispatched
                                                       |
                                       10. Sidebar receives event & renders a new Dig Deeper Pill
```

---

### 🧠 C. "Dig Deeper" Event Synchronization

The tab's DOM acts as a centralized events bus:
*   When jargon is simplified, `DocMindJargonExplainer` adds the topic metadata (`{ topic, explanation }`) to `window.docMindHistory`.
*   It dispatches a custom window event:
    ```javascript
    window.dispatchEvent(new CustomEvent('docMindTopicSimplified'));
    ```
*   `DocMindSidebar` listens to `docMindTopicSimplified` and immediately re-evaluates the array, rendering active topic tags with distinct click triggers.
*   Clicking a pill locks the UI context on that specific keyword, changing chatbot instructions automatically.

---

## 🎨 4. Neon Noir Design System

The visual design system of **clarior** is modern, dark, high-contrast, and custom-styled using HSL gradients, glassmorphism, and neon glows:

### 🎨 Color Palette Tokens
| Token Name | Hex Value | Role |
| :--- | :--- | :--- |
| **`--neon-pink`** | `#FF007A` | Primary Action Buttons, User chat bubbles, glowing borders |
| **`--neon-cyan`** | `#00F0FF` | Tooltip borders, AI chat highlights, loader spinners, success states |
| **`--bg-obsidian`** | `#0A0A0C` | Matte black cards, chat backdrops, setup panels |
| **`--bg-card`** | `#121214` | Card segments, sidebar overlays |
| **`--text-primary`**| `#FFFFFF` | Headings, main text content |
| **`--text-secondary`**| `#9CA3AF`| Captions, subtitle notice panels, placeholders |

### ✨ Premium Micro-Animations
*   **Glow Effects**: Action elements and inputs feature subtle glowing drop-shadow overlays using `box-shadow`:
    ```css
    box-shadow: 0 0 20px rgba(255, 0, 122, 0.4);
    ```
*   **Smooth Transitions**: Transitions for sidebar slide-ins, hovers, and loader fade-ins use:
    ```css
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ```
*   **Spinning Loader**: Custom vector spinner animations rotate infinitely with a `@keyframes spin` declaration:
    ```css
    transform: rotate(360deg);
    ```

---

## 🔒 5. AI Prompt Engineering

**clarior** uses tailored system prompt instructions that prioritize clarity, analogies, and strictly prevent bias or brand naming:

### 📖 Word-Selection (Dictionary Explainer) Prompt:
Used when selection length is **under 80 characters**:
> *"Explain this technical term or jargon in a simple and beginner-friendly way in 1 or 2 sentences:\n\n\"[SELECTED_WORD]\""*

### 📝 Paragraph-Selection (Simplifier) Prompt:
Used when selection length is **over 80 characters**:
> *"Rewrite this paragraph in simple, easy-to-understand English for a beginner. Keep the meaning same and make it clear and concise:\n\n\"[SELECTED_PARAGRAPH]\""*

### 💬 "Dig Deeper" Focus Chat Prompt:
Used when a user locks focus onto a specific topic pill and sends follow-up questions:
> *"You are a helpful AI assistant. The user is asking a follow-up question about a specific topic they previously simplified.*
> *Topic: \"[ACTIVE_TOPIC]\"*
> *Original AI Explanation: \"[ORIGINAL_EXPLANATION]\"*
> 
> *User Question: \"[USER_QUESTION]\"*
> 
> *Please provide a deep, highly detailed response to answer their question. Keep it easy to understand but highly informative. Use HTML tags for formatting."*

### 🎓 Custom Learning Style Tuning (Popup Dashboard):
*   **Beginner Level**: `Beginner Level (Explain like I'm 5, use analogies and simple terms)`
*   **Quick Revision**: `Quick Revision (Bullet points, key takeaways, and flashcard style)`
*   **Very Concise**: `Very Concise (Short executive summary, straight to the point)`

---

## 🚀 6. Advanced Extension Mechanisms

1.  **Manifest V3 Declarations**: Fully compliant with Chrome MV3 security policies. Relies on a Service Worker (`background.js`) to process cross-origin queries securely, bypassing CORS constraints on external pages.
2.  **Sequential Content Injection**: To prevent execution race-conditions, the extension loads files sequentially:
    ```json
    "js": [
        "src/shared/ui-base.js",
        "src/shared/api.js",
        "src/content/sidebar.js",
        "src/content/jargon.js",
        "content.js"
    ]
    ```
    This ensures that structural base blueprints exist globally in memory before content bootstrappers reference them.
3.  **Local-First Privacy**: Stored securely via standard `chrome.storage.local`. All API operations run in the background, keeping credentials protected from malicious tab-script inspections.
