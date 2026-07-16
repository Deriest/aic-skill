# OpenCode Context and Output Policy

## Context Limit Policy (v3.1.5+)
- **No Role-Based Reduction**: All workers (Thinker, Crafter, Sprinter) receive 100% of the provider's default context window. Previous heuristic reductions (80%/60%/40%) were removed as they artificially constrained the workers.
- **Context Detection**: `detect-context.sh` attempts to detect the native model context. If undetectable, it falls back to a safe default (e.g., 256000).

## Output Token Policy (v3.1.5+)
- **Fixed Constant (32000)**: The `limit.output` value in `opencode.jsonc` is hardcoded to `32000` (OpenCode's internal default). 
- **No Percentage Calculation**: Output is no longer calculated as 8% of the context window, and the legacy 16384 cap was removed.
- **Resiliency**: Modern API gateways (9Router, Anthropic, Gemini) accept large `max_tokens` (like 32000) without throwing `400 Bad Request` and will silently truncate on their backend.

## OpenCode Config Pitfalls (`limit` object)
- **Mutually Required Tuple**: If the `limit` object is declared in `opencode.jsonc`, BOTH `context` and `output` MUST be defined. If one is missing, OpenCode crashes on startup (exit code 1) and fails to send the request.
- **Max Tokens Passthrough**: The value defined in `limit.output` is passed verbatim as `max_tokens` in the HTTP payload to the provider.