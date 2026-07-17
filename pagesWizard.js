// PagesWizard.js

class PagesWizard {
  constructor(container, stateOrEngine, flow, idOverride, options = {}) {
    console.log("NEW PageWizard" + " " + (new Date().toISOString().substr(14, 5)));
    this.instanceId = idOverride || ("PW_" + Math.random().toString(36).substr(2, 5));
    this.container = container;
    
    if (typeof focusManager !== "undefined") {
      focusManager.registerContainer(this.container);
    }

    if (stateOrEngine instanceof RecauseEngine) {
      this.scopedEngine = stateOrEngine;
      this.recauseEngine = stateOrEngine.rootEngine;
    } else {
      this.recauseEngine = new RecauseEngine(stateOrEngine, this.#wrappingFlow, "PagesWizard", options);
      this.scopedEngine = this.recauseEngine.scope("");
    }
    
    this.flow = flow;

    // Use AsyncWizard for async operations if loaded
    const AsyncW = typeof AsyncWizard !== "undefined" ? AsyncWizard : (typeof require !== "undefined" ? require("./asyncWizard").AsyncWizard : null);
    if (AsyncW) {
      this.asyncWizard = new AsyncW({
        ...this.scopedEngine.getAPI(),
        say: this.say.bind(this),
        runFlow: this.runFlow.bind(this)
      });
    }

    this.api = {
      ...this.scopedEngine.getAPI(),
      runFlow: this.runFlow.bind(this),
      beginPage: this.beginPage.bind(this),
      endPage: this.endPage.bind(this),
      affordBack: this.affordBack.bind(this),
      affordNext: this.affordNext.bind(this),
      pushIndent: this.pushIndent.bind(this),
      popIndent: this.popIndent.bind(this),
      setIndent: this.setIndent.bind(this),
      say: this.say.bind(this),
      
      // Semantic & Legacy nested APIs
      chat: this.chat.bind(this),
      askChat: this.askChat.bind(this),
      embedChat: this.embedChat.bind(this),
      askForm: this.askForm.bind(this),
      embedForm: this.embedForm.bind(this),
    };
    if (this.asyncWizard) {
      this.api.askData = this.asyncWizard.askData.bind(this.asyncWizard);
    }
  }

  #nextFid() {
    return `${this.instanceId}_${this.seq++}`;
  }

