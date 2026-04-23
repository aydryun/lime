<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Runtime and Tooling

This project uses Bun as its runtime. Do NOT use `npm`, `npx`, `yarn`,
or `node` commands. Always use `bun`.

For linting and formatting, this project uses Biome. The `package.json`
already contains the setup commands needed to lint the project, so do not run
Biome directly unless requested.
<!-- END:bun-biome-rules -->
