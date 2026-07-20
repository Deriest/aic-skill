## 33. Bash backtick execution in worker prompt templates

**Symptom:** Server log shows `tsx: command not found`, `html: command not found`, `css: command not found` during IMPLEMENTATION phase. Workers still spawn but prompt is corrupted.

**Root cause:** `phase-runner.sh` generates worker prompts via `cat > "$PROMPT_FILE" << PROMPT ... PROMPT`. Code block examples with triple backticks (```) in the prompt text are interpreted by bash as command substitution, not literal text.

**Example of broken prompt:**
```bash
# This triggers bash execution of "tsx src/components/MyComponent.tsx"
cat > prompt.txt << PROMPT
For EVERY file, use fenced code blocks:
    ```tsx src/components/MyComponent.tsx
    // actual code here
    ```
PROMPT
```

**Fix:** Replace backtick examples with placeholder text:
```bash
cat > prompt.txt << PROMPT
For EVERY file, use fenced code blocks:
    BACKTICK-BACKTICK-BACKTICKtsx src/components/MyComponent.tsx
    // actual code here
    BACKTICK-BACKTICK-BACKTICK
Replace BACKTICK-BACKTICK-BACKTICK with three backtick characters (code fence).
PROMPT
```

**Rule:** NEVER use literal backticks inside bash heredoc (`<< PROMPT`) — they trigger command substitution. Use placeholder strings and instruct the LLM to replace them.

**File:** `scripts/phase-runner.sh` (IMPLEMENTATION_SKELETON_BLOCK section)

## Key Principle

**Never return `{ ok: false }` from `pmRepairLoop` without first attempting ship_with_caveats.** Every `{ ok: false }` propagates to `runPipeline` which stops the entire pipeline.

**After code extraction, always verify:** TypeScript, dependency versions (R3F/React compat), missing devDeps, serve in browser.
