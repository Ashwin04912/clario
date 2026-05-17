/**
 * Abstract class representing a UI component in the DOM.
 * Enforces abstraction and modular design.
 */
class BaseUIComponent {
  constructor(root) {
    if (new.target === BaseUIComponent) {
      throw new TypeError("Cannot construct BaseUIComponent instances directly.");
    }
    if (!root) {
      throw new Error("BaseUIComponent requires a root element.");
    }
    this.root = root;
  }

  /**
   * Abstract method: Build the DOM structure.
   */
  buildUI() {
    throw new Error("Method 'buildUI()' must be implemented.");
  }

  /**
   * Abstract method: Attach event listeners to components.
   */
  attachListeners() {
    throw new Error("Method 'attachListeners()' must be implemented.");
  }
}
