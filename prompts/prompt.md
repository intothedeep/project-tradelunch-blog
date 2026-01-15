# Optimized Prompts for AI-Assisted Coding

## Core System Prompt

```markdown
# AI Coding Assistant - System Behavior

## Mode: Technical Direct
- Provide facts, code, and analysis only
- No emotional language, motivation phrases, or conversational filler
- No unsolicited suggestions or questions
- State uncertainty explicitly with confidence levels
- Use formatting (tables, lists, code blocks) for clarity
- Emoji permitted in generated documentation only, not in responses

## Response Structure
1. Direct answer to query
2. Code/implementation (if applicable)
3. Confidence level (High/Medium/Low) if relevant
4. Trade-offs (if multiple approaches exist)
5. End immediately after delivering information

## Knowledge Boundaries
- If uncertain: State "Unknown: [specific gap]"
- If partially known: "Known: X. Unknown: Y. Confidence: Z%"
- Never fabricate or guess
- Reference documentation when possible

## Code Standards
- Functional programming preferred
- SOLID principles enforced
- Test-driven development (tests first)
- Declarative function names
- Maximum file size: 300 lines (excluding tests/comments)
- Docstrings required for all functions
- Type hints required (Python/TypeScript)

## Documentation Requirements
- Update context.md after every modification
- Track dependencies explicitly
- Document public interfaces
- Note known issues and future work

```

---

## Task Request Template

```markdown
# Task: [Single Atomic Operation]

## Objective
[One-sentence goal]

## Context
- Module: [name]
- Files: [paths]
- Current state: See `/path/to/context.md`
- Related modules: [list with dependencies]

## Requirements
### Functional
- [Specific behavior 1]
- [Specific behavior 2]

### Non-Functional
- Performance: [metric and target]
- Security: [specific concerns]
- Compatibility: [versions, platforms]

## Constraints
- No new dependencies without approval
- Maintain backward compatibility with [version]
- File size limit: 300 lines
- Language: [Python 3.11 / TypeScript 5.0 / etc.]

## Deliverables
- [ ] tests/test_[feature].py - Test suite
- [ ] src/[feature].py - Implementation
- [ ] context.md - Updated module context
- [ ] missing.md - Document incomplete tasks (if any)

## Success Criteria
- All tests pass
- Type checking passes
- No linting errors
- Performance: [specific metric met]
- Documentation complete

## Optional: Provide Variations
If multiple approaches exist, provide 3 variations:
1. Performance-optimized
2. Readability-focused
3. Minimal-dependency

For each variation include:
- Trade-offs
- When to use
- Estimated complexity

```

---

## Context.md Template

```markdown
# Module: [name]

## Purpose
[One-paragraph description of module responsibility]

## Location
`/path/to/module`

## Public Interface
```[language]
function_name(param: Type) -> ReturnType
  """Docstring summary"""

class ClassName:
  """Class purpose"""
  method_name(self, param: Type) -> ReturnType

```

## Dependencies

### Internal

- `/module/dependency1` - [why needed]
- `/module/dependency2` - [why needed]

### External

- `library==version` - [purpose]
- `package>=version` - [purpose]

## State

- ✅ Completed: [feature list]
- 🚧 In Progress: [feature list]
- ⏳ Planned: [feature list]
- ❌ Blocked: [issue description]

## Known Issues

1. [Issue description] - Impact: [High/Medium/Low]
2. [Issue description] - Workaround: [if exists]

## Configuration

```
key: value
option: setting

```

## Testing

- Test coverage: [percentage]
- Test location: `/tests/test_[module].py`
- Run tests: `[command]`

## Performance Notes

- Bottlenecks: [identified issues]
- Benchmarks: [metrics]
- Optimization opportunities: [list]

## Security Considerations

- Authentication: [method]
- Authorization: [approach]
- Data validation: [strategy]
- Known vulnerabilities: [CVE or description]

## Change Log

### [YYYY-MM-DD] - [Author]

- [Change description]
- [Change description]

### [YYYY-MM-DD] - [Author]

- [Change description]

```

---

## Plan.md Template

```markdown
# Project Plan: [Project Name]

## Objective
[2-3 sentence project goal]

## Architecture Overview

```

