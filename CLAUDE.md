# CLAUDE.md

This file provides guidance for AI assistants working with this repository.

## Repository

- **Name**: -0307
- **Remote**: `youschi0418/-0307`

## Project Status

This is a newly initialized repository. No source code, build system, or dependencies have been added yet.

## Development Workflow

### Git Conventions

- **Branch naming**: Feature branches use the `claude/` prefix
- **Commit messages**: Use clear, descriptive messages summarizing the change
- **Push**: Always use `git push -u origin <branch-name>`

### Launching Claude via cmux

This repo is set up for [craigsc/cmux](https://github.com/craigsc/cmux), a tmux-based launcher that pairs Claude Code with a git worktree per branch.

Install once:

```bash
curl -fsSL https://github.com/craigsc/cmux/releases/latest/download/install.sh | sh
```

Then from the repo root:

```bash
cmux new <branch>     # create worktree under .worktrees/<branch>/ and launch Claude
cmux start <branch>   # resume an existing worktree
cmux ls               # list active worktrees
cmux merge [branch]   # merge the worktree branch back
cmux rm [branch]      # remove worktree and branch
```

Project-specific initialization lives in `.cmux/setup` (runs on `cmux new`). `.worktrees/` is gitignored.

### Getting Started

When adding code to this repository, update this CLAUDE.md with:

1. **Tech stack and dependencies** — languages, frameworks, package manager
2. **Build commands** — how to build, test, lint, and format
3. **Project structure** — directory layout and key files
4. **Code conventions** — naming, patterns, and style rules
5. **Testing** — how to run tests, what framework is used, coverage requirements
6. **CI/CD** — pipeline configuration and required checks