  #s() {
    return "  ".repeat(this.recauseEngine.getParentCount());
  }

  #wrappingFlow = () => {
    const originalContainer = this.container;
    const tempContainer = document.createElement("div");
    this.container = tempContainer;

    this.pageCounter = 0;
    this.activePage = false;
    this.indentLevel = 0;
    this.seq = 0; // Reset seq
    this.currentPageNextLabel = null;
    this.currentPageBackLabel = null;
    this.buttonsRendered = false;

    try {
      this.flow({ ...this.api });
    } catch (e) {
      if (e instanceof StopFlow) {
        if (this.activePage && !this.buttonsRendered) {
          const idx = this.scopedEngine.getValue("pagewizard.pageIndex") || 0;
          if (idx > 0 && this.currentPageBackLabel !== false) {
            this.affordBack(this.currentPageBackLabel);
          }
        }
        throw e;
      } else {
        throw e;
      }
    } finally {
      this.container = originalContainer;
      if (typeof this.container.replaceChildren === "function") {
        this.container.replaceChildren(...tempContainer.childNodes);
      } else {
        this.container.innerHTML = "";
        while (tempContainer.firstChild) {
          this.container.appendChild(tempContainer.firstChild);
        }
      }
    }
  }

  discardPendingCommits() {
    if (typeof FormWizard !== "undefined" && FormWizard.activeWizards) {
      for (const w of FormWizard.activeWizards) {
        w.pendingCommits = [];
      }
    }
  }

  runFlow(options = {}) {
    if (typeof FormWizard !== "undefined" && FormWizard.activeWizards) {
      for (const w of FormWizard.activeWizards) {
        w.flushPendingCommits();
      }
      FormWizard.activeWizards.clear();
    }
    const checkpoint = options.checkpoint !== false;
    if (typeof focusManager !== "undefined") {
      focusManager.captureFocus();
      // Set the isWashing flag to true during the DOM-wash phase to catch and ignore synthetic
      // browser blur events triggered when active focused elements are removed from the DOM.
      focusManager.isWashing = true;
    }
    this.recauseEngine.runFlow();
    if (checkpoint) {
      this.recauseEngine.checkpoint();
    }
    if (typeof focusManager !== "undefined") {
      focusManager.isWashing = false;
      focusManager.restoreFocus(this.scopedEngine.getValue("pagewizard.pageIndex"));
    }
  }

  // Instance method implementations:

  beginPage(title, nextLabel = "Next >>", backLabel = "<< Back") {
    if (this.activePage) this.endPage();
    this.pageCounter++;
    const idx = this.scopedEngine.getValue("pagewizard.pageIndex") || 0;
    if ((this.pageCounter - 1) === idx) {
      this.activePage = true;
      this.currentPageNextLabel = nextLabel;
      this.currentPageBackLabel = backLabel;
      const pageBlock = document.createElement('div');
      pageBlock.className = 'page-block';
      const titleDiv = document.createElement('div');
      titleDiv.className = 'page-title';
      titleDiv.textContent = title;
      pageBlock.appendChild(titleDiv);
      this.container.appendChild(pageBlock);
    }
  }

  endPage() {
    if (this.activePage) {
      const idx = this.scopedEngine.getValue("pagewizard.pageIndex") || 0;
      if (idx > 0 && this.currentPageBackLabel !== false) {
        this.affordBack(this.currentPageBackLabel);
      }
      if (this.currentPageNextLabel !== false) {
        this.affordNext(this.currentPageNextLabel);
      }
      this.scopedEngine.stopFlow();
    }
  }

  affordBack(label) {
    if (!this.activePage) return;
    this.buttonsRendered = true;
    const row = this.#getButtonRow();
    if (row.querySelector('[data-path="pagewizard.back"]')) return;
    const btn = document.createElement('button');
    btn.className = 'page-button';
    btn.textContent = label || "Back";
    btn.setAttribute('data-path', "pagewizard.back");

    const fid = this.#nextFid();
    btn.setAttribute('data-fid', fid);

    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = () => {
      const idx = this.scopedEngine.getValue("pagewizard.pageIndex") || 0;
      if (idx > 0) this.scopedEngine.setValue("pagewizard.pageIndex", idx - 1);
      this.runFlow();
    };
    row.appendChild(btn);
  }

  affordNext(label) {
    if (!this.activePage) return;
    this.buttonsRendered = true;
    const row = this.#getButtonRow();
    if (row.querySelector('[data-path="pagewizard.next"]')) return;
    const btn = document.createElement('button');
    btn.className = 'page-button';
    btn.textContent = label || "Next";
    btn.setAttribute('data-path', "pagewizard.next");

    const fid = this.#nextFid();
    btn.setAttribute('data-fid', fid);

    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
      btn.addEventListener('keydown', ev => {
        if (ev.key === "Tab") {
          ev.preventDefault();
          if (ev.shiftKey) {
            focusManager.movePrevious(btn);
          } else {
            focusManager.moveNext(btn);
          }
        }
      });
    }
    btn.onclick = () => {
      const idx = this.scopedEngine.getValue("pagewizard.pageIndex") || 0;
      this.scopedEngine.setValue("pagewizard.pageIndex", idx + 1);
      this.runFlow();
    };
    row.appendChild(btn);
  }

  pushIndent() {
    this.indentLevel++;
  }

  popIndent() {
    if (this.indentLevel > 0) this.indentLevel--;
  }

  setIndent(n) {
    this.indentLevel = Math.max(0, n);
  }

  say(message) {
    if (!this.activePage) return;
    const row = document.createElement('div');
    row.className = 'page-say-row';
    row.style.marginLeft = (this.indentLevel * 2) + "em";
    row.innerHTML = typeof formatMarkdown !== "undefined" ? formatMarkdown(message) : message;
    this.container.appendChild(row);
  }

  // Legacy compatibility: rethrowStopFlow defaults to true
  chat(pathString, rethrowStopFlow = true, subFlow) {
    let realRethrow = rethrowStopFlow;
    let realFlow = subFlow;
    if (typeof rethrowStopFlow === "function") {
      realFlow = rethrowStopFlow;
      realRethrow = true;
    }
    if (realRethrow) {
      this.askChat(pathString, realRethrow, realFlow);
    } else {
      this.embedChat(pathString, realFlow);
    }
  }

  askChat(pathString, rethrowOrFlow = true, subFlow) {
    let realFlow = subFlow;
    let rethrow = true;
    if (typeof rethrowOrFlow === "function") {
      realFlow = rethrowOrFlow;
      rethrow = true;
    } else if (typeof rethrowOrFlow === "boolean") {
      rethrow = rethrowOrFlow;
    }
    this._runSubWizard(pathString, ChatWizard, realFlow, rethrow, "page-chat-subcontainer");
  }

  embedChat(pathString, subFlow) {
    this._runSubWizard(pathString, ChatWizard, subFlow, false, "page-chat-subcontainer");
  }

  askForm(pathString, rethrowOrFlow = true, subFlow) {
    let realFlow = subFlow;
    let rethrow = true;
    if (typeof rethrowOrFlow === "function") {
      realFlow = rethrowOrFlow;
      rethrow = true;
    } else if (typeof rethrowOrFlow === "boolean") {
      rethrow = rethrowOrFlow;
    }
    this._runSubWizard(pathString, FormWizard, realFlow, rethrow, "page-form-subcontainer");
  }

  embedForm(pathString, subFlow) {
    this._runSubWizard(pathString, FormWizard, subFlow, false, "page-form-subcontainer");
  }

  _runSubWizard(pathString, WizardClass, subFlow, rethrowStopFlow, className) {
    if (!this.activePage) return;
    
    const subContainer = document.createElement("div");
    subContainer.className = className;
    this.container.appendChild(subContainer);
    
    const subEngine = this.scopedEngine.scope(pathString);
    const subWizard = new WizardClass(subContainer, subEngine, subFlow, this.instanceId + "_" + pathString);
    
    subWizard.runFlowInline(rethrowStopFlow);
  }

  #getButtonRow() {
    let row = this.container.querySelector('.page-button-row');
    if (!row) {
      row = document.createElement('div');
      row.className = 'page-button-row';
      this.container.appendChild(row);
    }
    return row;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PagesWizard };
}