[ASCII diagram or description of system components]

```

## Modules
### Module 1: [Name]
- Purpose: [description]
- Dependencies: [list]
- Status: [Not Started/In Progress/Complete]
- Context: `docs/context/module1.md`

### Module 2: [Name]
- Purpose: [description]
- Dependencies: [list]
- Status: [Not Started/In Progress/Complete]
- Context: `docs/context/module2.md`

## Dependency Graph

```

module1 --> module3
module2 --> module3
module3 --> module4

```

## Development Phases
### Phase 1: Foundation
- [ ] Core data models
- [ ] Database schema
- [ ] Basic CRUD operations

### Phase 2: Business Logic
- [ ] [Feature 1]
- [ ] [Feature 2]

### Phase 3: Integration
- [ ] API endpoints
- [ ] Authentication
- [ ] Error handling

### Phase 4: Polish
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation

## Technology Stack
- Language: [Python 3.11]
- Framework: [FastAPI]
- Database: [PostgreSQL 15]
- Testing: [pytest]
- Type checking: [mypy]
- Linting: [ruff]

## File Structure

```

project/
├── docs/
│   ├── context/          # Module contexts
│   ├── plan.md           # This file
│   └── tasks.md          # Current sprint
├── src/
│   ├── module1/
│   │   ├── context.md    # Symlink to docs/context/module1.md
│   │   ├── **init**.py
│   │   └── core.py
│   └── module2/
├── tests/
│   ├── test_module1.py
│   └── test_module2.py
├── requirements.txt
└── README.md

```

## Constraints
- Maximum file size: 300 lines (excluding tests/comments)
- Test coverage minimum: 80%
- No circular dependencies
- All functions must have type hints
- All public functions must have docstrings

## Risk Assessment
### High Risk
- [Risk description] - Mitigation: [strategy]

### Medium Risk
- [Risk description] - Mitigation: [strategy]

### Low Risk
- [Risk description] - Monitoring: [approach]

```

---

## Tasks.md Template

```markdown
# Current Sprint Tasks

## Sprint Goal
[What we're trying to achieve this sprint]

## In Progress
### Task 1: [Name]
- **Assignee**: [Name/AI]
- **Module**: [module name]
- **Priority**: [High/Medium/Low]
- **Estimate**: [hours/points]
- **Blockers**: [none/description]
- **Context**: See `/docs/context/[module].md`
- **Subtasks**:
  - [ ] Write tests
  - [ ] Implement feature
  - [ ] Update context.md
  - [ ] Code review

## Backlog
### Task 2: [Name]
- **Module**: [module name]
- **Priority**: [High/Medium/Low]
- **Dependencies**: [Task IDs that must complete first]
- **Description**: [Brief explanation]

## Blocked
### Task 3: [Name]
- **Blocked by**: [Issue description]
- **Owner**: [Who's resolving blocker]
- **Resolution ETA**: [date]

## Completed This Sprint
- [x] Task 4: [Name] - Completed: [YYYY-MM-DD]
- [x] Task 5: [Name] - Completed: [YYYY-MM-DD]

## Testing Checklist
For each completed task:
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Manual testing completed
- [ ] Documentation updated
- [ ] context.md updated

```

---

## Missing.md Template

```markdown
# Missing Tasks/Features

## Module: [name]

### Incomplete Tasks
#### Task: [Name]
- **Reason**: [Why not completed]
- **Impact**: [High/Medium/Low]
- **Workaround**: [If exists]
- **Next Steps**: [What needs to happen]
- **Owner**: [Who should address this]

### Known Gaps
#### Gap: [Description]
- **Affected Components**: [list]
- **User Impact**: [description]
- **Priority**: [High/Medium/Low]
- **Estimated Effort**: [hours/days]

### Technical Debt
#### Debt: [Description]
- **Location**: `/path/to/code`
- **Problem**: [What's wrong]
- **Refactor Plan**: [How to fix]
- **Priority**: [High/Medium/Low]

### Future Enhancements
#### Enhancement: [Name]
- **Description**: [What it would do]
- **Value**: [Why it's useful]
- **Complexity**: [High/Medium/Low]
- **Dependencies**: [What's needed first]

```

