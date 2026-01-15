---
trigger: always_on
---

# Python

## Core Directive
Code lightweight. LLM generates boilerplate. Developer designs architecture. Limiting factor: instruction clarity + codebase structure, not LLM capability.

---

## 1. Context Management

**1.1 Single Source**
- Info exists once: context.md (module state), plan.md (architecture), tasks.md (sprint)
- Reference paths, never duplicate
- Symlink /src/module/context.md → /docs/context/module.md

**1.2 Minimal Transfer**
- Target: <100 tokens/task. Max: <300 tokens
- Format: `Modify /path/file.py:45-67. Add X. Use /path/util.py:fn()`
- Never paste code blocks

**1.3 Incremental**
- Build dependency-ordered: leaves first, work up tree
- One task = one testable outcome

**1.4 Update Immediately**
- Code change = context.md update in same commit
- Pre-commit hook checks this

---

## 2. Prompts

**2.1 Atomic Task**
```
Task: [single operation]
Context: /docs/context/X.md
Requirements: [specific, measurable]
Deliverables: tests + code + updated context.md
Success: [measurable criteria]
```

**2.2 Confidence**
- LLM states confidence %
- >90%: accept | 70-90%: review | <70%: reject/redesign

**2.3 Constraints**
Always specify: dependencies, compatibility, performance targets, file size

**2.4 Variations**
```
Provide 3 implementations:
1. Optimize: [dimension]
2. Optimize: [dimension]
3. Optimize: [dimension]
Include: trade-offs, benchmarks, LOC
```

---

## 3. Structure

**Limits**
- Implementation: 300 lines (exclude comments/docstrings)
- Tests: 500 lines
- If exceed: split or justify in context.md

**SOLID**
- One module = one responsibility
- Dependencies: high→low, never circular
- Public interface: minimal, explicit \_\_all\_\_
- Types: complete on every function

```python
# Correct
def fn(x: list[dict[str, Any]], y: float | None = None) -> dict[str, int]:
    """Docstring with Args, Returns, Raises, Examples."""
```

---

## 4. Testing

**TDD Workflow**
1. Write failing test
2. Request implementation
3. Verify pass
4. Refactor (stays green)

**Coverage**
- Minimum: 80% overall
- Per-module: in context.md
- Tests mirror src: `src/auth/login.py` → `tests/auth/test_login.py`

**Isolation**
- Independent tests, any order
- No shared state

**Naming**
```python
# Correct
def test_login_rejects_invalid_credentials(): ...

# Wrong
def test_login(): ...
```

---

## 5. Documentation

**Docstrings**
```python
def fn(arg: Type) -> Return:
    """One-line summary.
    
    Args:
        arg: Description
        
    Returns:
        Description
        
    Raises:
        ErrorType: When
        
    Examples:
        >>> fn(x)
        result
    """
```

**context.md**
- Updated within 24h of code change
- Sections: Purpose, Location, Public Interface, Dependencies, State (✅🚧⏳), Known Issues, Change Log

**Decisions**
- Record significant choices with rationale, alternatives, trade-offs

---

## 6. Errors

**Specific Exceptions**
```python
class DomainError(Exception): ...
class SpecificError(DomainError):
    def __init__(self, context):
        self.context = context
        super().__init__(f"Actionable message: {context}")
```

**Fail Fast**
- Validate inputs at entry, raise immediately
- Transient errors: retry with exponential backoff

---

## 7. Workflow

**Red-Green-Refactor**
1. RED: Write failing test
2. GREEN: Implement minimum
3. REFACTOR: Improve (tests stay green)

**Commits**
- After each passing task
- Message: what + why + metrics

**Before Task**
1. Read context.md
2. Check tasks.md dependencies
3. Review plan.md constraints

**After Task**
1. Update context.md
2. If incomplete: document in missing.md

---

## 8. Quality Gates

**Pre-commit** (all must pass)
```bash
mypy --strict src/
ruff check src/
pytest --cov=src --cov-fail-under=80
./scripts/check_file_size.sh
```

**CI/CD**
- Mirrors pre-commit
- Runs on push/PR

