/*****************************************************************************
 * Recause Framework
 *     - Supports frameworks and applications based on the recause programming
 *       model. Can be considered a metaframework as unlikely used on its own.
 *     - The programming model iterates over the same single flow (a programming
 *       language function) until the purpose of the flow is fulfilled.
 *       The purpose is fulfilled once a certain flow state associated with the
 *       engine instance running the flow has been reached. Then the iterations
 *       and the engine instance stop and the remaining state can be used.
 *       The flow can be arbitrarily complex and stop its own execution at any
 *       point, typically whenever necessary state is missing. Once new state
 *       is considered to have become available the next iteration starts.
 *       The programming model allows for very concisely defined domain-specific
 *       flows. And it is suitable to build derived frameworks for specific
 *       types of domain applications, making the domain-specific flows even 
 *       more concise.
 *     - The programming model - by making all relevant engine instance state
 *       explicit - allows for flows to move freely between engines running
 *       the same flow. So an executing flow is portable by suspending the
 *       flow execution and serialising the state in the original engine
 *       and loading the state and resuming the flow execution in the new
 *       engine.
 *     - The Recause Framework is new and unrefined. It has a number of 
 *       supporting functions that may be useful but may turn out to be 
 *       superfluous. Likely other supporting functions would be desirable
 *       and we only find out over time. Feedback is welcome, enjoy!
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

function isChildrenArray(val) {
  if (!Array.isArray(val)) return false;
  if (val.length === 0) return true;
  return val.every(item => 
    Array.isArray(item) && 
    item.length === 3 && 
    typeof item[0] === 'string' && 
    typeof item[2] === 'number'
  );
}

class RecauseEngine {
  constructor(state, flow, name, options = {}) {
    this.parentRecauseEngine = null;
    this.historyEnabled = !!options.recordHistory;
    this.stateHistory = [];
    this.stateHistoryIndex = -1;
    this.listeners = [];
    this.isDraft = false;
    this.runningFlow = false;

    this.loadStateOrInit(state);
    
    this.flow = flow;
    this.name = name;
    this.ran = false;
    this.rethrowStopFlow = true;
  }

  loadStateOrInit(state) {
    if (Array.isArray(state)) {
      this.stateHistory = state.length > 0 ? JSON.parse(JSON.stringify(state)) : [this._createEmptyState()];
      this.stateHistoryIndex = this.stateHistory.length - 1;
      const active = this.stateHistory[this.stateHistoryIndex];
      this.stateTree = active.stateTree;
      this.globalRev = active.globalRev;
    } else {
      let active;
      if (!state || !state.stateTree) {
        active = this._createEmptyState();
      } else if (typeof state === "string") {
        active = JSON.parse(state);
      } else {
        active = JSON.parse(JSON.stringify(state));
      }
      this.stateHistory = [active];
      this.stateHistoryIndex = 0;
      this.stateTree = active.stateTree;
      this.globalRev = active.globalRev;
    }
    this.isDraft = false;
  }

  _createEmptyState() {
    return {
      stateTree: ["root", [], 0],
      globalRev: 0
    };
  }

  checkpoint() {
    if (!this.historyEnabled) return;
    this.isDraft = false;
  }

  undo() {
    if (this.historyEnabled && this.stateHistoryIndex > 0) {
      this.stateHistoryIndex--;
      const active = JSON.parse(JSON.stringify(this.stateHistory[this.stateHistoryIndex]));
      this.stateTree = active.stateTree;
      this.globalRev = active.globalRev;
      this.isDraft = false;
      this.notify();
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyEnabled && this.stateHistoryIndex < this.stateHistory.length - 1) {
      this.stateHistoryIndex++;
      const active = JSON.parse(JSON.stringify(this.stateHistory[this.stateHistoryIndex]));
      this.stateTree = active.stateTree;
      this.globalRev = active.globalRev;
      this.isDraft = false;
      this.notify();
      return true;
    }
    return false;
  }

  canUndo() {
    return this.historyEnabled && this.stateHistoryIndex > 0;
  }

  canRedo() {
    return this.historyEnabled && this.stateHistoryIndex < this.stateHistory.length - 1;
  }

  getStateHistory() {
    this.stateHistory[this.stateHistoryIndex] = JSON.parse(JSON.stringify(this.getState()));
    return this.historyEnabled ? JSON.parse(JSON.stringify(this.stateHistory)) : [this.getState()];
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notify() {
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
    if (!this.parentRecauseEngine) console.log(this._s() + "********************" + this.name + " " + (new Date().toISOString().substr(14, 5)));
    if (this.ran && this.parentRecauseEngine) {
      console.log(this._s() + "RE before parent runFlow()" + this.name + " " + (new Date().toISOString().substr(14, 5)));
      this.parentRecauseEngine.runFlow();
    }
    else {
      console.log(this._s() + "RE before _runFlow()" + this.name + " " + (new Date().toISOString().substr(14, 5)));
      this._runFlow();
    }
  }

  _runFlow() {
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
              throw e; // new StopFlow();
            break;
          } else if (e instanceof RestartFlow) {
            console.log(this._s() + "RE hit RestartFlow " + this.name + " " + (new Date().toISOString().substr(14, 5)));
            if (this.parentRecauseEngine)
              throw e; // new RestartFlow();
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
    // Call me when waiting for mandatory values (this is by definition about this RecauseEngine's state).
    throw new StopFlow();
  }

  restartFlow() {
    // Call me when some past values changed and we need to re-evaluate to become current again.
    throw new RestartFlow();
  }

  getState() {
    return {
      stateTree: this.stateTree,
      globalRev: this.globalRev,
    };
  }

  getStateAsJSON() {
    return JSON.stringify(this.getState());
  }

  setValue(pathString, newValue) {
    const oldVal = this.getValue(pathString);
    if (oldVal === newValue) return;
    if (typeof oldVal === "object" && typeof newValue === "object" && JSON.stringify(oldVal) === JSON.stringify(newValue)) {
      return;
    }

    if (this.historyEnabled && !this.isDraft && !this.runningFlow) {
      this.stateHistory[this.stateHistoryIndex] = JSON.parse(JSON.stringify(this.getState()));
      this.stateHistory = this.stateHistory.slice(0, this.stateHistoryIndex + 1);
      
      const clone = JSON.parse(JSON.stringify(this.getState()));
      this.stateHistory.push(clone);
      this.stateHistoryIndex = this.stateHistory.length - 1;
      this.isDraft = true;
      
      this.stateTree = clone.stateTree;
      this.globalRev = clone.globalRev;
    }

    this._setValueAtPathArray(this._dotPathToArray(pathString), newValue);

    if (this.historyEnabled) {
      this.stateHistory[this.stateHistoryIndex] = JSON.parse(JSON.stringify(this.getState()));
    }
  }

  getValue(pathString) {
    return this._getValueAtPathArray(this._dotPathToArray(pathString));
  }

  getValueElseStop(pathString) {
    const value = this.getValue(pathString);
    if (value == undefined)
      this.stopFlow();
    return value;
  }

  getValueOrDefault(pathString, defaultVal) {
    const value = this.getValue(pathString);
    return value == undefined ? defaultVal : value;
  }

  hasValue(pathString) {
    const value = this.getValue(pathString);
    return value == undefined ? false : true;
  }

  removeValue(pathString) {
    this._removeNodeAtPathArray(this._dotPathToArray(pathString));
  }

  revisionValue(pathString) {
    return this._getRevisionAtPathArray(this._dotPathToArray(pathString));
  }

  ageValue(pathString) {
    const rev = this.revisionValue(pathString);
    return (typeof rev !== "number") ? Infinity : (this.globalRev - rev + 1);
  }

  forceValueOrder(olderPathStr, newerPathStr) {
    if (this.revisionValue(olderPathStr) >= this.revisionValue(newerPathStr))
      this.removeValue(newerPathStr);
  }

  getLevel() {
    return this.level;
  }

  _dotPathToArray(dotPath) {
    return !dotPath ? [] : dotPath.split(".");
  }

  _getNodeByPath(pathArray, createIfMissing = false) {
    const chain = [this.stateTree];
    let currentNode = this.stateTree;

    for (const path of pathArray) {
      let children = isChildrenArray(currentNode[1]) ? currentNode[1] : null;
      if (!children) {
        if (!createIfMissing) {
          return [null, chain];
        }
        currentNode[1] = [];
        children = currentNode[1];
      }
      let child = children.find((c) => c[0] === path);
      if (!child && createIfMissing) {
        child = [path, [], 0];
        children.push(child);
      } else if (!child) {
        return [null, chain];
      }
      chain.push(child);
      currentNode = child;
    }

    return [currentNode, chain];
  }

  _setValueAtPathArray(pathArray, newValue) {
    this.globalRev++;
    const newRev = this.globalRev;

    const [targetNode, chain] = this._getNodeByPath(pathArray, true);
    if (!targetNode) return;

    targetNode[1] = newValue;
    targetNode[2] = newRev;

    for (const ancestor of chain.slice(0, -1)) {
      ancestor[2] = newRev;
    }
  }

  _getValueAtPathArray(pathArray) {
    const [node] = this._getNodeByPath(pathArray, false);
    return node ? node[1] : undefined;
  }

  _getRevisionAtPathArray(pathArray) {
    const [node] = this._getNodeByPath(pathArray, false);
    return node ? node[2] : undefined;
  }

  _removeNodeAtPathArray(pathArray) {
    if (pathArray.length === 0) {
      return;
    }
    const parentPath = pathArray.slice(0, -1);
    const pathToRemove = pathArray[pathArray.length - 1];

    const [parentNode, chain] = this._getNodeByPath(parentPath, false);
    if (!parentNode) return;

    const children = isChildrenArray(parentNode[1]) ? parentNode[1] : null;
    if (!children) return;

    const idx = children.findIndex((c) => c[0] === pathToRemove);
    if (idx === -1) {
      return;
    }
    children.splice(idx, 1);

    this.globalRev++;
    const newRev = this.globalRev;
    for (const ancestor of chain) {
      ancestor[2] = newRev;
    }
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
    };
  }
}

class ScopedEngineView {
  constructor(engine, prefix) {
    this.engine = engine;
    this.prefix = prefix;
  }

  _resolvePath(path) {
    if (!path) return this.prefix;
    if (path.startsWith("/")) {
      return path.slice(1);
    }
    return this.prefix ? `${this.prefix}.${path}` : path;
  }

  setValue(path, newValue) {
    this.engine.setValue(this._resolvePath(path), newValue);
  }

  getValue(path) {
    return this.engine.getValue(this._resolvePath(path));
  }

  getValueElseStop(path) {
    const val = this.getValue(path);
    if (val === undefined) {
      this.stopFlow();
    }
    return val;
  }

  getValueOrDefault(path, defaultVal) {
    const val = this.getValue(path);
    return val === undefined ? defaultVal : val;
  }

  hasValue(path) {
    return this.getValue(path) !== undefined;
  }

  removeValue(path) {
    this.engine.removeValue(this._resolvePath(path));
  }

  revisionValue(path) {
    return this.engine.revisionValue(this._resolvePath(path));
  }

  ageValue(path) {
    return this.engine.ageValue(this._resolvePath(path));
  }

  forceValueOrder(olderPathStr, newerPathStr) {
    if (this.revisionValue(olderPathStr) >= this.revisionValue(newerPathStr))
      this.removeValue(newerPathStr);
  }

  stopFlow() {
    this.engine.stopFlow();
  }

  restartFlow() {
    this.engine.restartFlow();
  }

  getState() {
    return this.engine.getState();
  }

  getStateAsJSON() {
    return this.engine.getStateAsJSON();
  }

  scope(subPrefix) {
    const newPrefix = this.prefix ? `${this.prefix}.${subPrefix}` : subPrefix;
    return new ScopedEngineView(this.engine, newPrefix);
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
    ScopedEngineView,
    StopFlow,
    RestartFlow
  };
}