---

## Code Review Prompt

```markdown
# Code Review Request

## Changes
- Files modified: [list]
- Lines changed: [+X -Y]
- Module: [name]

## Purpose
[Why these changes were made]

## Review Focus
- [ ] Correctness: Logic is sound
- [ ] Performance: No obvious bottlenecks
- [ ] Security: No vulnerabilities introduced
- [ ] Maintainability: Code is readable and well-structured
- [ ] Tests: Adequate coverage
- [ ] Documentation: Updated and accurate

## Specific Concerns
[Any areas you want reviewer to pay special attention to]

## Testing Performed
- [ ] Unit tests: [result]
- [ ] Integration tests: [result]
- [ ] Manual testing: [what was tested]
- [ ] Edge cases: [list tested scenarios]

## Context
See `/docs/context/[module].md` for module context

```

---

## Debugging Prompt

```markdown
# Debug Request

## Problem
[Specific error or unexpected behavior]

## Expected Behavior
[What should happen]

## Actual Behavior
[What is happening]

## Error Message

```

[Full error message with stack trace]

```

## Context
- File: `/path/to/file.py`
- Function: `function_name()`
- Lines: [range]
- Module context: `/docs/context/[module].md`

## Environment
- Language version: [Python 3.11]
- OS: [Linux/macOS/Windows]
- Dependencies: [relevant package versions]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## What I've Tried
- [Attempt 1] - Result: [outcome]
- [Attempt 2] - Result: [outcome]

## Request
[What you need: explanation, fix, or both]

```

---

## Refactoring Prompt

```markdown
# Refactor Request

## Target
- File: `/path/to/file.py`
- Function/Class: `name`
- Lines: [range]

## Current Issues
- [ ] Code smell: [description]
- [ ] Performance: [bottleneck]
- [ ] Maintainability: [what's hard to understand]
- [ ] Duplication: [where]

## Goals
- Improve: [specific aspect]
- Maintain: [backward compatibility/behavior]
- Constraints: [file size, performance requirements]

## Refactoring Approach
[Preferred strategy if you have one, or leave blank for suggestions]

## Tests
- Existing tests: `/tests/test_[name].py`
- All tests must pass post-refactor
- New tests needed: [if behavior changes]

## Success Criteria
- [ ] Code is more readable
- [ ] Performance is same or better
- [ ] All tests pass
- [ ] No new dependencies
- [ ] context.md updated

```

---

## Performance Optimization Prompt

```markdown
# Performance Optimization Request

## Problem
[Specific performance issue]

## Metrics
- Current: [X ms/ops per second/memory usage]
- Target: [Y ms/ops per second/memory usage]
- Acceptable: [threshold for "good enough"]

## Profiling Data

```

[Profiler output or benchmark results]

```

## Hotspots
- Function: `function_name()` - [X% of time]
- Line: [line number] - [Y% of time]

## Context
- File: `/path/to/file.py`
- Module: [name]
- Workload: [typical use case]

## Constraints
- Must maintain: [backward compatibility/correctness]
- Cannot change: [specific aspects]
- Memory limit: [if applicable]

## Request
Optimize for: [speed/memory/both]
Acceptable trade-offs: [readability vs performance/etc.]

```

---

## Documentation Generation Prompt

```markdown
# Generate Documentation

## Target
- Module: [name]
- Files: [list]

## Documentation Type
- [ ] API reference
- [ ] User guide
- [ ] Architecture overview
- [ ] Tutorial/examples

## Audience
- Technical level: [beginner/intermediate/advanced]
- Role: [developer/user/admin]

## Required Sections
1. Overview
2. Installation/Setup
3. Usage examples
4. API reference
5. Configuration
6. Troubleshooting
7. FAQ

## Format
- Output: [Markdown/reStructuredText/HTML]
- Style: [technical/conversational]
- Code examples: [include/minimal/extensive]

## Source
- Extract from: [code/docstrings/context.md]
- Manual content needed: [list areas requiring human input]

```

---

## Testing Strategy Prompt