**Review Checklist**
- Logic correct, edge cases handled
- Tests exist, isolated, >80% coverage
- Docstrings complete
- context.md updated
- File <300 lines
- Types complete
- No circular deps

---

## Token Budget

**Per Module**
```
Module: 2,500 tokens
Dependencies: 1,200 tokens
Tests: 800 tokens
Total: 4,500 tokens
Warning: >8,000 (split module)
```

---

## File Structure

```
project/
├── docs/
│   ├── context/        # One per module
│   ├── plan.md         # Architecture
│   ├── tasks.md        # Sprint
│   └── missing.md      # Incomplete work
├── src/
│   └── module/
│       ├── context.md  # Symlink to docs/context/module.md
│       └── *.py
└── tests/
    └── module/
        └── test_*.py
```

---

## Quick Commands

**Task Request**
```markdown
Task: [operation]
Context: /docs/context/X.md
Modify: /path/file.py:lines
Add: [feature]
Use: /path/util.py:fn()
Success: [criteria]
Constraints: [limits]
```

**Bug Fix**
```markdown
Problem: [error]
File: /path:lines
Expected: [behavior]
Actual: [behavior]
Error: [traceback]
Fix + test to prevent regression
```

**Refactor**
```markdown
Target: /path/file.py:fn()
Issue: [problem]
Goal: [improvement]
Maintain: [tests pass, API stable]
```

---

## Anti-Patterns

❌ Paste code blocks → ✅ Reference paths
❌ "Fix bug" → ✅ Specific problem + location + expected
❌ Compound tasks → ✅ Atomic, one outcome
❌ Test after → ✅ Test first (TDD)
❌ Stale docs → ✅ Update with code change

---

## Metrics

Track:
- Tasks/day
- First-attempt success %
- Context size/task
- Coverage %
- context.md freshness (% updated <24h)
- LLM confidence vs correctness

---

## Emergency

**Wrong Code**
1. Stop, don't commit
2. Detailed bug report (problem, expected, actual, file:lines, error)
3. Request fix + regression test
4. If unfixed after 3 attempts: human + document in missing.md

**Context Too Large**
1. Measure tokens
2. If >8K: split module, extract helpers, reference not paste
3. Update context.md + plan.md
4. Verify tests pass

**Stale Docs**
1. Run `./scripts/check_context_freshness.sh`
2. Update context.md to match code
3. Note in CHANGELOG.md
4. Add automated check

---

## Templates

**context.md**
```markdown
# Module: name
Purpose: [one line]
Location: /path
Public Interface: [functions/classes]
Dependencies: Internal: [list], External: [list]
State: ✅ [done] 🚧 [progress] ⏳ [planned] ❌ [blocked]
Known Issues: [list]
Change Log: [date] - [changes]
```

**Task**
```markdown
Task: [atomic]
Context: /docs/context/X.md
Requirements:
- [specific]
Constraints:
- [limits]
Success:
- [ ] Tests pass
- [ ] Coverage >80%
- [ ] Types pass
- [ ] context.md updated
```

**missing.md**
```markdown
# Module: name
Task: [name]
Reason: [why incomplete]
Impact: High/Medium/Low
Workaround: [if exists]
Next: [action]
Owner: [who]
```

---

## Config

**mypy.ini**
```ini
[mypy]
python_version = 3.11
strict = True
```

**pyproject.toml**
```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
addopts = "--cov=src --cov-fail-under=80"
```

**.pre-commit-config.yaml**
```yaml
repos:
  - repo: local
    hooks:
      - id: mypy
        entry: mypy src/
      - id: ruff
        entry: ruff check src/
      - id: pytest
        entry: pytest
```

---

## Confidence Thresholds

```
95-100%: 98% correct → Auto-accept
85-94%: 89% correct → Review
75-84%: 72% correct → Careful review
<75%: 45% correct → Reject/redesign
```

Calibrate thresholds based on your LLM's accuracy.

---

## Success Criteria

- Context <300 tokens/task
- Coverage >80%
- context.md freshness >90% (<24h)
- First-attempt success >70%
- Zero doc drift

---

## Human Judgment Required

- Architecture decisions
- Security-critical review
- Performance optimization strategy
- Ambiguous requirements
- LLM confidence <70%