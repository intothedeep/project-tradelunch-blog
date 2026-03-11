# **CODE_CONVENTION.md**

## **1. Purpose**

This document defines code conventions to ensure **high quality, maintainable, testable, secure code** across all services and modules:

- Single Responsibility
- Functional programming style (no side effects, predictable)
- Modular design
- Test-First Development (TDD)
- Principle of Least Privilege / Least Exposure

---

## **2. Core Principles**

### **2.1 Single Responsibility**

Each function, method, class, or module must have **one and only one responsibility** and reason to change.

Functions that do more than one thing should be refactored into smaller units.

**Rules:**

- Function names reflect one action.
- Avoid multi-purpose arguments (e.g., boolean flags to switch behavior).
- Modules encapsulate a single domain concern.

---

### **2.2 Functional Programming Style**

Functions should be written in a **pure and predictable** style:

- Input → Output only.
- No modification of external state.
- No side effects (I/O, global variables, mutable state) within pure logic.

Side effects must be **isolated** in dedicated I/O boundary layers (API adapters, DB repository functions).

---

### **2.3 Test-First Development (TDD)**

Tests must be written **before** production code:

1. Write failing unit test.
2. Write minimal code to pass test.
3. Refactor both test and implementation.

Tests define correct behavior and drive design.

**Test Rules:**

- One assertion per test scenario where possible.
- Tests must be fast, isolated, and repeatable.
- Use mocks/stubs only on external dependencies.

---

### **2.4 Least Privilege and Least Exposure**

Code must follow security and exposure minimization principles:

- Limit visibility: functions and variables should be private/internal unless absolutely required.
- Modules should expose only required APIs.
- API and service permissions should be minimal — only what is necessary for functionality.
- Reduce attack surface: avoid broad permissions, external access paths.

---

## **3. Files and Module Boundaries**

### **3.1 File Size and Scope**

- Each file **must not exceed 400 lines of code**.
- Files represent a cohesive, narrow part of a system (single domain responsibility).

This improves readability and maintainability.

---

### **3.2 Modular Design**

- Modules must encapsulate related functions.
- Each module exports minimal public interface.
- Shared utilities belong to packages/\* and must follow the same conventions.

---

## **4. Naming Conventions**

- Functions: actions with intent (calculateYield, fetchRates).
- Modules: represent domain contexts (exchangeRates, interestRates).
- Types and interfaces must be descriptive and language-specific.

---

## **5. Coding Style Rules**

### **5.1 Function Structure**

- Prefer small functions; no deep nesting.
- Keep argument count low (ideally 0–2).
- Avoid public methods with side effects.

Clean code guidelines recommend functions that focus on one task and avoid side effects.

---

### **5.2 Visibility and Exposure**

- Prefer **private/internal** visibility over public.
- Only expose API surface needed for integration.
- For backend services, avoid exposing sensitive parameters externally.

Least privilege applies to code visibility as well as runtime permissions.

---

## **6. Error Handling**

- Handle errors close to the boundary.
- Business logic must not mix with transport or parsing errors.
- Use typed error constructs where available.

---

## **7. Testing Policy**

Testing categories:

- **Unit tests:** cover pure logic.
- **Integration tests:** validate system boundaries.
- **Contract tests:** verify API interfaces.

All production code must be associated with tests that validate behavior.

---

## **8. Review and Compliance**

- Enforce conventions via CI: lint, type check, test suite run.
- Code reviews enforce single responsibility, side-effect isolation, and least privilege.

---

## **9. Key Checklist**

Before merging:

- Single responsibility confirmed
- Pure functions where applicable
- Tests written first for behavior
- Visibility minimized
- File under 400 lines
- Least privilege and exposure enforced

---

This document codifies **clean coding and security principles** applied across languages (Python, TypeScript) and architectures.