```markdown
# Test Development Request

## Feature to Test
[Name and description]

## Test Types Needed
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance tests
- [ ] Security tests

## Test Cases
### Happy Path
1. [Scenario] - Expected: [result]
2. [Scenario] - Expected: [result]

### Edge Cases
1. [Scenario] - Expected: [result]
2. [Scenario] - Expected: [result]

### Error Cases
1. [Scenario] - Expected: [error type]
2. [Scenario] - Expected: [error type]

## Test Framework
- Language: [Python/TypeScript]
- Framework: [pytest/jest/etc.]
- Mocking: [unittest.mock/sinon/etc.]

## Coverage Target
- Minimum: [80%]
- Focus areas: [critical paths]

## Test Data
- Fixtures: [where they are/need to be created]
- Mocks: [what needs mocking]
- Database: [test DB setup requirements]

## Deliverables
- File: `/tests/test_[feature].py`
- Coverage report
- Updated context.md with test information

```

---

## Module Creation Prompt

```markdown
# Create New Module

## Module Name
[name]

## Purpose
[Single responsibility description]

## Location
`/src/[module_name]/`

## Public Interface
Define the following:
```[language]
# Functions
function_name(param: Type) -> ReturnType
  """What it does"""

# Classes
class ClassName:
  """Purpose"""

# Constants
CONSTANT_NAME: Type

```

## Dependencies

### Internal

- [module1] - [why needed]

### External

- [package==version] - [purpose]

## File Structure

```
[module_name]/
├── __init__.py          # Public interface
├── context.md           # Module context
├── core.py              # Main logic
├── utils.py             # Helpers (if needed)
└── types.py             # Type definitions (if needed)

```

## Tests

- Location: `/tests/test_[module_name]/`
- Coverage target: [80%]
- Test types: [unit/integration]

## Constraints

- File size: <300 lines per file
- No circular dependencies
- Must follow SOLID principles
- Type hints required
- Docstrings required

## Success Criteria

- [ ]  All files created
- [ ]  context.md complete
- [ ]  Tests written and passing
- [ ]  Type checking passes
- [ ]  plan.md updated with new module
- [ ]  Dependency graph updated

```

---

## Context Size Management

### Strategies to Minimize Context
1. **Reference, don't paste**
   ```markdown
   # Bad
   Here's the entire 500-line file:
   [paste code]

   # Good
   Modify function `process_data()` in `/src/data/processor.py` lines 145-180
   Current behavior: [description]
   Needed change: [description]

```

1. **Use context.md as single source of truth**
    
    ```markdown
    # Instead of explaining module state
    Current module state: See `/docs/context/auth.md`
    
    ```
    
2. **Incremental requests**
    
    ```markdown
    # Bad
    "Build entire authentication system"
    
    # Good
    Task 1: "Implement user model with password hashing"
    Task 2: "Add session management" (references Task 1 context)
    Task 3: "Implement login endpoint" (references Tasks 1-2 context)
    
    ```
    
3. **Leverage file structure**
    
    ```markdown
    # Project structure is documentation
    /src/auth/
      ├── context.md        # Read this first
      ├── models.py         # User, Session
      ├── handlers.py       # Login, logout
      └── validators.py     # Input validation
    
    # Request can be minimal
    "Add email validation to User model. See /src/auth/context.md"
    
    ```
    

---

## Anti-Patterns (Avoid These)

### ❌ Vague Requests

```markdown
"Make it better"
"Fix the bug"
"Optimize this"

```

### ✅ Specific Requests

```markdown
"Reduce response time from 200ms to <50ms"
"Fix IndexError in process_batch() when list is empty"
"Optimize database query to use index on user_id column"

```

---

### ❌ Over-specification

```markdown
"On line 47, change variable name from 'data' to 'user_data',
then on line 52 add a try-except block, then..."

```

### ✅ Goal-oriented

```markdown
"Improve error handling in data processing pipeline.
Requirements:
- Catch and log all exceptions
- Return meaningful error messages
- Don't crash on invalid input"

```

---

### ❌ Context Duplication

```markdown
[Pastes 1000 lines of code]
"Add logging here"

```

### ✅ Precise Reference

```markdown
"Add logging to /src/api/endpoints.py function `create_user()` (lines 78-95)
Log: user creation attempts, validation failures, database errors"

```

---

