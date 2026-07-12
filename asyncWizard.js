/*******************************************************************************
 * AsyncWizard Framework
 *     - Separates Async/API concerns from the core Recause Engine.
 *     - Provides UI feedback (Loading states) while waiting.
 *     - Manages Promise lifecycle internally to avoid re-triggering.
 ******************************************************************************/

class AsyncWizard {
    constructor(api) {
        this.api = api;
        // Track in-flight promises to prevent duplicate firing during re-renders.
        // Map<pathString, Promise>
        this.inflight = new Map();
    }

    // The main primitive.
    askData(loadingText, pathString, promiseFactory) {
        const val = this.api.getValue(pathString);

        // 1. Happy Path: Value exists
        if (val !== undefined) {
            // Clean up tracking if it existed (though usually filtered out before here)
            if (this.inflight.has(pathString)) {
                this.inflight.delete(pathString);
            }
            return val;
        }

        // 2. Suspense Path: Value missing

        // A) Render Feedback
        if (this.api.say) {
            this.api.say("⏳ " + (loadingText || "Please wait..."));
        }

        // B) Check if already in-flight
        if (this.inflight.has(pathString)) {
            // Already running. Just stop execution and wait for the existing promise to callback.
            this.api.stopFlow(); // Throws StopFlow
            return; // Unreachable
        }

        // C) Start Promise
        console.log(`[AsyncWizard] Starting fetch for ${pathString}`);
        const promise = promiseFactory()
            .then(result => {
                console.log(`[AsyncWizard] Resolved ${pathString}`, result);
                this.inflight.delete(pathString);
                this.api.setValue(pathString, result);
                // Trigger re-run
                // NOTE: We rely on the Engine's update mechanism. 
                // Since `setValue` was called, the engine state is updated. 
                // We need to ensure the flow runs again.
                // Assuming `api` has `restartFlow` or we rely on the caller to handle reactivity?
                // The `api` passed to AsyncWizard comes from the Wizard (e.g. FormWizard).
                // FormWizard doesn't auto-run on external setValue unless we hook it.
                // BUT `setValue` in `recauseEngine.js` is just state update.
                // WE MUST TRIGGER A RERUN EXPLICITLY.
                // Does `api` expose `runFlow`? No, it exposes `setValue`. 
                // But Recause/Wizards usually don't expose `runFlow` in the API passed to flow.
                // However, FormWizard/PagesWizard usually hook `setValue`? 
                // No, `setValue` is direct on engine.

                // CRITICAL: We need a valid way to trigger the engine to run again.
                // In the previous code, `WaitForPromise` handled this by calling `this.runFlow()` in catch.
                // Here, we are external.
                // We can use `api.restartFlow()` which throws `RestartFlow`. But we are in a text callback, not the stack.
                // throwing `RestartFlow` here does nothing.

                // Correct approach: The `api` passed to AsyncWizard MUST include a capability to trigger a run.
                // FormWizard passes `this.recauseEngine.getAPI()`.
                // This usually doesn't include `runFlow`.
                // However, in the `FormWizard` constructor, we wrap the engine.

                // Let's assume for now that `setValue` DOES NOT trigger a run.
                // We need to hack or request `triggerUpdate` in the API.
                // Or... we rely on the UI event loop? No.

                // The user's prompt said: "runflow from an async call returning which leads to a runflow".
                // Implementation: We need access to the wizard's `runFlow` method or the engine's `runFlow`.
                // `recauseEngine.getAPI()` only has methods acting on state + `stopFlow`/`restartFlow` (which are throws).

                // Fix strategy: We will dispatch a custom event or check if we can call `runFlow` if attached.
                // Actually, `AsyncWizard` is instantiated inside `FormWizard`.
                // `FormWizard` *does* instantiate `AsyncWizard`.
                // `this.asyncWizard = new AsyncWizard({ ...this.recauseEngine.getAPI(), say: ... })`
                // It should ALSO passed `triggerReRun: () => this.runFlow()`.

                if (this.api.runFlow) {
                    this.api.runFlow();
                } else {
                    console.warn("[AsyncWizard] No runFlow found in API! Value set but flow won't restart.");
                    // Fallback: Try `restartFlow` if it's actually a method that runs (not throws)? 
                    // No `restartFlow` in Engine just throws.
                }

            })
            .catch(err => {
                console.error(`[AsyncWizard] Error fetching ${pathString}`, err);
                this.inflight.delete(pathString);
                // Optional: save error state
            });

        this.inflight.set(pathString, promise);

        // D) Stop Flow
        this.api.stopFlow();
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { AsyncWizard };
}
