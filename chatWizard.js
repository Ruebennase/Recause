let ChatWizard;
(function () {
  const BaseW = typeof BaseWizard !== "undefined" ? BaseWizard : require("./baseWizard").BaseWizard;

  ChatWizard = class ChatWizard extends BaseW {
  constructor(container, stateOrEngine, flow, idOverride) {
    console.log("NEW ChatWizard" + " " + (new Date().toISOString().substr(14, 5)));
    super(container, stateOrEngine, flow, idOverride, "ChatWizard");

    // Extend API with ChatWizard specific methods
    Object.assign(this.api, {
      askText: this.askText.bind(this),
      askMultiText: this.askMultiText.bind(this),
      askCheckbox: this.askCheckbox.bind(this),
      askRadio: this.askRadio.bind(this),
      askButton: this.askButton.bind(this),
      askButtonForced: this.askButtonForced.bind(this),
      askButtonNowait: this.askButtonNowait.bind(this),
      actionButton: this.actionButton.bind(this),
      askList: this.askList.bind(this),
    });
  }

  _wrappingFlow() {
    const originalContainer = this.container;
    const tempContainer = document.createElement("div");
    this.container = tempContainer;

    this.indentLevel = 0;
    this.seq = 0; // Reset Sequence
    
    try {
      this.flow({ ...this.api });
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
    console.log(this.s() + "ChatWizard: At end of wrappingFlow() " + " " + (new Date().toISOString().substr(14, 5)));
  }

  say(message, className) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";
    const txt = document.createElement('div');
    txt.className = 'chat-question-text';
    if (className) {
      txt.classList.add(className);
    }
    txt.innerHTML = typeof formatMarkdown !== "undefined" ? formatMarkdown(message) : message;
    block.appendChild(txt);
    this.container.appendChild(block);
  }

  askText(question, pathString) {
    const val = this.scopedEngine.getValue(pathString);
    const editing = this.scopedEngine.getValue("chatwizard.currentEditingField") === pathString;
    const fid = this.nextFid();

    if (val !== undefined && !editing) {
      this.renderReadOnly(question, val, pathString, fid);
      return;
    }
    this.renderTextInput(question, pathString, val || "", fid);
    this.scopedEngine.stopFlow();
  }

  askMultiText(question, pathString) {
    const val = this.scopedEngine.getValue(pathString);
    const editing = this.scopedEngine.getValue("chatwizard.currentEditingField") === pathString;
    const fid = this.nextFid();

    if (val !== undefined && !editing) {
      this.renderReadOnly(question, val, pathString, fid);
      return;
    }
    this.renderMultiTextInput(question, pathString, val || "", fid);
    this.scopedEngine.stopFlow();
  }

  askRadio(question, pathString, options) {
    const val = this.scopedEngine.getValue(pathString);
    const editing = this.scopedEngine.getValue("chatwizard.currentEditingField") === pathString;
    const fid = this.nextFid();

    if (val !== undefined && !editing) {
      this.renderReadOnly(question, val, pathString, fid);
      return;
    }
    this.renderRadioInput(question, pathString, val, options, fid);
    this.scopedEngine.stopFlow();
  }

  askCheckbox(question, pathString, options) {
    const val = this.scopedEngine.getValue(pathString) || "";
    const editing = this.scopedEngine.getValue("chatwizard.currentEditingField") === pathString;
    const fid = this.nextFid();

    if (val && !editing) {
      this.renderReadOnly(question, val, pathString, fid);
      return;
    }
    this.renderCheckboxInput(question, pathString, val, options, fid);
    this.scopedEngine.stopFlow();
  }

  askButton(question, pathString, options) {
    const val = this.scopedEngine.getValue(pathString);
    const editing = this.scopedEngine.getValue("chatwizard.currentEditingField") === pathString;
    const fid = this.nextFid();

    if (val !== undefined && !editing) {
      this.renderReadOnly(question, val, pathString, fid);
      return;
    }
    this.renderButtonInput(question, pathString, options, fid);
    this.scopedEngine.stopFlow();
  }

  askButtonForced(question, pathString, options) {
    const fid = this.nextFid();
    this.renderButtonInput(question, pathString, options, fid);
    this.scopedEngine.stopFlow();
  }

  askButtonNowait(question, pathString, options) {
    const fid = this.nextFid();
    this.renderButtonInput(question, pathString, options, fid);
  }



  askList(label, pathString, optionsOrFlow, itemFlow) {
    let options = {};
    let realFlow = itemFlow;
    if (typeof optionsOrFlow === "function") {
      realFlow = optionsOrFlow;
    } else if (optionsOrFlow) {
      options = optionsOrFlow;
    }

    let list = this.scopedEngine.getValue(pathString);
    if (list === undefined) {
      const required = options.required !== false;
      list = required ? ["item_1"] : [];
      this.scopedEngine.setValue(pathString, list);
    }
    
    const block = document.createElement('div');
    block.className = 'chat-list-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";
    this.container.appendChild(block);

    if (label) {
      const header = document.createElement('div');
      header.className = 'chat-list-header';
      header.textContent = label;
      block.appendChild(header);
    }

    const listContainer = document.createElement("div");
    listContainer.className = "chat-list-container";
    block.appendChild(listContainer);

    let hasBlocked = false;

    list.forEach((itemId, idx) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'chat-list-item-row';
      listContainer.appendChild(itemRow);

      const subEngine = this.scopedEngine.scope(`${pathString}_${itemId}`);
      const subWizard = new FormWizard(itemRow, subEngine, realFlow, this.instanceId + "_" + pathString + "_" + itemId);
      
      try {
        subWizard.runFlowInline(true);
      } catch (e) {
        if (e instanceof StopFlow) {
          hasBlocked = true;
        } else {
          throw e;
        }
      }

      // Prepend Card Header with Status Badge
      const cardHeader = document.createElement("div");
      cardHeader.className = "chat-list-item-card-header";
      
      const cardTitle = document.createElement("span");
      cardTitle.className = "card-title-text";
      cardTitle.textContent = `${label.endsWith("ies") ? label.slice(0, -3) + "y" : label.replace(/s$/, '')} #${idx + 1}`;
      cardHeader.appendChild(cardTitle);
      
      const isSubSaved = (subWizard.activeErrors.length === 0) && (subWizard.submitPathString ? !!subEngine.getValue(subWizard.submitPathString) : true);
      
      const badge = document.createElement("span");
      if (isSubSaved) {
        badge.className = "card-status-badge complete";
        badge.textContent = "Complete ✓";
      } else {
        badge.className = "card-status-badge incomplete";
        badge.textContent = "Incomplete ⚠️";
      }
      cardHeader.appendChild(badge);
      
      itemRow.insertBefore(cardHeader, itemRow.firstChild);

      // Add delete button next to each item
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'chat-list-delete-button';
      deleteBtn.textContent = 'Remove';
      deleteBtn.onclick = () => {
        const currentList = this.scopedEngine.getValue(pathString) || [];
        const index = currentList.indexOf(itemId);
        if (index !== -1) {
          currentList.splice(index, 1);
          this.scopedEngine.setValue(pathString, currentList);
          this.runFlow();
        }
      };
      itemRow.appendChild(deleteBtn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'chat-list-add-button';
    addBtn.textContent = `+ Add ${label.endsWith("ies") ? label.slice(0, -3) + "y" : label.replace(/s$/, '')}`; // singularized label
    addBtn.onclick = () => {
      const currentList = this.scopedEngine.getValue(pathString) || [];
      const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
      currentList.push(newId);
      this.scopedEngine.setValue(pathString, currentList);
      this.runFlow();
    };
    block.appendChild(addBtn);

    if (hasBlocked) {
      this.scopedEngine.stopFlow();
    }
  }



  renderReadOnly(question, answerVal, pathString, fid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);

    const editBtn = document.createElement('button');
    editBtn.className = 'chat-edit-button';
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      this.scopedEngine.setValue("chatwizard.currentEditingField", pathString);
      this.runFlow();
    };
    editBtn.setAttribute('data-path', pathString);
    editBtn.setAttribute('data-fid', fid);
    this._attachFocusGuard(editBtn, fid);
    header.appendChild(editBtn);

    block.appendChild(header);

    const ans = document.createElement('div');
    ans.className = 'chat-answer-line';
    ans.textContent = answerVal;
    block.appendChild(ans);

    this.container.appendChild(block);
  }

  renderTextInput(question, pathString, existingVal, fid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);
    block.appendChild(header);

    const inp = document.createElement('input');
    inp.className = 'chat-input';
    inp.type = 'text';
    inp.value = existingVal;
    inp.setAttribute('data-path', pathString);
    inp.setAttribute('data-fid', fid);

    block.appendChild(inp);

    const finalize = () => {
      const val = inp.value.trim() || undefined;
      this.scopedEngine.setValue(pathString, val);
      this.scopedEngine.removeValue("chatwizard.currentEditingField");
      this.runFlow();
      if (typeof focusManager !== "undefined") {
        focusManager.focusFidAfter(fid);
      }
    };

    inp.addEventListener('input', () => {
      this.scopedEngine.setValue(pathString, inp.value.trim() || undefined);
    });

    inp.addEventListener('keydown', ev => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        finalize();
      }
    });

    const btn = document.createElement('button');
    btn.textContent = "OK";
    btn.onclick = finalize;
    btn.className = 'chat-button';
    const btnFid = `${fid}_ok`;
    btn.setAttribute('data-fid', btnFid);
    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    block.appendChild(btn);

    this.container.appendChild(block);
    if (typeof focusManager !== "undefined") {
      focusManager.trackFocus(inp);
      inp.addEventListener('focus', () => focusManager.trackFocus(inp));
    }
    this._attachFocusGuard(inp, fid);
  }

  renderMultiTextInput(question, pathString, existingVal, fid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);
    block.appendChild(header);

    const ta = document.createElement('textarea');
    ta.className = 'chat-textarea';
    ta.rows = 4;
    ta.value = existingVal;
    ta.setAttribute('data-path', pathString);
    ta.setAttribute('data-fid', fid);
    block.appendChild(ta);

    const btn = document.createElement('button');
    btn.className = 'chat-button';
    btn.textContent = "OK";
    const btnFid = `${fid}_ok`;
    btn.setAttribute('data-fid', btnFid);
    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = () => {
      const val = ta.value.trim() || undefined;
      this.scopedEngine.setValue(pathString, val);
      this.scopedEngine.removeValue("chatwizard.currentEditingField");
      this.runFlow();
      if (typeof focusManager !== "undefined") {
        focusManager.focusFidAfter(fid);
      }
    };
    block.appendChild(btn);

    this.container.appendChild(block);
    if (typeof focusManager !== "undefined") {
      focusManager.trackFocus(ta);
      ta.addEventListener('focus', () => focusManager.trackFocus(ta));
    }
    this._attachFocusGuard(ta, fid);
  }

  renderRadioInput(question, pathString, existingVal, options, groupFid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);
    block.appendChild(header);

    options.forEach((opt, idx) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'chat-option-line';

      const r = document.createElement('input');
      r.type = 'radio';
      r.name = pathString;
      r.setAttribute('data-path', pathString + '.' + opt.value);

      const subFid = `${groupFid}_opt${idx}`;
      r.setAttribute('data-fid', subFid);

      r.value = opt.value;
      if (opt.value === existingVal) r.checked = true;

      if (typeof focusManager !== "undefined") {
        r.addEventListener('focus', () => focusManager.trackFocus(r));
      }

      r.addEventListener('change', () => {
        this.scopedEngine.setValue(pathString, opt.value);
      });

      labelEl.appendChild(r);
      labelEl.appendChild(document.createTextNode(" " + (opt.label || opt.value)));
      block.appendChild(labelEl);
    });

    const btn = document.createElement('button');
    btn.className = 'chat-button';
    btn.textContent = "OK";
    const btnFid = `${groupFid}_ok`;
    btn.setAttribute('data-fid', btnFid);
    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = () => {
      const chosen = block.querySelector(`input[name="${pathString}"]:checked`);
      const val = chosen ? chosen.value : undefined;
      this.scopedEngine.setValue(pathString, val);
      this.scopedEngine.removeValue("chatwizard.currentEditingField");
      this.runFlow();
      if (typeof focusManager !== "undefined") {
        focusManager.focusFidAfter(groupFid);
      }
    };
    block.appendChild(btn);

    this.container.appendChild(block);
  }

  renderCheckboxInput(question, pathString, existingVal, options, groupFid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);
    block.appendChild(header);

    const chosenValues = existingVal
      ? existingVal.split(",").map(x => x.trim()).filter(Boolean)
      : [];

    options.forEach((opt, idx) => {
      const labelEl = document.createElement('label');
      labelEl.className = 'chat-option-line';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt.value;
      cb.setAttribute('data-path', pathString + '.' + opt.value);

      const subFid = `${groupFid}_opt${idx}`;
      cb.setAttribute('data-fid', subFid);

      if (chosenValues.includes(opt.value)) cb.checked = true;

      if (typeof focusManager !== "undefined") {
        cb.addEventListener('focus', () => focusManager.trackFocus(cb));
      }
      this._attachFocusGuard(cb, subFid);

      cb.addEventListener('change', () => {
        const cbs = block.querySelectorAll('input[type="checkbox"]');
        const arr = [];
        cbs.forEach(c => {
          if (c.checked) arr.push(c.value);
        });
        const val = arr.length > 0 ? arr.join(", ") : undefined;
        this.scopedEngine.setValue(pathString, val);
      });

      labelEl.appendChild(cb);
      labelEl.appendChild(document.createTextNode(" " + (opt.label || opt.value)));
      block.appendChild(labelEl);
    });

    const btn = document.createElement('button');
    btn.className = 'chat-button';
    btn.textContent = "OK";
    const btnFid = `${groupFid}_ok`;
    btn.setAttribute('data-fid', btnFid);
    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = () => {
      const cbs = block.querySelectorAll('input[type="checkbox"]');
      const arr = [];
      cbs.forEach(c => {
        if (c.checked) arr.push(c.value);
      });
      const val = arr.length > 0 ? arr.join(", ") : undefined;
      this.scopedEngine.setValue(pathString, val);
      this.scopedEngine.removeValue("chatwizard.currentEditingField");
      this.runFlow();
      if (typeof focusManager !== "undefined") {
        focusManager.focusFidAfter(groupFid);
      }
    };
    block.appendChild(btn);

    this.container.appendChild(block);
  }

  renderButtonInput(question, pathString, options, groupFid) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const header = document.createElement('div');
    header.className = 'chat-question-header';
    const q = document.createElement('div');
    q.className = 'chat-question-text';
    q.textContent = question;
    header.appendChild(q);
    block.appendChild(header);

    const btnRow = document.createElement('div');
    btnRow.className = 'chat-button-row';

    options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'chat-button';
      btn.textContent = opt.label || opt.value;
      btn.setAttribute('data-path', pathString + '.' + opt.value);

      const subFid = `${groupFid}_opt${idx}`;
      btn.setAttribute('data-fid', subFid);

      if (typeof focusManager !== "undefined") {
        btn.addEventListener('focus', () => focusManager.trackFocus(btn));
      }

      btn.onclick = () => {
        this.scopedEngine.setValue(pathString, opt.value);
        this.scopedEngine.removeValue("chatwizard.currentEditingField");
        this.runFlow();
        if (typeof focusManager !== "undefined") {
          focusManager.focusFidAfter(groupFid);
        }
      };
      this._attachFocusGuard(btn, subFid);
      btnRow.appendChild(btn);
    });

    block.appendChild(btnRow);
    this.container.appendChild(block);
  }

  actionButton(label, callback) {
    const block = document.createElement('div');
    block.className = 'chat-question-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";

    const btnRow = document.createElement('div');
    btnRow.className = 'chat-button-row';

    const btn = document.createElement('button');
    btn.className = 'chat-button';
    btn.textContent = label;
    const btnFid = this.nextFid();
    btn.setAttribute('data-fid', btnFid);
    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = (e) => {
      e.preventDefault();
      callback();
    };

    btnRow.appendChild(btn);
    block.appendChild(btnRow);
    this.container.appendChild(block);
  }

  _attachFocusGuard(el, fid) {
    el.addEventListener('keydown', ev => {
      if (ev.key === "Tab") {
        ev.preventDefault();

        if (!ev.shiftKey && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          const path = el.getAttribute('data-path');
          const currentVal = this.scopedEngine.getValue(path);
          const newVal = el.value.trim() || undefined;

          if (currentVal !== newVal) {
            this.scopedEngine.setValue(path, newVal);
            this.scopedEngine.removeValue("chatwizard.currentEditingField");
            this.runFlow();
            if (typeof focusManager !== "undefined") {
              focusManager.focusFidAfter(fid);
            }
            return;
          }
        }

        if (typeof focusManager !== "undefined") {
          if (ev.shiftKey) {
            focusManager.movePrevious(el);
          } else {
            focusManager.moveNext(el);
          }
        }
      }
    });
  }

}

  if (typeof window !== "undefined") {
    window.ChatWizard = ChatWizard;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ChatWizard };
  }
})();
