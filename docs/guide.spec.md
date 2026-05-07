# **GUIDE.SPEC.md**

## **1. Monorepo Architecture**

### **1.1 Turborepo + pnpm Workspaces**

- Use **Turborepo** to manage a monorepo with multiple apps and shared packages.
  Turborepo enables cross‑workspace caching, parallel execution, and consistent scripts.
- Use **pnpm Workspaces** for dependency management across workspaces.

Root package.json snippet:

```
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }
}
```

- Each workspace (app or package) has its own package.json.
- Root pnpm-lock.yaml ensures consistent dependency versions across workspaces.

---

## **2. Directory Layout**

```
root/
├── apps/
│   ├── web-dashboard/       # Next.js frontend
│   ├── api-server/          # Python FastAPI backend
│   └── data-pipeline/       # Python data pipelines
├── packages/
│   ├── ui/                  # shared React components (shadcn/ui + Tailwind)
│   ├── types/               # shared TS types
│   ├── config/              # shared configs (ESLint, Tailwind, etc.)
│   └── jest-config/         # shared Jest config
├── .husky/
├── turbo.json
├── package.json
├── pnpm-lock.yaml
├── README.md
└── GUIDE.SPEC.md
```

---

## **3. Frontend: Next.js + TypeScript + Tailwind + Shadcn UI**

### **3.1 Language & Tools**

- Framework: **Next.js** with **TypeScript**.
- UI: **shadcn/ui** built on Tailwind CSS for atomic utility classes and reusable components.
- Styles: **Tailwind CSS**, configured to work across shared UI packages.

### **3.2 Tailwind Configuration**

Shared Tailwind config in packages/config/tailwind.config.js and extend in apps:

```
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: { extend: {} },
  plugins: []
}
```

Shadcn usage: install components via CLI and store them in packages/ui.

---

## **4. Backend & Data Pipeline (Python)**

### **4.1 Python Package & Environment Management:**

### **uv**

- Use **uv** as the unified Python package manager and environment manager.
- uv replaces traditional pip + venv + pyenv workflows with a faster, reproducible tool.

---

## **5. uv Workflow & Config**

### **5.1 Initialize Project with uv**

```
uv init
```

This creates a pyproject.toml and .venv automatically.

### **5.2 Add Dependencies**

```
uv add fastapi sqlalchemy pytest uv
```

- Dependencies will be added and locked in uv.lock.

### **5.3 Sync Environment**

```
uv sync
```

Installs all dependencies from the lockfile.

### **5.4 Run Scripts**

```
uv run python app.py
```

Runs scripts using the correct environment automatically.

---

## **6. Database: PostgreSQL**

- Primary database: **PostgreSQL**.
- Use connection pooling and asynchronous drivers (e.g., asyncpg).
- Schema migrations with **Alembic**.

Store database credentials in environment variables. Do not hardcode secrets.

---

## **7. Testing Strategy**

### **7.1 Python: pytest**

- Use **pytest** for backend unit and integration tests.
- Group tests under tests/.
- Use fixtures to isolate tests and manage database state.

---

### **7.2 JavaScript/TypeScript: Jest**

- Use **Jest** with **React Testing Library** for frontend tests.
- Shared Jest config in packages/jest-config.
- Support monorepo structure by configuring projects in root Jest config.

Example monorepo Jest config:

```
module.exports = {
  projects: [
    '<rootDir>/packages/jest-config/jest.config.js',
    '<rootDir>/apps/web-dashboard/jest.config.js'
  ]
}
```

---

## **8. Git Hooks Automation**

### **8.1 Husky + lint‑staged**

- Setup **Husky** to manage Git hooks.
- Use **lint‑staged** to run linting and formatting on staged files.

Example lint-staged config:

```
"lint-staged": {
  "*.{js,ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "git add"
  ]
}
```

Add pre‑commit hook:

```
npx husky add .husky/pre-commit "npx lint-staged"
```

---

## **9. Security: Least Privilege & Least Exposure**

- Only expose minimal API surface externally.
- Backend services should enforce permission checks.
- Share internal functionality only via controlled interfaces.
- Database roles should have restricted access.

---

## **10. CI/CD & Quality**

- Run lint, type checks, and tests in CI (lint, test).
- Run uv sync before tests to ensure environment consistency.
- Use caching for Turborepo pipeline.

---

## **11. Best Practices**

- Avoid circular dependencies in monorepo.
- Use shared configs (ESLint, Tailwind, Jest).
- Use lockfiles (uv.lock, pnpm-lock.yaml) for reproducible installs.

---

## **12. Environment Variables**

- Use .env files for local environment variables.
- Do not commit secrets.
- Use tools like direnv or environment config in CI.

---

## **13. Scripts Standardization**

Centralize scripts in root package.json and specific workspace scripts. Provide consistent commands:

```
pnpm dev:web
pnpm dev:api
pnpm build
pnpm test
```

---

## **Reference Notes**

- Turborepo supports parallel builds and caching across workspaces.
- uv provides fast installation, virtual environment handling, dependency patches, and reproducible lockfiles.

---

이 문서는 터보레포 기반 모노레포에서 **프론트엔드, 백엔드, 데이터 파이프라인, 테스트, 보안, 자동화**까지 종합적으로 다루는 **전체 스펙 가이드**입니다. 예정된 프로젝트 구조와 개발 방식에 맞춰 직접 참고시킬 수 있도록 정리되어 있습니다.