## Quick Reference: Prompt Patterns

### Pattern 1: Feature Development

```
Task: [Feature]
Context: /docs/context/[module].md
Requirements: [list]
Tests needed: [list]
Deliverable: Implementation + tests + updated context.md

```

### Pattern 2: Bug Fix

```
Problem: [Error description]
Location: /path/to/file.py:[lines]
Expected: [behavior]
Actual: [behavior]
Request: Fix + explanation + test to prevent regression

```

### Pattern 3: Code Review

```
Files changed: [list]
Purpose: [why]
Review for: [correctness/security/performance/maintainability]
Focus: [specific concerns]

```

### Pattern 4: Refactor

```
Target: /path/to/file.py:[function/class]
Issue: [code smell/performance/maintainability]
Goal: [improvement]
Constraint: [backward compatibility/tests must pass]

```

### Pattern 5: Documentation

```
Module: [name]
Type: [API/guide/tutorial]
Audience: [level]
Source: [code/docstrings/context.md]
Format: [Markdown/etc]

```

---

## Confidence Levels Guide

When AI responds with uncertainty, it should use these levels:

- **High Confidence (>90%)**: Standard factual response
- **Medium Confidence (60-90%)**: "Likely correct: [answer]. However: [caveat]"
- **Low Confidence (<60%)**: "Uncertain. Possible: [answer]. Recommend: [verification method]"
- **Unknown**: "Unknown: [specific gap]. Suggest: [how to find answer]"

---

## Workflow Example

### 1. Start New Feature

```bash
# Read current state
view /docs/context/auth.md
view /docs/plan.md
view /docs/tasks.md

# Request
Task: Implement password reset functionality
Module: auth
Context: /docs/context/auth.md
Requirements:
- Email token-based reset
- Token expires in 1 hour
- Rate limit: 3 attempts per hour
Deliverables: tests + implementation + updated context.md

```

### 2. AI Delivers

- `/tests/test_password_reset.py` - Test suite
- `/src/auth/password_reset.py` - Implementation
- Updated `/docs/context/auth.md` - New state

### 3. Review and Iterate

```markdown
Code review: /src/auth/password_reset.py
Focus: Security - token generation strength
Concern: Is token entropy sufficient?

```

### 4. Track Progress

```markdown
# Update tasks.md
- [x] Password reset - Completed: 2025-01-09

# Update missing.md if needed
Missing: Email template system
Impact: High - needed for production
Next: Create email module

```

---

## File Size Management

### When File Exceeds 300 Lines

**Option 1: Split by Responsibility**

```python
# Before: handlers.py (450 lines)
# After:
handlers/
├── __init__.py      # Public interface
├── user.py          # User handlers
├── auth.py          # Auth handlers
└── admin.py         # Admin handlers

```

**Option 2: Extract Helpers**

```python
# Before: processor.py (400 lines)
# After:
processor.py         # Main logic (200 lines)
validators.py        # Input validation (100 lines)
formatters.py        # Output formatting (100 lines)

```

**Option 3: Justify Exception**

```markdown
# In missing.md or context.md
File: /src/complex_algorithm.py
Size: 450 lines
Reason: Single cohesive algorithm, splitting would harm readability
Plan: Refactor in Phase 3 when requirements stabilize

```

---

## Summary: The 80/20 Rule

**20% of prompts handle 80% of coding tasks:**

1. **Feature Request**: Task + Context + Requirements + Deliverables
2. **Bug Fix**: Problem + Location + Expected vs Actual
3. **Code Review**: Changes + Purpose + Focus Areas
4. **Refactor**: Target + Issues + Goals
5. **Documentation**: Module + Type + Audience

**Keys to Success:**

- One task per prompt
- Reference files, don't paste
- Update context.md after every change
- Track incomplete work in missing.md
- Use plan.md and tasks.md to maintain big picture

**Context Management:**

- context.md = module state
- plan.md = project architecture
- tasks.md = current sprint
- missing.md = known gaps

**File Structure:**

```
project/
├── docs/
│   ├── context/       # One file per module
│   ├── plan.md
│   ├── tasks.md
│   └── missing.md
├── src/              # Implementation
└── tests/            # Tests mirror src/ structure

```