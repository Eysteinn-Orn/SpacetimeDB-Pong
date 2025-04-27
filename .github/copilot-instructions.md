<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## General Instructions


- When writing Rust code for the SpacetimeDB module (`server/pong_module`), always reference the latest documentation at https://spacetimedb.com/docs/sdks/rust.
- When writing Rust code for the SpacetimeDB module (`server/pong_module`), always reference the code examples and explanations provided in `server/llms.md`.
- When writing client-side TypeScript code (`client/`), reference the latest TypeScript SpacetimeDB SDKs found at https://spacetimedb.com/docs/sdks/typescript.
- When using Three.js in the client-side code, use the latest version and reference the latest documentation found at https://threejs.org/docs/.

## Commit Messages

When generating messages for commits, use the conventional commit format. Use the following commit message types:

- `feat:` (new feature)
- `fix:` (bug fix)
- `chore:` (maintenance, e.g., dependency updates, build process changes)
- `docs:` (documentation changes)
- `style:` (code style changes, formatting)
- `refactor:` (code refactoring without changing functionality)
- `perf:` (performance improvements)
- `test:` (adding or modifying tests)

Example: `feat: add ball collision detection` or `fix: correct paddle movement clamping`