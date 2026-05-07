# Claude Code Agent Rules

## 0. Purpose

This repository is operated by an AI-assisted engineering workflow.
All code must follow strict principles for correctness, simplicity, and maintainability.

---

## 1. Core Engineering Principles

### 1.1 Correctness First

- Do not guess or hallucinate implementations
- If unclear → stop or request clarification
- Prefer explicit behavior over implicit assumptions

---

### 1.2 Simplicity First (KISS + YAGNI)

- Implement the simplest working solution first
- Do not introduce abstraction without proven need
- Avoid premature optimization or design complexity

---

## 2. Architecture Rules

### 2.1 Single Responsibility Principle (SRP)

- Every module/function/class must have exactly one responsibility
- If multiple responsibilities exist → split immediately

---

### 2.2 Functional Core Preference

- Business logic must be implemented as pure functions
- Side effects must be isolated at system boundaries only

Rules:

- deterministic input → output
- no hidden state mutation
- no global state dependency

---

### 2.3 Least Privilege Principle

- Each component should access only what it needs
- DB/network/file I/O must be isolated in infrastructure layer
- Domain logic must not perform side effects

---

### 2.4 Minimal Exposure Principle

- Public APIs must be minimal
- Default visibility: internal/private
- Only expose when required for composition

---

## 3. Functional Programming Rules

- Prefer pure functions
- Prefer composition over inheritance
- Avoid mutation; use immutable transformations
- Build logic via pipelines:
  small functions → composition → system behavior

---

## 4. OOP Rules (Use Only When Necessary)

Allowed only for:

- polymorphism requirements
- stateful domain models
- plugin/extensibility systems

Rules:

- composition > inheritance
- dependency injection required
- avoid god classes
- avoid deep inheritance trees

---

## 5. Codebase Structure

### 5.1 Module Size Rule

- keep modules small and cohesive
- split when multiple responsibilities appear
- avoid large files (>300 lines recommended limit)

---

### 5.2 Layering Model

Strict dependency direction:

UI/API  
→ Service  
→ Domain (pure logic)  
→ Infrastructure (DB/network)

No reverse dependencies allowed.

---

### 5.3 Monorepo Rules (if applicable)

Structure:

- apps/ → entrypoints
- packages/ → business logic
- libs/ → utilities

Dependency rule:
apps → packages → libs (DAG only)

No circular dependencies allowed.

---

## 6. Schema Rules

- protobuf is the single source of truth
- generated code must NOT be manually modified
- breaking changes require versioning

---

## 7. Database Rules

- prefer raw SQL for clarity and performance-critical paths
- ORM only for non-critical CRUD
- repository layer must be thin abstraction
- transaction boundaries defined in service layer only

---

## 8. Configuration Rules

- all config must be environment-based (.env)
- no hardcoded secrets or environment values
- config precedence:
  1. environment variables
  2. config files
  3. defaults

---

## 9. Tooling Standards

### Python (if used)

- uv for dependency management
- pyproject.toml as single source of truth
- isolated .venv per project

Rules:

- no global pip installs
- reproducible builds required

---

## 10. Naming Conventions

- functions: verb-based (create, calculate, fetch)
- data: noun-based (user, order, session)
- boolean: is/has/can prefix
- avoid generic names (data, temp, foo)

---

## 11. Documentation Rules

Each module must include top-level comment:

- purpose
- invariants
- constraints
- side effects (if any)

Comments must explain WHY, not WHAT.

---

## 12. Design Pattern Policy

Allowed only when justified:

- Factory → complex object creation
- Strategy → algorithm variation
- Adapter → integration layer
- Repository → data access abstraction

Forbidden:

- unnecessary abstraction
- premature pattern usage
- over-engineered DI graphs

---

## 13. Workflow Rules

### 13.1 Planning Required

All work must follow:

- 00.plan.md → architecture design
- 01.status.md → progress tracking
- 02.tasks.md → execution breakdown

---

### 13.2 Execution Discipline

- atomic commits only
- small incremental changes
- rollback-safe diffs

---

## 14. Quality Gates

Before completion:

- lint must pass
- typecheck must pass
- tests must pass (logic layer)
- no dead code
- no unused exports

---

## 15. Meta Rule (Priority Order)

1. correctness
2. simplicity
3. maintainability
4. explicitness
5. performance
6. abstraction quality

---

## 16. Failure Handling

If complexity increases or boundaries are unclear:

- stop execution
- reduce scope
- simplify structure
- re-apply SRP

---

## 17. Naming

- protobuf: weatherbot[Name][Api|Ws][Hist]
- weatherbot*[name]*[api|ws]\_hist
- folder
  - use-api
  - use-ws
  - use-poll

- files
  - api: [method]-[name].api[.batch]ts
  - parsing: _.parsing.[api|ws]._
  - ws: _.ws._
  - mock: mock.[api|ws].[source: weatherbot].[name].json

---

## 18. every agent shold follow

1. Do one small task at a time
2. Start with simplest working version
3. No assumptions, only explicit requirements
4. If unclear, stop and request missing info
5. Every step must produce a working output
6. Verify result before moving next step
7. Keep changes minimal and isolated
8. Avoid redesign unless necessary
9. Fail fast, fix immediately, continue incrementally

## rm -rf

1. update folder or file name with x\_\* so an user can delete manually.

## End of Rules
