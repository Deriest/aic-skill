# Architecture Plan: ConfigPage.tsx Refactor

## Target File
`dashboard/src/pages/ConfigPage.tsx`

## Requirements (from PM)
- R1: API Key masking (first4****last4) with eye toggle
- R2: BaseURL single source of truth (opencode.jsonc)
- R3: Consistent form styling, replace raw KEY=VALUE rows

## Design Decisions (from Architect)

### 1. API Key Masking
- **State**: Add `showApiKey: boolean` (default `false`)
- **Display**: When masked, show `apiKey.slice(0,4) + '****' + apiKey.slice(-4)`
- **Input**: Use `type="text"` with conditional value (masked string vs full key)
- **Toggle**: Eye icon button toggles `showApiKey`
- **Validation**: Full key stored in state; masked version only for display

### 2. BaseURL Single Source
- **Read**: On load, read `provider.options.baseURL` from opencode.jsonc
- **Write**: On save, write to BOTH:
  - `opencode.jsonc` → `provider[providerKey].options.baseURL`
  - `.env` → `PROVIDER_BASE_URL={value}`
- **Remove**: Any separate `PROVIDER_BASE_URL` input from .env panel

### 3. .env Panel Restructure
Replace raw KEY=VALUE rows with structured inputs:
```
PROVIDER_ID: text input (read-only, from opencode provider key)
MODEL_THINKER: dropdown (from fetched models)
MODEL_CRAFTER: dropdown (from fetched models)
MODEL_SPRINTER: dropdown (from fetched models)
AIC_CTX_*: hidden (auto-detected, not user-editable)
```

### 4. Consistent Styling
Both panels use identical:
- Label: `font-pixel text-px-xs text-aic-text-muted uppercase`
- Input: `bg-aic-bg-dark border border-aic-border/50 rounded p-2 text-aic-text-bright font-mono text-xs`
- Spacing: `gap-1.5` between label+input, `gap-4` between rows
- Panel wrapper: `bg-aic-bg-dark/50 p-4 border border-aic-border/30 rounded`

## Proposed Changes

### Phase 1: State Updates
1. Add `showApiKey` boolean state (default `false`)
2. Remove `PROVIDER_BASE_URL` from envVars parsing (it's now derived from opencode)
3. Add `PROVIDER_ID` to envVars (read-only, from providerKey)

### Phase 2: API Key Masking
1. Replace `<input type="password">` with `<input type="text">`
2. Conditionally render masked/full value based on `showApiKey`
3. Add eye icon button to toggle visibility

### Phase 3: BaseURL Unification
1. On load: Read `baseURL` from `opencodeObj.provider[providerKey].options.baseURL`
2. Remove `PROVIDER_BASE_URL` from .env panel
3. On save: Mirror `baseURL` to both opencode.jsonc and .env

### Phase 4: .env Panel Restructure
1. Remove raw KEY=VALUE rows
2. Add structured inputs:
   - `PROVIDER_ID` (read-only text)
   - `MODEL_THINKER` (dropdown)
   - `MODEL_CRAFTER` (dropdown)
   - `MODEL_SPRINTER` (dropdown)
3. Hide `AIC_CTX_*` fields (auto-detected, not editable)

### Phase 5: Styling Consistency
1. Apply consistent label/input styles to both panels
2. Ensure identical spacing and padding

## Verification
1. Load ConfigPage → verify API key shows masked by default
2. Click eye icon → verify full key revealed
3. Change BaseURL → verify saves to both opencode.jsonc and .env
4. Check .env panel → verify structured inputs, no raw KEY=VALUE
5. Compare styling → verify both panels match
