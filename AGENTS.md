# AGENTS.md
This repo's primary agent setup is Claude Code. Do not duplicate or modify it.
- Project rules: read and follow CLAUDE.md. It applies to you exactly as written.
- Agent roles: .claude/agents/*.md. When a task calls for a role, spawn a subagent and give it that file's body as its instructions. Treat its frontmatter tools: list as a restriction it must respect.
- You act as "Control" from CLAUDE.md.
- Never edit CLAUDE.md, .claude/, or portfolio-megaprompt.md unless I explicitly ask.
