# Dashboard Config Save Pitfall

## The Issue
When saving configuration via the Dashboard Web UI (`ConfigPage.tsx`), two critical regressions occur:

1. **API Key literal `***` corruption**: The input field uses `value={showApiKey ? apiKey : '***'}`. If the user clicks "Save" without first revealing the API key (clicking the eye/reveal button), the literal string `***` is saved to `opencode.jsonc` and `.env`, breaking authentication and causing "Invalid Credentials" errors.
2. **Model Hardcoding Override**: The `handleSave` function reconstructs `opencodeObj` and forcefully injects `Opus`, `Sonnet`, and `Haiku` as the models for the `AIC` provider. This overwrites any custom models (e.g., `mimo/mimo-v2.5-pro`, `xai/grok-composer-2.5-fast`) the user had manually configured.

## Workaround
- **Always reveal the API key** (click the ◉ button) before hitting "Save" in the UI.
- To preserve custom models, configure `.env` and `~/.config/opencode/opencode.jsonc` directly via CLI rather than using the Dashboard UI.

## Required Fix (Pending)
- `ConfigPage.tsx`: Modify the input component to separate visual masking (`type="password"`) from the actual underlying `value` state. Do not use ternary `***` literal for the `value` prop.
- `ConfigPage.tsx`: Prevent `handleSave` from hardcoding the `models` dictionary; it should merge or preserve existing model configurations.