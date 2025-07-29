# Recause and sample UI Wizards

**A minimalist JavaScript meta-framework (Recause) as basis for any frameworks following a new programming model, plus three sample, composable UI frameworks using it (PageWizard, FormWizard, ChatWizard) for building step-by-step UI flows**.

The **Recause meta-framework** can be ported easily to other languages, this here is implemented in JavaScript. We call it meta-framework as it is more sensibly used as foundation of other frameworks rather than directly. Recause is super-minimalistic at less than 300 lines of code. Given its simplicity I suggest to copy, understand, own, and evolve it yourself - which consequently doesn't lock you and your team into anything exterior.

The **PageWizard, FormWizard, ChatWizard example frameworks** resting on Recause are already rather useful as they offer an incredibly concise and simple approach to building multi-page wizards that flexibly mix input forms and chat sequences including nestings of one inside the other (forms containing chats, chats containing forms). At less than 1200 lines of code these can form a starting point for your own more elaborate UI framework(s), so feel free to copy, understand, own, and evolve as you please, again without any strings attached.

The/any **application** written with the aid of Recause-enabled frameworks invariably consists of a single flow. In JavaScript that flow is a single, arbitrarliy complicated function, for example. At runtime, each flow instance has its current flow state: a hierarchical data structure that is updated as the flow progresses. The only way a flow may modify its own flow state is by calling functions of the Recause-enabled frameworks. These framework functions behave differently depending on the availability of certain flow state data: when input data for the flow state is missing and cannot be obtained then the functions suspend the flow and optionally trigger actions that e.g help acquire the missing data; when the desired input data for the flow state is present then the same function will keep the flow running and optionally trigger other actions. Unless deemed finished a suspended flow needs to be restarted from the outside - often by asynchronous completions.

The **picture at runtime** looks as follows, starting from scratch: The main() or some other application function calls a framework function and passes it the application's flow function. The framework calls the Recause framework, the Recause framework calls the application flow function, the application flow function calls a framework function. When the framework function has the desired state it does its thing and simply returns to the application flow function so it can continue along. But when the framework function seeks currently unavailable yet needed flow state data then it does its thing to potentially asynchronously trigger the acquisition of the missing data and then throws an exception. The application flow does not - must not - catch the particular exception, but the Recause framework does. The Recause framework determines that there is no use of the flow re-running now and returns to the original framework function. The framework function returns to the original application function, which might end processing until an asynchronous completion function is called again that ......updates the flow state and restarts the flow again. 

The **Recause programming model** “suspends” your flow when data is missing from the flow state by throwing an exception that the application need not catch. It then re-runs the same flow again from the start, typically whenever new data arrives—passing the steps whose input data are already known. The flow state essentially serves the role of a structured "program counter" as it guides where the suspended flow continues. This programming model allows to easily program any application or process flows in the chosen programming language - here JavaScript - in a very intuitive, almost declarative-looking way but offering almost all the bells and whistles that your programming language offers. Compared to usually heavyweight yet limited DSLs the simplicity gained is amazing. The downside of the approach is that some seemingly straightforward solutions may be misleading. Find out if this is something for you! 

Careful, highly experimental for now. And be aware that the approach taken can twist your brain a little at times.

---

## Recause (Meta-Framework)

1. **Exception-Based “Wait & Resume”**  
   - Write a single function describing your entire flow.  
   - When new data is needed, Recause throws an exception to halt, then re-runs the flow e.g. once that data is available.

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

### Example Flows

If only one, then use and inspect RecauseChatWizard3 - it is the most current one. 

The actual domain flows - the simple dialog specs - are shown at the tails of the examples, respectively.

A “vacation planner” example (**RecauseChatWizard**):
- Asks about travel plans and collects certain data  
- Stores all data in Recause’s single state object

A "house inventory" example (**RecauseChatWizard2**):
- Asks about number of houses and collects data for each

A "house inventory" example (**RecauseChatWizard3**):
- Asks about number of houses and collects data for each
- Now keeps data in hierarchical state structure
- Now prompts have indentation
- Based on Recause supporting hierarchical state
- Based on ChatWizard supporing indentation small other visual improvements

You can **serialize** that state any time and **reload** it later—resuming exactly where you left off.

---

### License

[MIT](LICENSE)

---

### Contributing

Suggestions or any constructive or destructive feedbacks, are welcome! I haven't seen a beast like this before but may just not know enough. Still wondering what this actually is.

### Final Notes

I'm aware that abusing exceptions like this is a performance sin and I will fry in hell for using them this way. But it's fun and seems useful upon first sight. Moreover, my old Mac can do 200'000 JavaScript exceptions per second. So while perhaps a problem in the backend there is less of a problem on the frontend.
So I rather tend to demand lightweight exceptions from the programming language folks for the moment (until I agree about how rotten the approach is).
Oh and "Recause" is essentially for 'cause again' and in French, when adorned with an accent, it means to "talk again with someone".
An alternative name was "Tentativity" which isn't a real word either but nicely captures that the state is tentative/counterfactual until it becomes factual, sort of.

