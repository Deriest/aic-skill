# Dashboard Config UI Pitfalls

## 1. API Key Overwritten with `***`
**Symptom:** After saving configuration via the Dashboard UI (`ConfigPage.tsx`), API requests fail with authentication errors (e.g., "Invalid Credentials"). Checking `opencode.jsonc` shows `"apiKey": "***"`.
**Root Cause:** The API Key input field is `readOnly` by default when the text is masked (dots/asterisks). If the user edits the config and clicks SAVE *without* clicking the reveal eye icon (`◎`) to unmask the text, the form submits the literal masked string `***`.
**Fix/Workaround:** Always click the reveal icon (`◎`) so the actual key is visible before clicking SAVE. Alternatively, edit `opencode.jsonc` and `.env` directly via CLI.

## 2. BaseURL and Provider reset to `INTERCEPT` / `127.0.0.1`
**Symptom:** Dashboard keeps reverting to `baseURL: 127.0.0.1:9991` and `provider: INTERCEPT`, ignoring the saved `AIC` proxy.
**Root Cause:** `ConfigPage.tsx` determines the active provider by selecting the *first* custom key it finds in `opencode.jsonc` (excluding `openai` and `anthropic`). If an old `INTERCEPT` block is positioned at the top of the JSON file, the dashboard will always select it over `AIC` on page load.
**Fix:** Remove the `INTERCEPT` provider block entirely from `~/.config/opencode/opencode.jsonc` so that `AIC` becomes the first and only custom provider.