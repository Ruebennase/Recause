/*****************************************************************************
 * Recause Framework - Core State Engine 
 *     - Supports frameworks and applications based on the recause programming
 *       model. Can be considered a metaframework as unlikely used on its own.
 *     - Tagged checkpoints for multi-granularity history (undo/redo).
 * ******************************************************************************/

class StopFlow extends Error {
  constructor() {
    super("StopFlow");
    this.name = "StopFlow";
  }
}

class RestartFlow extends Error {
  constructor() {
    super("RestartFlow");
    this.name = "RestartFlow";
  }
}

class RecauseEngine {
  constructor(stateOrEngine, flow, name, options = {}) {
    if (stateOrEngine instanceof RecauseEngine) {
      this.rootEngine = stateOrEngine.rootEngine || stateOrEngine;
      this.prefix = (typeof flow === "string") ? flow : (options.prefix || "");
      return;
    }

    this.rootEngine = this;
    this.prefix = "";
    this.parentRecauseEngine = null;
    this.historyEnabled = !!options.recordHistory;
    this.stateHistory = [];
    this.stateHistoryIndex = -1;
    this.listeners = [];
    this.isDraft = false;
    this.runningFlow = false;

    this.loadOrInitState(stateOrEngine);
    
    this.flow = flow;
    this.name = name;
    this.ran = false;
    this.rethrowStopFlow = true;
  }

  loadOrInitState(state) {
    if (this !== this.rootEngine) {
      this.rootEngine.loadOrInitState(state);
      return;
    }

    if (Array.isArray(state)) {
      this.stateHistory = state.length > 0 ? JSON.parse(JSON.stringify(state)) : [this._createEmptyState()];
      this.stateHistoryIndex = this.stateHistory.length - 1;
      const active = this.stateHistory[this.stateHistoryIndex];
      this.values = new Map(Object.entries(active.values || {}));
      this.revisions = new Map(Object.entries(active.revisions || {}));
      this.globalRev = active.globalRev || 0;
    } else {
      let active;
      if (!state || (!state.values && !state.stateTree)) {
        active = this._createEmptyState();
      } else if (typeof state === "string") {
        active = JSON.parse(state);
      } else {
        active = JSON.parse(JSON.stringify(state));
      }
      this.stateHistory = [active];
      this.stateHistoryIndex = 0;
      this.values = new Map(Object.entries(active.values || {}));
      this.revisions = new Map(Object.entries(active.revisions || {}));
      this.globalRev = active.globalRev || 0;
    }
    this.isDraft = false;
  }

  _createEmptyState() {
    return {
      values: {},
      revisions: {},
      globalRev: 0,
      tags: []
    };
  }

  checkpoint(tag) {
    if (this !== this.rootEngine) {
      this.rootEngine.checkpoint(tag);
      return;
    }
    if (!this.historyEnabled) return;
    this.isDraft = false;

    if (tag && this.stateHistory[this.stateHistoryIndex]) {
      const active = this.stateHistory[this.stateHistoryIndex];
      if (!active.tags) active.tags = [];
      if (!active.tags.includes(tag)) {
        active.tags.push(tag);
      }
    }
  }

  undo(tag) {
    if (this !== this.rootEngine) {
      return this.rootEngine.undo(tag);
    }
    if (!this.historyEnabled) return false;

    let targetIndex = -1;
    if (tag) {
      for (let i = this.stateHistoryIndex - 1; i >= 0; i--) {
        const entry = this.stateHistory[i];
        if (entry.tags && entry.tags.includes(tag)) {
          targetIndex = i;
          break;
        }
      }
    } else {
      if (this.stateHistoryIndex > 0) {
        targetIndex = this.stateHistoryIndex - 1;
      }
    }

    if (targetIndex !== -1) {
      this.stateHistoryIndex = targetIndex;
      const active = JSON.parse(JSON.stringify(this.stateHistory[this.stateHistoryIndex]));
      this.values = new Map(Object.entries(active.values || {}));
      this.revisions = new Map(Object.entries(active.revisions || {}));
      this.globalRev = active.globalRev;
      this.isDraft = false;
      this.notify();
      return true;
    }
    return false;
  }

  redo(tag) {
    if (this !== this.rootEngine) {
      return this.rootEngine.redo(tag);
    }
    if (!this.historyEnabled) return false;

    let targetIndex = -1;
    if (tag) {
      for (let i = this.stateHistoryIndex + 1; i < this.stateHistory.length; i++) {
        const entry = this.stateHistory[i];
        if (entry.tags && entry.tags.includes(tag)) {
          targetIndex = i;
          break;
        }
      }
    } else {
      if (this.stateHistoryIndex < this.stateHistory.length - 1) {
        targetIndex = this.stateHistoryIndex + 1;
      }
    }

    if (targetIndex !== -1) {
      this.stateHistoryIndex = targetIndex;
      const active = JSON.parse(JSON.stringify(this.stateHistory[this.stateHistoryIndex]));
      this.values = new Map(Object.entries(active.values || {}));
      this.revisions = new Map(Object.entries(active.revisions || {}));
      this.globalRev = active.globalRev;
      this.isDraft = false;
      this.notify();
      return true;
    }
    return false;
  }

