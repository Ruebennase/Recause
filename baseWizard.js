// baseWizard.js
(function () {
  let R_Engine;
  try {
    R_Engine = RecauseEngine;
  } catch (e) {
    R_Engine = typeof require !== "undefined" ? require("./recauseEngine").RecauseEngine : null;
  }

  let S_View;
  try {
    S_View = ScopedEngineView;
  } catch (e) {
    S_View = typeof require !== "undefined" ? require("./recauseEngine").ScopedEngineView : null;
  }

  let S_Flow;
  try {
    S_Flow = StopFlow;
  } catch (e) {
    S_Flow = typeof require !== "undefined" ? require("./recauseEngine").StopFlow : null;
  }

  // FocusManager class
  class FocusManager {
    constructor() {
      this.rootContainer = null;
      this.currentFocusFid = null;
      this.selectionStart = null;
      this.selectionEnd = null;
      this._restoreScheduled = false;
      this._restoreTimer = null;
      this.isShiftPressed = false;
      this.isWashing = false;
      this.isClickingButton = false;

      if (typeof window !== "undefined") {
        window.addEventListener('keydown', ev => {
          if (ev.key === 'Shift') this.isShiftPressed = true;
        });
        window.addEventListener('keyup', ev => {
          if (ev.key === 'Shift') this.isShiftPressed = false;
        });
        window.addEventListener('blur', () => {
          this.isShiftPressed = false;
        });
        window.addEventListener('mousedown', ev => {
          if (ev.target && (ev.target.tagName === 'BUTTON' || ev.target.closest('button'))) {
            this.isClickingButton = true;
          }
        });
        window.addEventListener('mouseup', () => {
          this.isClickingButton = false;
        });
      }
    }

    registerContainer(container) {
      this.rootContainer = container;
      this.ensureFocusGuards();
    }

    setFocusFid(fid) {
      this.currentFocusFid = fid;
    }

    getFocusFid() {
      return this.currentFocusFid;
    }

    captureFocus() {
      if (!this.rootContainer) return;
      const active = document.activeElement;
      if (active && this.rootContainer.contains(active)) {
        const fid = active.getAttribute('data-fid');
        if (fid) {
          this.currentFocusFid = fid;
          this.selectionStart = null;
          this.selectionEnd = null;
          try {
            if (typeof active.selectionStart === "number") {
              this.selectionStart = active.selectionStart;
              this.selectionEnd = active.selectionEnd;
            }
          } catch (e) {
            // Swallow
          }
          return;
        }
      }
    }

    cancelPendingRestore() {
      if (this._restoreScheduled) {
        clearTimeout(this._restoreTimer);
        this._restoreScheduled = false;
      }
    }

    restoreFocus(pageIndex) {
      if (this._restoreScheduled) return;
      this._restoreScheduled = true;

      this.lastPageIndex = this.currentPageIndex;
      this.currentPageIndex = pageIndex;

      this._restoreTimer = setTimeout(() => {
        this._restoreScheduled = false;
        this.ensureFocusGuards();
        this._performRestore();
      }, 30);
    }

    _performRestore() {
      if (!this.rootContainer) return;

      if (!this.currentFocusFid) {
        return;
      }

      const el = this.rootContainer.querySelector(`[data-fid="${this.currentFocusFid}"]`);

      if (el) {
        if (typeof el.focus === "function") {
          el.focus();
        }
        if (document.activeElement !== el) {
          this.focusNextTextField(this.currentFocusFid);
        }
        if (typeof el.setSelectionRange === "function" && this.selectionStart !== null) {
          try {
            el.setSelectionRange(this.selectionStart, this.selectionEnd);
          } catch (e) {}
        }
      } else {
        const pageTransitioned = (this.lastPageIndex !== undefined && this.currentPageIndex !== undefined && this.lastPageIndex !== this.currentPageIndex);
        if (pageTransitioned) {
          this.focusFirstElement();
        } else {
          this.currentFocusFid = null;
        }
      }
      this.ensureFocusGuards();
    }

    focusFirstElement() {
      const all = this._getFocusableElements();
      if (all.length > 0) {
        const first = all[0];
        first.focus();
        const fid = first.getAttribute('data-fid');
        if (fid) this.setFocusFid(fid);
      }
    }

    _getFocusableElements() {
      if (!this.rootContainer) return [];
      return Array.from(
        this.rootContainer.querySelectorAll(
          'a[href], button, textarea, input:not([type="hidden"]):not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => {
        return (el.offsetWidth > 0 || el.offsetHeight > 0) && !el.classList.contains('focus-guard');
      });
    }

    navigateNext(currentEl) {
      this.cancelPendingRestore();
      const next = this.findNextElement(currentEl);
      if (next) {
        const fid = next.getAttribute('data-fid');
        if (fid) {
          this.setFocusFid(fid);
          currentEl.blur();
          next.focus();
          return true;
        }
      }
      return false;
    }

    navigatePrevious(currentEl) {
      this.cancelPendingRestore();
      const prev = this.findPreviousElement(currentEl);
      if (prev) {
        const fid = prev.getAttribute('data-fid');
        if (fid) {
          this.setFocusFid(fid);
          currentEl.blur();
          prev.focus();
          return true;
        }
      }
      return false;
    }

    moveNext(currentEl) { return this.navigateNext(currentEl); }
    movePrevious(currentEl) { return this.navigatePrevious(currentEl); }

    trackFocus(el) {
      if (!el) return;
      const fid = el.getAttribute('data-fid');
      if (fid) {
        this.currentFocusFid = fid;
        try {
          if (typeof el.selectionStart === "number") {
            this.selectionStart = el.selectionStart;
            this.selectionEnd = el.selectionEnd;
          }
        } catch (e) {}
      }
    }

    findNextElement(currentEl) {
      const all = this._getFocusableElements();
      if (!all.length) return null;
      const idx = all.indexOf(currentEl);
      if (idx !== -1 && idx < all.length - 1) {
        return all[idx + 1];
      }
      return null;
    }

    findPreviousElement(currentEl) {
      const all = this._getFocusableElements();
      if (!all.length) return null;
      const idx = all.indexOf(currentEl);
      if (idx > 0) {
        return all[idx - 1];
      }
      return null;
    }

    focusElementAfter(lastFid, onlyTextFields = false) {
      this.cancelPendingRestore();
      if (!this.rootContainer || !lastFid) return;

      const anchor = this.rootContainer.querySelector(`[data-fid="${lastFid}"]`) || 
                     this.rootContainer.querySelector(`[data-path="${lastFid}"]`);
      if (!anchor) return;

      const allFocusable = this._getFocusableElements();
      for (const el of allFocusable) {
        const position = anchor.compareDocumentPosition(el);
        if ((position & Node.DOCUMENT_POSITION_FOLLOWING) && !anchor.contains(el)) {
          if (onlyTextFields) {
            const tag = el.tagName.toUpperCase();
            const type = el.type ? el.type.toLowerCase() : "";
            if (!((tag === "INPUT" && type !== "button" && type !== "submit" && type !== "checkbox" && type !== "radio") || tag === "TEXTAREA")) {
              continue;
            }
          }
          el.focus();
          const targetFid = el.getAttribute('data-fid');
          if (targetFid) {
            this.setFocusFid(targetFid);
          }
          return;
        }
      }
    }

    focusFidAfter(fid) {
      this.focusElementAfter(fid);
    }

    focusNextTextField(lastFid) {
      this.focusElementAfter(lastFid, true);
    }

    ensureFocusGuards() {
      if (!this.rootContainer) return;

      let topGuard = this.rootContainer.querySelector('.focus-guard-top');
      let bottomGuard = this.rootContainer.querySelector('.focus-guard-bottom');

      if (!topGuard) {
        topGuard = document.createElement('input');
        topGuard.type = 'text';
        topGuard.className = 'focus-guard focus-guard-top';
        topGuard.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;opacity:0;pointer-events:none;z-index:-1;';
        topGuard.addEventListener('focus', () => {
          const all = this._getFocusableElements();
          if (all.length > 0) {
            const target = this.isShiftPressed ? all[all.length - 1] : all[0];
            target.focus();
            const fid = target.getAttribute('data-fid');
            if (fid) this.setFocusFid(fid);
          }
        });
        this.rootContainer.insertBefore(topGuard, this.rootContainer.firstChild);
      }

      if (!bottomGuard) {
        bottomGuard = document.createElement('input');
        bottomGuard.type = 'text';
        bottomGuard.className = 'focus-guard focus-guard-bottom';
        bottomGuard.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;opacity:0;pointer-events:none;z-index:-1;';
        bottomGuard.addEventListener('focus', () => {
          const all = this._getFocusableElements();
          if (all.length > 0) {
            const target = this.isShiftPressed ? all[all.length - 1] : all[0];
            target.focus();
            const fid = target.getAttribute('data-fid');
            if (fid) this.setFocusFid(fid);
          }
        });
        this.rootContainer.appendChild(bottomGuard);
      }
    }
  }

  const focusManager = new FocusManager();

  class BaseWizard {
    constructor(container, stateOrEngine, flow, idOverride, typeName) {
      this.container = container;
      this.flow = flow;
      this.instanceId = idOverride || ((typeName === "FormWizard" ? "FW_" : "CW_") + Math.random().toString(36).substr(2, 5));

      let isNested = false;
      if (stateOrEngine instanceof R_Engine || stateOrEngine instanceof S_View) {
        this.scopedEngine = stateOrEngine;
        this.recauseEngine = stateOrEngine.engine || stateOrEngine;
        isNested = true;
      } else {
        this.recauseEngine = new R_Engine(stateOrEngine, this._wrappingFlow.bind(this), typeName);
        this.scopedEngine = new S_View(this.recauseEngine, "");
      }

      if (typeof focusManager !== "undefined" && !isNested) {
        focusManager.registerContainer(this.container);
      }

      this.indentLevel = 0;
      this.seq = 0;

      // Use AsyncWizard for async operations
      const AsyncW = typeof AsyncWizard !== "undefined" ? AsyncWizard : (typeof require !== "undefined" ? require("./asyncWizard").AsyncWizard : null);
      if (AsyncW) {
        this.asyncWizard = new AsyncW({
          ...this.scopedEngine.getAPI(),
          say: this.say.bind(this),
          runFlow: () => this.runFlow()
        });
      }

      this.api = {
        ...this.scopedEngine.getAPI(),
        runFlow: this.runFlow.bind(this),
        lockValue: this.lockValue.bind(this),
        unlockValue: this.unlockValue.bind(this),
        pushIndent: this.pushIndent.bind(this),
        popIndent: this.popIndent.bind(this),
        setIndent: this.setIndent.bind(this),
        say: this.say.bind(this),
        
        // Nesting APIs
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

    nextFid() {
      return `${this.instanceId}_${this.seq++}`;
    }

    s() {
      return "  ".repeat(this.recauseEngine.getParentCount());
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
        focusManager.isWashing = true;
      }
      this.recauseEngine.runFlow();
      if (checkpoint) {
        this.recauseEngine.checkpoint();
      }
      if (typeof focusManager !== "undefined") {
        focusManager.isWashing = false;
        focusManager.restoreFocus(this.recauseEngine.getValue("pagewizard.pageIndex"));
      }
    }

    runFlowInline(rethrowStopFlow) {
      try {
        this._wrappingFlow();
      } catch (e) {
        if (e instanceof S_Flow) {
          if (rethrowStopFlow) throw e;
        } else {
          throw e;
        }
      }
    }

    lockValue(pathString) {
      const space = this.constructor.name === "FormWizard" ? "formwizard" : "chatwizard";
      this.scopedEngine.setValue(`${space}.lock.${pathString}`, true);
    }

    unlockValue(pathString) {
      const space = this.constructor.name === "FormWizard" ? "formwizard" : "chatwizard";
      this.scopedEngine.removeValue(`${space}.lock.${pathString}`);
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

    _parseSubWizardArgs(arg1, arg2, arg3, arg4) {
      let question = "";
      let pathString = "";
      let rethrowOrPath = true;
      let subFlow = null;

      if (typeof arg2 === "string") {
        question = arg1;
        pathString = arg2;
        rethrowOrPath = arg3;
        subFlow = arg4;
      } else {
        question = "";
        pathString = arg1;
        rethrowOrPath = arg2;
        subFlow = arg3;
      }

      let realFlow = subFlow;
      let rethrow = true;

      if (typeof rethrowOrPath === "function") {
        realFlow = rethrowOrPath;
        rethrow = true;
      } else if (typeof rethrowOrPath === "boolean") {
        rethrow = rethrowOrPath;
      }

      return {
        question,
        pathString,
        rethrow,
        flow: realFlow,
        submitPath: typeof rethrowOrPath === "string" ? rethrowOrPath : null
      };
    }

    chat(arg1, arg2, arg3, arg4) {
      const { question, pathString, rethrow, flow } = this._parseSubWizardArgs(arg1, arg2, arg3, arg4);
      if (rethrow) {
        this.askChat(question, pathString, flow);
      } else {
        this.embedChat(question, pathString, flow);
      }
    }

    askChat(arg1, arg2, arg3, arg4) {
      const { question, pathString, flow } = this._parseSubWizardArgs(arg1, arg2, arg3, arg4);
      const isChatType = this.constructor.name === "ChatWizard" || this.constructor.name === "PagesWizard";
      const containerClass = isChatType ? "chat-form-block" : "page-chat-subcontainer";
      const ChatW = typeof ChatWizard !== "undefined" ? ChatWizard : (typeof require !== "undefined" ? require("./chatWizard").ChatWizard : null);
      this._runSubWizard(question, pathString, ChatW, flow, true, containerClass);
    }

    embedChat(arg1, arg2, arg3, arg4) {
      const { question, pathString, flow } = this._parseSubWizardArgs(arg1, arg2, arg3, arg4);
      const isChatType = this.constructor.name === "ChatWizard" || this.constructor.name === "PagesWizard";
      const containerClass = isChatType ? "chat-form-block" : "page-chat-subcontainer";
      const ChatW = typeof ChatWizard !== "undefined" ? ChatWizard : (typeof require !== "undefined" ? require("./chatWizard").ChatWizard : null);
      this._runSubWizard(question, pathString, ChatW, flow, false, containerClass);
    }

    askForm(arg1, arg2, arg3, arg4) {
      const { question, pathString, rethrow, flow, submitPath } = this._parseSubWizardArgs(arg1, arg2, arg3, arg4);
      const isChatType = this.constructor.name === "ChatWizard" || this.constructor.name === "PagesWizard";
      const containerClass = isChatType ? "chat-form-block" : "page-form-subcontainer";
      const FormW = typeof FormWizard !== "undefined" ? FormWizard : (typeof require !== "undefined" ? require("./formWizard").FormWizard : null);
      
      this._runSubWizard(question, pathString, FormW, flow, rethrow, containerClass);

      if (submitPath) {
        const isDone = this.scopedEngine.scope(pathString).getValue(submitPath);
        if (!isDone) {
          this.scopedEngine.stopFlow();
        }
      }
    }

    embedForm(arg1, arg2, arg3, arg4) {
      const { question, pathString, flow } = this._parseSubWizardArgs(arg1, arg2, arg3, arg4);
      const isChatType = this.constructor.name === "ChatWizard" || this.constructor.name === "PagesWizard";
      const containerClass = isChatType ? "chat-form-block" : "page-form-subcontainer";
      const FormW = typeof FormWizard !== "undefined" ? FormWizard : (typeof require !== "undefined" ? require("./formWizard").FormWizard : null);
      this._runSubWizard(question, pathString, FormW, flow, false, containerClass);
    }

    _runSubWizard(question, pathString, WizardClass, subFlow, rethrowStopFlow, className) {
      const isForm = this.constructor.name === "FormWizard";
      let subContainer;
      let block = null;

      if (isForm) {
        const row = this._createQuestionRow();
        if (question) {
          const lbl = document.createElement('div');
          lbl.className = 'form-label';
          lbl.textContent = question;
          row.appendChild(lbl);
        }
        subContainer = document.createElement("div");
        subContainer.className = className;
        row.appendChild(subContainer);
      } else {
        block = document.createElement("div");
        block.className = className;
        block.style.marginLeft = (this.indentLevel * 2) + "em";
        
        if (question) {
          const header = document.createElement('div');
          header.className = 'chat-question-header';
          const q = document.createElement('div');
          q.className = 'chat-question-text';
          q.textContent = question;
          header.appendChild(q);
          block.appendChild(header);
        }
        
        subContainer = document.createElement("div");
        const isFormW = WizardClass.name.includes("FormWizard");
        subContainer.className = isFormW ? "chat-form-subContainer" : "chat-chat-subContainer";
        
        block.appendChild(subContainer);
        this.container.appendChild(block);
      }

      const subEngine = this.scopedEngine.scope(pathString);
      const subWizard = new WizardClass(subContainer, subEngine, subFlow, this.instanceId + "_" + pathString);
      subWizard.wizardQuestion = question;
      subWizard.runFlowInline(rethrowStopFlow);

      // Summary Protocol Integration for completed subwizards
      if (block && typeof subWizard.isCompleted === "function" && subWizard.isCompleted()) {
        subContainer.style.display = "none";
        
        const parentHeader = block.querySelector('.chat-question-header');
        if (parentHeader) {
          let editBtn = parentHeader.querySelector('.chat-edit-button');
          if (!editBtn) {
            editBtn = document.createElement("button");
            editBtn.className = "chat-edit-button";
            editBtn.textContent = "Edit";
            editBtn.onclick = () => {
              subEngine.setValue(subWizard.submitPathString, false);
              this.runFlow();
            };
            parentHeader.appendChild(editBtn);
          }
        }

        const ansBubble = document.createElement("div");
        subWizard.renderSummary(ansBubble);
        block.appendChild(ansBubble);
      } else if (block) {
        subContainer.style.display = "";
        const parentHeader = block.querySelector('.chat-question-header');
        if (parentHeader) {
          const editBtn = parentHeader.querySelector('.chat-edit-button');
          if (editBtn) editBtn.remove();
        }
      }
    }

    _createQuestionRow() {
      const row = document.createElement('div');
      row.className = 'form-question-row';
      row.style.marginLeft = (this.indentLevel * 2) + "em";
      this.container.appendChild(row);
      return row;
    }
  }

  function formatMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    if (html.startsWith("#### ")) {
      return `<h4 class="md-h4">${html.substring(5)}</h4>`;
    }
    if (html.startsWith("### ")) {
      return `<h3 class="md-h3">${html.substring(4)}</h3>`;
    }
    if (html.startsWith("## ")) {
      return `<h2 class="md-h2">${html.substring(3)}</h2>`;
    }
    if (html.startsWith("# ")) {
      return `<h1 class="md-h1">${html.substring(2)}</h1>`;
    }
    
    let isBullet = false;
    if (html.startsWith("- ")) {
      html = html.substring(2);
      isBullet = true;
    }
    
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    if (isBullet) {
      return `<span class="md-bullet">•</span> <span class="md-bullet-text">${html}</span>`;
    }
    
    return html;
  }

  if (typeof window !== "undefined") {
    window.BaseWizard = BaseWizard;
    window.focusManager = focusManager;
    window.formatMarkdown = formatMarkdown;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { BaseWizard, focusManager, FocusManager, formatMarkdown };
  }
})();
