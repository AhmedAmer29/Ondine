# Contributing to PianoFlow

Thank you for your interest in contributing! This document outlines the process and guidelines for contributing to PianoFlow.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/pianoflow.git
   cd pianoflow
   ```
3. **Add upstream remote** to stay in sync:
   ```bash
   git remote add upstream https://github.com/original-repo/pianoflow.git
   ```
4. **Install dependencies**:
   ```bash
   npm install
   ```

## Development Workflow

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

Use clear, descriptive branch names:
- `feature/new-export-format`
- `fix/midi-parsing-crash`
- `docs/update-readme`
- `perf/optimize-renderer`

### Writing Code

**Code Style:**
- Use TypeScript strict mode
- Follow naming conventions: `camelCase` for functions/variables, `PascalCase` for components/classes
- Add JSDoc comments for public functions and complex logic
- Keep functions focused and under 100 lines when possible

**Testing:**
- Run linter before committing:
  ```bash
  npm run lint
  ```
- Test your changes:
  ```bash
  npm run tauri dev
  ```

**Commit Messages:**
- Write clear, descriptive commits:
  ```
  feat: add early-finish button to video export
  
  Allows users to stop recording mid-export and save what's been
  rendered so far, instead of forcing a complete run.
  ```
- Use lowercase and start with a verb: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### Building & Testing

Before submitting a PR, verify everything builds:

```bash
npm run lint          # Linter check
npm run build         # TypeScript + Vite build
npm run tauri build   # Full desktop app bundle
```

## Submitting a Pull Request

1. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a PR on GitHub** with:
   - Clear title describing the change
   - Description of what and why (reference issues if applicable)
   - Screenshots/GIFs if UI changes
   - Any breaking changes clearly highlighted

3. **Address feedback** from reviewers

4. **Ensure CI passes** (linting, type checks)

## Contribution Types

### Bug Reports
If you find a bug, please [open an issue](https://github.com/your-username/pianoflow/issues) with:
- Clear reproduction steps
- Expected vs actual behavior
- OS and browser/app version
- Screenshots/videos if applicable
- Relevant console errors (F12)

### Feature Requests
For new features:
- Check existing issues to avoid duplicates
- Describe the use case and why it's useful
- Sketch UI or behavior if relevant
- Be open to discussion and alternative approaches

### Documentation
- Typo fixes welcome
- Improve clarity or add examples
- Keep architecture docs in sync with code changes

## Areas That Welcome Contributions

- **Video export** — Different codecs, formats, or optimization
- **Practice mode** — Better scoring, visual feedback, difficulty levels
- **MIDI support** — Chord detection, hand assignment, notation
- **Performance** — Rendering optimization, memory usage
- **Accessibility** — Keyboard shortcuts, screen reader support, high contrast modes
- **Translations** — Localization support

## Code Review

All PRs require review before merging. During review:
- Reviewers provide constructive feedback
- Be open to suggestions and questions
- Iterate collaboratively
- Questions are OK—this is a learning opportunity

## License

By contributing, you agree that your work will be licensed under the MIT License, consistent with the rest of the project.

## Questions?

- Check the [README](README.md) and [Architecture](README.md#architecture) sections
- Look at existing code for patterns and style
- Open a [Discussion](https://github.com/your-username/pianoflow/discussions) for design questions
- Join our Discord for real-time chat (link in README)

---

Happy contributing! 🎹✨
