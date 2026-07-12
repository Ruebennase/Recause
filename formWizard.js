let FormWizard;
(function () {
  const BaseW = typeof BaseWizard !== "undefined" ? BaseWizard : require("./baseWizard").BaseWizard;

  FormWizard = class FormWizard extends BaseW {
    constructor(container, stateOrEngine, flow, idOverride) {
      console.log("NEW FormWizard" + " " + (new Date().toISOString().substr(14, 5)));
      super(container, stateOrEngine, flow, idOverride, "FormWizard");

      FormWizard.activeWizards = FormWizard.activeWizards || new Set();
      FormWizard.activeWizards.add(this);

      const originalSetValue = this.scopedEngine.setValue.bind(this.scopedEngine);
      this.scopedEngine.setValue = (path, value) => {
      const currentVal = this.scopedEngine.getValue(path);
      originalSetValue(path, value);
      if (this.submitPathString && path !== this.submitPathString && !path.startsWith("formwizard.")) {
        if (currentVal !== value) {
          originalSetValue(this.submitPathString, undefined);
          originalSetValue("formwizard.show_errors", undefined);
        }
      }
    };

    this.isBlurProcessing = false;
    this.submitPathString = null;
    this.activeErrors = [];
    this.pendingCommits = [];

    // Extend API with FormWizard specific methods
    Object.assign(this.api, {
      askText: this.askText.bind(this),
      askMultiText: this.askMultiText.bind(this),
      askCheckbox: this.askCheckbox.bind(this),
      askRadio: this.askRadio.bind(this),
      actionButton: this.actionButton.bind(this),
      askTextWithAction: this.askTextWithAction.bind(this),
      submitButton: this.submitButton.bind(this),
      askList: this.askList.bind(this),
    });
  }

  _wrappingFlow() {
    const originalContainer = this.container;
    const tempContainer = document.createElement("div");
    this.container = tempContainer;

    this.indentLevel = 0;
    this.seq = 0; // Reset sequence on every render
    this.submitPathString = null;
    this.activeErrors = [];

    // Safety Guard against infinite render loops
    const now = Date.now();
    if (!this._lastRender) this._lastRender = now;
    if (now - this._lastRender < 1000) {
      this._renderCount = (this._renderCount || 0) + 1;
      if (this._renderCount > 50) {
        console.error("FormWizard: Infinite render loop detected! Stopping.");
        this.container = originalContainer;
        return;
      }
    } else {
      this._renderCount = 0;
      this._lastRender = now;
    }

    try {
      this.flow({ ...this.api });
      
      // Check validation errors and COLLAPSIBLE COMPLAINTS BOX
      const showErrors = !!this.scopedEngine.getValue("formwizard.show_errors");
      if (this.activeErrors.length > 0 && showErrors) {
        const box = document.createElement("div");
        box.className = "form-validation-complaints-box animate-fade-in";
        
        const header = document.createElement("div");
        header.className = "complaints-header";
        header.textContent = "Please resolve the following issues:";
        box.appendChild(header);
        
        this.activeErrors.forEach(err => {
          const item = document.createElement("div");
          item.className = "complaint-item";
          item.textContent = `• ${err.errorMsg}`;
          box.appendChild(item);
        });
        tempContainer.appendChild(box);
      }
      
      if (this.submitPathString) {
        const isDone = this.scopedEngine.getValue(this.submitPathString);
        if (!isDone) {
          this.scopedEngine.stopFlow();
        }
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

  say(message) {
    console.log(this.s() + "Form inside say function");
    const row = document.createElement('div');
    row.className = 'form-say-row';
    row.style.marginLeft = (this.indentLevel * 2) + "em";
    row.innerHTML = typeof formatMarkdown !== "undefined" ? formatMarkdown(message) : message;
    this.container.appendChild(row);
  }

  askText(label, pathString, options) {
    const locked = !!this.scopedEngine.getValue(`formwizard.lock.${pathString}`);
    const val = this.scopedEngine.getValue(pathString) || "";
    const validation = this.#registerFieldValidation(label, pathString, val, options);
    const row = this._createQuestionRow();

    const lbl = document.createElement('div');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const fid = this.nextFid();

    if (locked) {
      const ro = document.createElement('div');
      ro.className = 'form-locked-field';
      ro.textContent = val || "[No Value]";
      ro.setAttribute('data-path', pathString);
      ro.setAttribute('data-fid', fid);
      row.appendChild(ro);
    } else {
      const inp = document.createElement('input');
      inp.className = (validation && !validation.isValid && validation.touched) ? 'form-input invalid' : 'form-input';
      inp.type = 'text';
      inp.value = val;
      inp.setAttribute('data-path', pathString);
      inp.setAttribute('data-fid', fid);
      this.#autoSaveText(inp, pathString, fid);
      row.appendChild(inp);

      if (validation && !validation.isValid && validation.touched) {
        const errDiv = document.createElement('div');
        errDiv.className = 'form-field-error';
        errDiv.textContent = validation.errorMsg;
        row.appendChild(errDiv);
      }
    }
  }

  askMultiText(label, pathString, options) {
    const locked = !!this.scopedEngine.getValue(`formwizard.lock.${pathString}`);
    const val = this.scopedEngine.getValue(pathString) || "";
    const validation = this.#registerFieldValidation(label, pathString, val, options);

    const row = this._createQuestionRow();
    const lbl = document.createElement('div');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const fid = this.nextFid();

    if (locked) {
      const ro = document.createElement('div');
      ro.className = 'form-locked-field';
      ro.textContent = val || "[No Value]";
      ro.setAttribute('data-path', pathString);
      ro.setAttribute('data-fid', fid);
      row.appendChild(ro);
    } else {
      const ta = document.createElement('textarea');
      ta.className = (validation && !validation.isValid && validation.touched) ? 'form-textarea invalid' : 'form-textarea';
      ta.value = val;
      ta.setAttribute('data-fid', fid);
      this.#autoGrowTextArea(ta);
      this.#autoSaveText(ta, pathString, fid);
      row.appendChild(ta);

      if (validation && !validation.isValid && validation.touched) {
        const errDiv = document.createElement('div');
        errDiv.className = 'form-field-error';
        errDiv.textContent = validation.errorMsg;
        row.appendChild(errDiv);
      }
    }
  }

  askCheckbox(label, pathString, options, validationOptions) {
    const locked = !!this.scopedEngine.getValue(`formwizard.lock.${pathString}`);
    const valStr = this.scopedEngine.getValue(pathString) || "";
    const validation = this.#registerFieldValidation(label, pathString, valStr, validationOptions, options);
    const row = this._createQuestionRow();

    const lbl = document.createElement('div');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const groupFid = this.nextFid();

    if (locked) {
      const ro = document.createElement('div');
      ro.className = 'form-locked-field';
      ro.textContent = valStr || "[No Value]";
      ro.setAttribute('data-path', pathString);
      ro.setAttribute('data-fid', groupFid);
      row.appendChild(ro);
    } else {
      const container = document.createElement('div');
      container.className = (validation && !validation.isValid && validation.touched) ? 'form-checkbox-group-container invalid' : 'form-checkbox-group-container';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-start';

      const chosen = valStr ? valStr.split(",").map(x => x.trim()).filter(Boolean) : [];

      options.forEach((opt, idx) => {
        const line = document.createElement('label');
        line.className = 'form-checkbox-line';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = opt.value;
        cb.className = 'form-checkbox-input';
        cb.setAttribute('data-path', pathString + '.' + opt.value);

        const refFid = `${groupFid}_opt${idx}`;
        cb.setAttribute('data-fid', refFid);

        if (chosen.includes(opt.value)) cb.checked = true;

        if (typeof focusManager !== "undefined") {
          cb.addEventListener('focus', () => focusManager.trackFocus(cb));
        }

        cb.addEventListener('change', () => {
          this.flushPendingCommits();
          this.scopedEngine.setValue(`formwizard.touched.${pathString}`, true);
          this.#finalizeCheck(container, pathString);
          this.runFlow();
        });
        cb.addEventListener('keydown', ev => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            cb.checked = !cb.checked;
            this.scopedEngine.setValue(`formwizard.touched.${pathString}`, true);
            this.#finalizeCheck(container, pathString);
            if (typeof focusManager !== "undefined") {
              focusManager.moveNext(cb);
            }
            this.runFlow();
          }
        });
        line.appendChild(cb);
        line.appendChild(document.createTextNode(opt.label || opt.value));
        container.appendChild(line);
      });
      row.appendChild(container);

      if (validation && !validation.isValid && validation.touched) {
        const errDiv = document.createElement('div');
        errDiv.className = 'form-field-error';
        errDiv.textContent = validation.errorMsg;
        row.appendChild(errDiv);
      }
    }
  }

  askRadio(label, pathString, options, validationOptions) {
    const val = this.scopedEngine.getValue(pathString);
    const locked = !!this.scopedEngine.getValue(`formwizard.lock.${pathString}`);
    const validation = this.#registerFieldValidation(label, pathString, val, validationOptions, options);
    const row = this._createQuestionRow();
    
    const lbl = document.createElement('div');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const groupFid = this.nextFid();

    if (locked) {
      const ro = document.createElement('div');
      ro.className = 'form-locked-field';
      const opt = options.find(o => o.value === val);
      ro.textContent = opt ? opt.label : (val || "[No Value]");
      ro.setAttribute('data-path', pathString);
      ro.setAttribute('data-fid', groupFid);
      row.appendChild(ro);
    } else {
      const container = document.createElement('div');
      container.className = (validation && !validation.isValid && validation.touched) ? 'form-radio-group-container invalid' : 'form-radio-group-container';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'flex-start';

      options.forEach((opt, idx) => {
        const line = document.createElement('label');
        line.className = 'form-checkbox-line';

        const rb = document.createElement('input');
        rb.type = 'radio';
        rb.name = `${this.instanceId}_${pathString.replace(/\./g, '_')}`;
        rb.value = opt.value;
        rb.className = 'form-checkbox-input';
        rb.setAttribute('data-path', pathString + '.' + opt.value);

        const refFid = `${groupFid}_opt${idx}`;
        rb.setAttribute('data-fid', refFid);

        if (val === opt.value) rb.checked = true;

        rb.addEventListener('change', () => {
          this.flushPendingCommits();
          this.scopedEngine.setValue(`formwizard.touched.${pathString}`, true);
          this.scopedEngine.setValue(pathString, opt.value);
          this.runFlow();
        });
        
        line.appendChild(rb);
        line.appendChild(document.createTextNode(opt.label || opt.value));
        container.appendChild(line);
      });
      row.appendChild(container);

      if (validation && !validation.isValid && validation.touched) {
        const errDiv = document.createElement('div');
        errDiv.className = 'form-field-error';
        errDiv.textContent = validation.errorMsg;
        row.appendChild(errDiv);
      }
    }
  }

  submitButton(label, pathString, successText) {
    this.submitPathString = pathString;
    const isSaved = !!this.scopedEngine.getValue(pathString);
    const row = this._createQuestionRow();
    const btn = document.createElement('button');
    btn.className = isSaved ? 'form-button saved' : 'form-button';
    
    if (isSaved) {
      if (successText) {
        btn.textContent = successText;
      } else {
        row.style.display = 'none';
      }
    } else {
      btn.textContent = label;
    }
    const fid = this.nextFid();
    btn.setAttribute('data-fid', fid);
    btn.setAttribute('data-path', pathString);

    if (typeof focusManager !== "undefined") {
      btn.addEventListener('focus', () => focusManager.trackFocus(btn));
    }
    btn.onclick = () => {
      this.flushPendingCommits();
      // Re-run the flow inline to populate validation errors with the fresh committed values
      this.runFlowInline(false);

      if (this.activeErrors && this.activeErrors.length > 0) {
        this.activeErrors.forEach(err => {
          this.scopedEngine.setValue(`formwizard.touched.${err.pathString}`, true);
        });
        this.scopedEngine.setValue("formwizard.show_errors", true);
      } else {
        this.scopedEngine.setValue(pathString, true);
        this.scopedEngine.setValue("formwizard.show_errors", false);
      }
      this.runFlow();
    };
    row.appendChild(btn);
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
    block.className = 'form-list-block';
    block.style.marginLeft = (this.indentLevel * 2) + "em";
    this.container.appendChild(block);

    if (label) {
      const header = document.createElement('div');
      header.className = 'form-list-header';
      header.textContent = label;
      block.appendChild(header);
    }

    const listContainer = document.createElement("div");
    listContainer.className = "form-list-container";
    block.appendChild(listContainer);

    let hasBlocked = false;

    list.forEach((itemId, idx) => {
      const itemRow = document.createElement('div');
      itemRow.className = 'form-list-item-row';
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
      cardHeader.className = "form-list-item-card-header";
      
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

      // Add delete button next to/below each item
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'form-list-delete-button';
      deleteBtn.textContent = 'Remove';
      deleteBtn.onclick = () => {
        this.flushPendingCommits();
        const currentList = this.scopedEngine.getValue(pathString) || [];
        const index = currentList.indexOf(itemId);
        if (index !== -1) {
          const nextList = [...currentList];
          nextList.splice(index, 1);
          this.scopedEngine.setValue(pathString, nextList);
          this.runFlow();
        }
      };
      itemRow.appendChild(deleteBtn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'form-list-add-button';
    addBtn.textContent = `+ Add ${label.endsWith("ies") ? label.slice(0, -3) + "y" : label.replace(/s$/, '')}`; // singularized label
    addBtn.onclick = () => {
      this.flushPendingCommits();
      const currentList = this.scopedEngine.getValue(pathString) || [];
      const newId = "item_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
      const nextList = [...currentList, newId];
      this.scopedEngine.setValue(pathString, nextList);
      this.runFlow();
    };
    block.appendChild(addBtn);

    if (hasBlocked) {
      this.scopedEngine.stopFlow();
    }
  }



  actionButton(label, callback) {
    const row = this._createQuestionRow();
    const btn = document.createElement('button');
    btn.className = 'form-button';
    btn.textContent = label;
    const fid = this.nextFid();
    btn.setAttribute('data-fid', fid);
    btn.onclick = (e) => {
      e.preventDefault();
      callback();
    };
    row.appendChild(btn);
  }

  askTextWithAction(label, pathString, actionLabel, actionCallback, onEnterCallback) {
    const locked = !!this.scopedEngine.getValue(`formwizard.lock.${pathString}`);
    const val = this.scopedEngine.getValue(pathString) || "";
    const row = this._createQuestionRow();

    const lbl = document.createElement('div');
    lbl.className = 'form-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const fid = this.nextFid();

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '0.5rem';

    if (locked) {
      const ro = document.createElement('div');
      ro.className = 'form-locked-field';
      ro.textContent = val || "[No Value]";
      container.appendChild(ro);
    } else {
      const inp = document.createElement('input');
      inp.className = 'form-input';
      inp.style.flexGrow = '1';
      inp.type = 'text';
      inp.value = val;
      inp.setAttribute('data-path', pathString);
      inp.setAttribute('data-fid', fid);

      inp.addEventListener('blur', (ev) => {
        if (typeof focusManager !== "undefined" && focusManager.isWashing) return;
        
        const related = ev.relatedTarget;
        const isTargetingButton = (related && (related.tagName === "BUTTON" || related.closest("button"))) ||
                                  (typeof focusManager !== "undefined" && focusManager.isClickingButton);

        const commit = () => {
          const newVal = inp.value.trim() || undefined;
          const oldVal = this.scopedEngine.getValue(pathString);
          if (oldVal !== newVal) {
            this.scopedEngine.setValue(pathString, newVal);
          }
        };

        this.pendingCommits.push(commit);

        const handleBlur = () => {
          const idx = this.pendingCommits.indexOf(commit);
          if (idx !== -1) {
            this.pendingCommits.splice(idx, 1);
            commit();
            if (!isTargetingButton) {
              this.runFlow();
            }
          }
        };
        // Delay blur evaluation in browsers to allow other click events to register
        if (typeof window !== "undefined") {
          setTimeout(handleBlur, 150);
        } else {
          handleBlur();
        }
      });

      inp.addEventListener('keydown', ev => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          const newVal = inp.value.trim() || undefined;
          this.scopedEngine.setValue(pathString, newVal);
          
          if (onEnterCallback) {
            onEnterCallback();
          } else {
            this.runFlow();
          }

          if (typeof focusManager !== "undefined") {
            focusManager.focusNextTextField(fid);
          }
        }
      });

      container.appendChild(inp);
    }

    const actionBtn = document.createElement('button');
    actionBtn.className = 'form-button form-button-destructive';
    actionBtn.textContent = actionLabel;
    
    const actionBtnFid = this.nextFid();
    actionBtn.setAttribute('data-fid', actionBtnFid);
    if (typeof focusManager !== "undefined") {
      actionBtn.addEventListener('focus', () => focusManager.trackFocus(actionBtn));
    }
    actionBtn.onclick = (e) => {
      e.preventDefault();
      actionCallback();
    };
    container.appendChild(actionBtn);
    row.appendChild(container);
  }

  #autoSaveText(fieldEl, pathString, fid) {
    if (typeof focusManager !== "undefined") {
      fieldEl.addEventListener('focus', () => {
        focusManager.trackFocus(fieldEl);
      });
    }

    fieldEl.addEventListener('blur', (ev) => {
      // 1. Ignore synthetic blur events triggered when the DOM is washed during a rendering loop.
      if (typeof focusManager !== "undefined" && focusManager.isWashing) return;

      const related = ev.relatedTarget;
      const isTargetingButton = (related && (related.tagName === "BUTTON" || related.closest("button"))) ||
                                (typeof focusManager !== "undefined" && focusManager.isClickingButton);

      // 2. Queue the commit operation. Instead of writing text state changes immediately, we record them
      // so they can be flushed synchronously if a user clicks a button or interacts with another element.
      // This prevents the blur event from resetting state (like the "isSaved" flag) after a button click has run.
      const commit = () => {
        this.scopedEngine.setValue(`formwizard.touched.${pathString}`, true);
        const oldVal = this.scopedEngine.getValue(pathString);
        const newVal = fieldEl.value.trim() || undefined;

        if (oldVal !== newVal) {
          this.scopedEngine.setValue(pathString, newVal);
        }
      };

      this.pendingCommits.push(commit);

      const handleBlur = () => {
        const idx = this.pendingCommits.indexOf(commit);
        if (idx !== -1) {
          this.pendingCommits.splice(idx, 1);
          commit();
          if (!isTargetingButton) {
            this.runFlow();
          }
        }
      };
      
      // Delay blur evaluation in browsers to allow other click events (like buttons) to register first.
      // If a button click fires, it will synchronously flush this queue beforehand.
      if (typeof window !== "undefined") {
        setTimeout(handleBlur, 150);
      } else {
        handleBlur();
      }
    });

    fieldEl.addEventListener('keydown', ev => {
      if (ev.key === "Tab") {
        ev.preventDefault();

        const currentVal = this.scopedEngine.getValue(pathString);
        const newVal = fieldEl.value.trim() || undefined;
        const changed = (currentVal !== newVal);

        if (changed && !ev.shiftKey) {
          this.scopedEngine.setValue(pathString, newVal);
          this.runFlow();
          if (typeof focusManager !== "undefined") {
            focusManager.focusFidAfter(fid);
          }
          return;
        }

        if (typeof focusManager !== "undefined") {
          if (ev.shiftKey) {
            focusManager.movePrevious(fieldEl);
          } else {
            focusManager.moveNext(fieldEl);
          }
        }
      }
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();

        const newVal = fieldEl.value.trim() || undefined;
        this.scopedEngine.setValue(pathString, newVal);

        this.runFlow();
        if (typeof focusManager !== "undefined") {
          focusManager.focusNextTextField(fid);
        }
      }
    });
  }

  #autoGrowTextArea(ta) {
    const grow = () => {
      ta.style.height = 'auto';
      ta.style.height = (ta.scrollHeight) + 'px';
    };
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(grow);
    } else {
      grow();
    }
    ta.addEventListener('input', grow);
  }

  #registerFieldValidation(label, pathString, val, validationOptions, choices) {
    let isValid = true;
    let errorMsg = "";
    let isChoiceMismatch = false;

    // 1. Enforce choice membership if choices are provided and val is present
    if (choices && val) {
      if (Array.isArray(choices)) {
        const chosen = typeof val === 'string' ? val.split(",").map(x => x.trim()).filter(Boolean) : [val];
        const validValues = choices.map(o => o.value);
        const hasInvalidChoice = chosen.some(v => !validValues.includes(v));
        if (hasInvalidChoice) {
          isValid = false;
          isChoiceMismatch = true;
          errorMsg = `${label} selection is no longer valid`;
        }
      }
    }

    // 2. Evaluate explicit validation constraints if present
    if (validationOptions && isValid) {
      if (validationOptions.required && (!val || (typeof val === 'string' && !val.trim()))) {
        isValid = false;
        errorMsg = validationOptions.errorMsg || `${label} is required`;
      } else if (validationOptions.pattern && val && (typeof val === 'string') && !validationOptions.pattern.test(val)) {
        isValid = false;
        errorMsg = validationOptions.errorMsg || `${label} format is invalid`;
      } else if (validationOptions.validate) {
        const res = validationOptions.validate(val);
        if (res !== true) {
          isValid = false;
          errorMsg = typeof res === 'string' ? res : (validationOptions.errorMsg || `${label} is invalid`);
        }
      }
    }

    const touched = isChoiceMismatch || !!this.scopedEngine.getValue(`formwizard.touched.${pathString}`);

    if (!isValid) {
      this.activeErrors.push({
        label,
        pathString,
        errorMsg,
        touched
      });
      return { isValid: false, errorMsg, touched };
    }
    if (validationOptions || (choices && val)) {
      return { isValid: true, touched };
    }
    return null;
  }

  flushPendingCommits() {
    if (this.pendingCommits && this.pendingCommits.length > 0) {
      const commits = [...this.pendingCommits];
      this.pendingCommits = [];
      commits.forEach(commit => commit());
    }
  }


  #finalizeCheck(container, pathString) {
    const cbs = container.querySelectorAll('input[type="checkbox"]');
    const arr = [];
    cbs.forEach(cb => { if (cb.checked) arr.push(cb.value); });
    const newVal = arr.length > 0 ? arr.join(", ") : undefined;
    this.scopedEngine.setValue(pathString, newVal);
  }
}

  if (typeof window !== "undefined") {
    window.FormWizard = FormWizard;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { FormWizard };
  }
})();