## **### 14. Shared Model Package Using Protocol Buffers (Protobuf)**

프로젝트 전반에서 **데이터 구조를 프로토콜 버퍼 정의로 공유**하면 다음 장점이 있습니다:

- **타입 안정성**: Python, TS 모두 동일 IDL.(Interface Definition Language)로부터 코드 생성
- **언어 중립성**: 동일 메시지를 여러 언어에서 사용 가능
- **버전 관리**: 필드 추가/삭제가 backward‑compatible 조건에서 안정적

---

### **14.1 Protobuf 정의 위치**

공통 protobuf 정의를 별도의 패키지 또는 워크스페이스로 관리합니다.

```
root/packages/proto/
  ├── models/
  │   └── user.proto
  └── protos/           # 상황에 따라 subdir
```

공통 스키마는 이곳에만 존재하고 **각 서비스는 이 파일을 컴파일하여 언어별 코드 생성**을 수행합니다.

---

### **14.2 Protobuf 메시지 예시**

```
syntax = "proto3";

package example;

message User {
  string id = 1;
  string name = 2;
  int32 age = 3;
}
```

공통 패키지를 관리하면 **타입 소스 오브 트루스(Single Source of Truth)**가 됩니다.

---

## **14.3 TypeScript 코드 생성**

Node.js/Next.js에서 Protobuf 타입을 생성할 때는 다음 도구를 활용할 수 있습니다:

### **ts-proto**

- .proto → **TypeScript 의존성 없는 타입 + encode/decode 함수** 생성
- 인터페이스 기반 타입 및 메시지 직렬화 함수 제공

설치:

```
pnpm add -D ts-proto @bufbuild/protobuf
```

Codegen 예시:

```
protoc \
  --plugin=node_modules/.bin/protoc-gen-ts_proto \
  --ts_proto_out=./generated/ \
  -I ./packages/proto \
  packages/proto/models/user.proto
```

생성 후:

```
import { User } from "@/generated/models/user";

const message: User = { id: "1", name: "Alice", age: 30 };
const bytes = User.encode(message).finish();
const decoded = User.decode(bytes);
```

---

### **protobufjs (대안)**

- 별도 컴파일 없이 런타임 로딩 가능
- 가볍지만 타입 안정성은 ts-proto보다 낮을 수 있음

설치:

```
pnpm add protobufjs
```

사용 예시:

```
import protobuf from "protobufjs";
const root = await protobuf.load("user.proto");
const User = root.lookupType("example.User");
```

---

## **14.4 Python 코드 생성**

Python은 기본 protoc 플러그인을 사용하여 생성합니다:

```
pip install protobuf
protoc --python_out=./generated/ -I ./packages/proto packages/proto/models/user.proto
```

생성된 코드 사용:

```
from generated.models import user_pb2

user = user_pb2.User(id="1", name="Alice", age=30)
data = user.SerializeToString()
decoded = user_pb2.User.FromString(data)
```

Python에서 직렬화한 바이트를 TS 쪽 User.decode로 읽을 수 있고, 반대로도 가능합니다.

---

## **14.5 Build & Scripts 통합**

### **Monorepo 빌드 스크립트**

각 앱/서비스에서 공통 protobuf를 컴파일하도록 스크립트를 추가합니다:

### **package.json 예시**

```
"scripts": {
  "proto:gen:ts": "protoc -I packages/proto --ts_proto_out=generated/ packages/proto/**/*.proto",
  "proto:gen:py": "protoc -I packages/proto --python_out=./api-server/src/generated/ packages/proto/**/*.proto",
  "proto:gen": "pnpm proto:gen:ts && pnpm proto:gen:py"
}
```

Turborepo 파이프라인에 포함시켜 **proto:gen** 작업을 종속으로 설정할 수 있습니다.

---

## **14.6 Proto 파일 관리 규칙**

- .proto 파일은 **공통 패키지 내에서만 관리** (중복 방지, 변경 추적 용이)
- 필드 추가 시 **proto3 optional 사용 또는 default 값 전략**을 고려
- 패키지 경로와 import 상대 경로 명확히 설정
- 코드 생성된 결과물은 소스 제어에 넣거나 빌드 타겟으로 관리

---

## **14.7 공유 모델 활용 구조**

```
root/
├── packages/
│   ├── proto/              # Protobuf definitions
│   ├── types/              # Could contain other shared TS types
├── apps/
│   ├── web-dashboard/
│   │   └── generated/      # TS from proto
│   ├── api-server/
│   │   └── generated/      # Python from proto
```

공통 proto 정의는 **패키지로서 설치 및 참조** 가능하며, 필요시 git submodule로도 관리할 수 있습니다.

---

## **14.8 Summary**

이 방법은 다음 장점을 가지고 있습니다:

- 단 한 곳에서 정의한 **.proto → 언어별 코드 생성으로 자동 타입 동기화**
- Python ↔ TypeScript 상호 직렬화/역직렬화 가능
- 코드 생성 기반이므로 런타임 타입 불일치 위험 제거

---

위 내용은 **Protobuf 기반 모델 공유 워크플로우** 가이드로, Python 서비스 및 TypeScript 기반 프론트엔드/서버가 동일 모델 정의를 중심으로 **강한 타입과 데이터 일관성**을 유지할 수 있는 방법입니다.