  canUndo(tag) {
    if (this !== this.rootEngine) return this.rootEngine.canUndo(tag);
    if (!this.historyEnabled) return false;
    if (tag) {
      for (let i = this.stateHistoryIndex - 1; i >= 0; i--) {
        const entry = this.stateHistory[i];
        if (entry.tags && entry.tags.includes(tag)) return true;
      }
      return false;
    }
    return this.stateHistoryIndex > 0;
  }

  canRedo(tag) {
    if (this !== this.rootEngine) return this.rootEngine.canRedo(tag);
    if (!this.historyEnabled) return false;
    if (tag) {
      for (let i = this.stateHistoryIndex + 1; i < this.stateHistory.length; i++) {
        const entry = this.stateHistory[i];
        if (entry.tags && entry.tags.includes(tag)) return true;
      }
      return false;
    }
    return this.stateHistoryIndex < this.stateHistory.length - 1;
  }

  getStateHistory() {
    if (this !== this.rootEngine) return this.rootEngine.getStateHistory();
    const oldTags = this.stateHistory[this.stateHistoryIndex]?.tags || [];
    const updatedEntry = JSON.parse(JSON.stringify(this.getState()));
    updatedEntry.tags = oldTags;
    this.stateHistory[this.stateHistoryIndex] = updatedEntry;
    return this.historyEnabled ? JSON.parse(JSON.stringify(this.stateHistory)) : [this.getState()];
  }

  subscribe(fn) {
    if (this !== this.rootEngine) return this.rootEngine.subscribe(fn);
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
    if (this !== this.rootEngine) return this.rootEngine.notify();
    this.listeners.forEach(fn => fn(this.getState()));
  }

  setParent(re) {
    this.parentRecauseEngine = re;
  }

  getParentCount() {
    return (!this.parentRecauseEngine) ? 0 : (1 + this.parentRecauseEngine.getParentCount());
  }

  setRethrowStopFlow(rethrowStopFlow) {
    this.rethrowStopFlow = rethrowStopFlow;
  }

  _s() {
    return "  ".repeat(this.getParentCount());
  }

  runFlow() {
    if (this !== this.rootEngine) {
      this.rootEngine.runFlow();
      return;
    }
    if (!this.parentRecauseEngine) console.log(this._s() + "********************" + this.name + " " + (new Date().toISOString().substr(14, 5)));
    if (this.ran && this.parentRecauseEngine) {
      console.log(this._s() + "RE before parent runFlow()" + this.name + " " + (new Date().toISOString().substr(14, 5)));
      this.parentRecauseEngine.runFlow();
    } else {
      console.log(this._s() + "RE before _runFlow()" + this.name + " " + (new Date().toISOString().substr(14, 5)));
      this._runFlow();
    }
  }

  _runFlow() {
    if (this !== this.rootEngine) {
      this.rootEngine._runFlow();
      return;
    }
    this.runningFlow = true;
    try {
      while (true) {
        try {
          this.ran = true;
          this.flow();
          console.log(this._s() + "RE after _runFlow()/flow() " + this.name + " " + (new Date().toISOString().substr(14, 5)));
          break;
        } catch (e) {
          if (e instanceof StopFlow) {
            console.log(this._s() + "RE hit StopFlow " + this.name + " " + (new Date().toISOString().substr(14, 5)));
            if (this.parentRecauseEngine && this.rethrowStopFlow)
              throw e;
            break;
          } else if (e instanceof RestartFlow) {
            console.log(this._s() + "RE hit RestartFlow " + this.name + " " + (new Date().toISOString().substr(14, 5)));
            if (this.parentRecauseEngine)
              throw e;
            continue;
          } else {
            console.log(this._s() + "RE hit OTHER EXCEPTION " + this.name + " " + (new Date().toISOString().substr(14, 5)));
            throw e;
          }
        }
      }
    } finally {
      this.runningFlow = false;
    }
    console.log(this._s() + "RE at end of _runFlow() " + this.name + " " + (new Date().toISOString().substr(14, 5)));
    this.notify();
  }

  stopFlow() {
    throw new StopFlow();
  }

  restartFlow() {
    throw new RestartFlow();
  }

  getState() {
    if (this !== this.rootEngine) {
      return this.rootEngine.getState();
    }
    return {
      values: Object.fromEntries(this.values),
      revisions: Object.fromEntries(this.revisions),
      globalRev: this.globalRev,
    };
  }

  getStateAsJSON() {
    return JSON.stringify(this.getState());
  }

  _resolvePath(path) {
    if (!path) return this.prefix;
    if (path.startsWith("/")) {
      return path.slice(1);
    }
    return this.prefix ? `${this.prefix}.${path}` : path;
  }

