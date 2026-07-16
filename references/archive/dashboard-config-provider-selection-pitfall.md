# Dashboard Config Provider Selection & API Key Pitfalls

## Provider Selection (Multiple Custom Providers)
**Symptom:** After configuring the provider (e.g., `AIC`) and saving in the Dashboard UI, the `baseURL` and `providerKey` revert to a different provider (e.g., `INTERCEPT` / `127.0.0.1`) upon dashboard restart or page refresh.
**Root Cause:** In `ConfigPage.tsx`, the `useEffect` config loader uses `Object.keys(customProviders).find(k => k !== 'openai' && k !== 'anthropic')`. This returns the *first* custom provider it encounters in `opencode.jsonc`. If a legacy or interceptor provider is at the top of the file, it will always be selected over the intended one.
**Fix:** Manually edit `~/.config/opencode/opencode.jsonc` via CLI to remove the conflicting/unused provider blocks (e.g., delete the `INTERCEPT` block) so only the intended provider remains.

## API Key Masking Save Bug
**Symptom:** Saving the configuration from the Dashboard UI results in "Invalid Credentials" or authentication failures. The `opencode.jsonc` file ends up with `"apiKey": "***"`.
**Root Cause:** The `API KEY` input in `ConfigPage.tsx` is masked and set to `readOnly={!showApiKey}` with a default display value of `***`. If the user hits "Save" without first clicking the reveal (`◎`) button to expose the actual key text, the literal string `***` is captured and saved.
**Fix/Workaround:** The user must explicitly click the eye/reveal button (`◎`) next to the API Key field to show the plain text key *before* clicking "Save". Alternatively, configure the API Key directly in `.env` and `opencode.jsonc` via CLI.