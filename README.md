# Recause & ChatWizard

**A minimal JavaScript meta-framework (Recause) and a chat-style UI layer (ChatWizard) for building step-by-step flows**.

This approach “pauses” your flow at each prompt by throwing an exception, then re-runs the same function from the start whenever new data arrives—skipping any steps whose data are already known.

Careful, highly experimental for now.

---

## Recause (Meta-Framework)

1. **Exception-Based “Pause & Resume”**  
   - Write a single function describing your entire flow.  
   - When new data is needed, Recause throws an exception to halt, then re-runs the flow once that data is available.

2. **Single State Object (Portable & Serializable)**  
   - All data (progress, answers, partial inputs) is stored in a single JSON-friendly object.  
   - Easily persist or transport flows mid-execution and pick up exactly where you left off on another device or server.

3. **Fully Programmable Flows**  
   - Use standard JavaScript (loops, conditionals, async calls, etc.)—no specialized DSL or rigid state machines.  
   - Can run in the browser or Node.js, making it suitable for diverse environments.

4. **Beyond User Prompts**  
   - Although showcased with a chat UI, Recause works for any **incremental data or async** scenario where an arbitrary flow needs to pause until more info arrives.

---

## ChatWizard (UI Framework on Recause)

1. **Chat-Style Interface**  
   - Provides straightforward methods like `askText`, `askRadio`, `askCheckbox`, etc.  
   - Displays previously given answers in read-only mode until edited, automatically skipping those steps on re-run.

2. **Automatic Flow Replay**  
   - Hooks into Recause’s mechanism to re-run your flow whenever new input is submitted.  
   - Skips already answered questions, unless the user chooses to edit them.

3. **Clean Separation of Concerns**  
   - ChatWizard handles UI rendering and flow invocation.  
   - Recause manages the flow logic and state storage.  
   - Your domain flow remains plain JavaScript.

4. **Minimal & Extensible**  
   - No heavy dependencies—just DOM manipulation for a simple chat-like experience.  
   - Unclear if integration with other UI/Reactive Frameworks sensible.

---

### Example Flow

A “vacation planner” example is provided:
- Asks about travel plans and collects certain data  
- Stores all data in Recause’s single state object

You can **serialize** that state any time and **reload** it later—resuming exactly where you left off.

---

### License

[MIT](LICENSE)

---

### Contributing

Suggestions or any constructive or destructive feedbacks, are welcome! I haven't seen a beast like this before but may just not know enough. Still wondering what this actually is.

### Final Notes
I'm aware that abusing exceptions like this is a performance sin and I will fry in hell for using them this way. But it's fun and seems useful upon first sight.
So I rather tend to demand lightweight exceptions from the programming language folks for the moment (until I agree about how rotten the approach is).
Oh and "Recause" is essentially for 'cause again' and in French, when adorned with an accent, it means to "talk again with someone".
An alternative name was "Tentativity" which isn't a real word either but nicely captures that the state is tentative/counterfactual until it becomes factual, sort of.

The forceStateOrder() function inspires that Recause should next be extended to support the stating of more global rules, eg causality constraints or invariants that ought to be obeyed at all times... Need to ponder this.