  setValue(pathString, newValue) {
    if (this !== this.rootEngine) {
      this.rootEngine.setValue(this._resolvePath(pathString), newValue);
      return;
    }

    const resolvedPath = this._resolvePath(pathString);
    const oldVal = this.values.get(resolvedPath);
    if (oldVal === newValue) return;
    if (typeof oldVal === "object" && typeof newValue === "object" && JSON.stringify(oldVal) === JSON.stringify(newValue)) {
      return;
    }

    if (this.historyEnabled && !this.isDraft && !this.runningFlow) {
      const oldTags = this.stateHistory[this.stateHistoryIndex]?.tags || [];
      const updatedEntry = JSON.parse(JSON.stringify(this.getState()));
      updatedEntry.tags = oldTags;
      this.stateHistory[this.stateHistoryIndex] = updatedEntry;

      this.stateHistory = this.stateHistory.slice(0, this.stateHistoryIndex + 1);
      
      const clone = JSON.parse(JSON.stringify(this.getState()));
      clone.tags = [];
      this.stateHistory.push(clone);
      this.stateHistoryIndex = this.stateHistory.length - 1;
      this.isDraft = true;
      
      this.values = new Map(Object.entries(clone.values));
      this.revisions = new Map(Object.entries(clone.revisions));
      this.globalRev = clone.globalRev;
    }

    this.globalRev++;
    this.values.set(resolvedPath, newValue);
    this.revisions.set(resolvedPath, this.globalRev);

    // Propagate revision updates to parent paths
    let parent = resolvedPath;
    while (parent.includes('.')) {
      parent = parent.substring(0, parent.lastIndexOf('.'));
      this.revisions.set(parent, this.globalRev);
    }

    if (this.historyEnabled) {
      const oldTags = this.stateHistory[this.stateHistoryIndex]?.tags || [];
      const updatedEntry = JSON.parse(JSON.stringify(this.getState()));
      updatedEntry.tags = oldTags;
      this.stateHistory[this.stateHistoryIndex] = updatedEntry;
    }
  }

  getValue(pathString) {
    if (this !== this.rootEngine) {
      return this.rootEngine.getValue(this._resolvePath(pathString));
    }
    return this.values.get(this._resolvePath(pathString));
  }

  getValueElseStop(pathString) {
    const value = this.getValue(pathString);
    if (value === undefined)
      this.stopFlow();
    return value;
  }

  getValueOrDefault(pathString, defaultVal) {
    const value = this.getValue(pathString);
    return value === undefined ? defaultVal : value;
  }

  hasValue(pathString) {
    return this.getValue(pathString) !== undefined;
  }

  removeValue(pathString) {
    if (this !== this.rootEngine) {
      this.rootEngine.removeValue(this._resolvePath(pathString));
      return;
    }
    const resolvedPath = this._resolvePath(pathString);
    this.values.delete(resolvedPath);
    this.revisions.delete(resolvedPath);

    // Delete nested sub-paths
    const prefix = resolvedPath + ".";
    for (const key of this.values.keys()) {
      if (key.startsWith(prefix)) {
        this.values.delete(key);
        this.revisions.delete(key);
      }
    }

    this.globalRev++;
    let parent = resolvedPath;
    while (parent.includes('.')) {
      parent = parent.substring(0, parent.lastIndexOf('.'));
      this.revisions.set(parent, this.globalRev);
    }
  }

  revisionValue(pathString) {
    if (this !== this.rootEngine) {
      return this.rootEngine.revisionValue(this._resolvePath(pathString));
    }
    return this.revisions.get(this._resolvePath(pathString));
  }

  ageValue(pathString) {
    const rev = this.revisionValue(pathString);
    return (typeof rev !== "number") ? Infinity : (this.globalRev - rev + 1);
  }

  forceValueOrder(olderPathStr, newerPathStr) {
    // Relative revision age check: automatically clears dependent field if the older field is edited.
    if (this.revisionValue(olderPathStr) >= this.revisionValue(newerPathStr))
      this.removeValue(newerPathStr);
  }

  scope(subPrefix) {
    const newPrefix = this.prefix ? `${this.prefix}.${subPrefix}` : subPrefix;
    return new RecauseEngine(this, null, null, { prefix: newPrefix });
  }

  getAPI() {
    return {
      stopFlow: this.stopFlow.bind(this),
      restartFlow: this.restartFlow.bind(this),
      setValue: this.setValue.bind(this),
      hasValue: this.hasValue.bind(this),
      getValue: this.getValue.bind(this),
      getValueElseStop: this.getValueElseStop.bind(this),
      getValueOrDefault: this.getValueOrDefault.bind(this),
      revisionValue: this.revisionValue.bind(this),
      ageValue: this.ageValue.bind(this),
      removeValue: this.removeValue.bind(this),
      getState: this.getState.bind(this),
      getStateAsJSON: this.getStateAsJSON.bind(this),
      scope: this.scope.bind(this),
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    RecauseEngine,
    StopFlow,
    RestartFlow
  };
}
