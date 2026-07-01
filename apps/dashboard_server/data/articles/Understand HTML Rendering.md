---
title: 'HTML: Understand Html Rendering Process'
date: 2025-04-13
tags:
    [
        html,
        browser,
        software,
        web,
        application,
        html,
        css,
        javascript,
        rendering,
        tree,
        CSSom,
        reflow,
        repaint,
        composite,
        layer,
        dom,
        DOMTree,
        rendering,
    ]
series: Web
draft: true
---

# HTML: Understand Html Rendering Process

_Posted on 2025-04-13_

[TOC]

---

좋습니다! 웹 브라우저의 **전체 렌더링 파이프라인**을 시각화와 함께 단계별로 명확하게 설명드릴게요.

이 흐름을 이해하면 DOM, Render Tree, Render Layer, Reflow, Repaint 등 많은 개념이 한 번에 정리됩니다.

---

**🌐 브라우저 렌더링 파이프라인**

```
HTML → DOM Tree
CSS → CSSOM Tree
DOM + CSSOM → Render Tree
↓
Layout (Reflow)
↓
Painting (Repaint)
↓
Compositing (합성)
↓
화면 출력
```

---

**🔍 각 단계 상세 설명**

**1. Parsing (HTML/CSS 해석)**

• HTML 파싱 → **DOM 트리 생성**

• CSS 파싱 → **CSSOM 트리 생성**

```
예: <div style="color: red;"> → DOM 노드 + 스타일 규칙 노드
```

---

**2. Render Tree 생성**

• DOM + CSSOM을 조합해서 시각적으로 보여줘야 할 요소만 포함하는 트리

• display: none은 제외됨

• 각 노드에는 스타일 정보(색상, 폰트 등)와 함께 시각적 특성이 포함됨

```
렌더링 대상 요소들만 모은 트리 구조
```

---

**3. Layout 단계 (Reflow)**

• Render Tree의 각 노드에 대해 **정확한 위치와 크기 계산**

• 예: 부모의 크기를 기준으로 자식 요소의 위치, 마진 등 계산

📛 이 단계가 비싸서 자주 일어나면 성능에 영향을 줌

→ 레이아웃 트래싱 도구에서 Reflow라고 표현됨

---

**4. Painting (Repaint)**

• 계산된 각 요소를 **픽셀로 그리기 시작**

• 배경색, 글자, 테두리 등을 Paint 명령으로 변환

```
"이 div는 빨간 배경에 검은 글자다" → 실제로 캔버스에 그리기
```

💡 이 과정에서 **Render Layer**가 생성되기도 함

→ transform, opacity, position: fixed 등은 **별도 레이어로 분리**

---

**5. Compositing (합성 단계)**

• 여러 레이어를 하나로 **조립하여 최종 화면 구성**

• GPU 또는 CPU를 통해 레이어들을 올바른 순서로 합성

```
Layer A (background) + Layer B (modal) → 최종 화면
```

GPU에서 하드웨어 가속되는 경우도 많아 애니메이션 성능과 밀접

---

**🎯 최적화와 관련된 개념 정리**

| **개념**       | **설명**                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| Reflow         | Layout 단계 재계산 (크기, 위치 변경 시 발생)                             |
| Repaint        | 색상, 배경만 바뀌어 다시 그려야 하는 경우                                |
| Composite Only | 레이어 합성만 다시 수행 (성능 좋음)                                      |
| Layer 승격     | 성능 최적화를 위해 요소를 독립 레이어로 분리 (transform, will-change 등) |

---

**✅ 시각적 요약 이미지 (텍스트로 표현)**

```
HTML        CSS
 |           |
 ↓           ↓
DOM Tree   CSSOM Tree
      \     /
       ↓   ↓
     Render Tree
          ↓
        Layout (크기/위치 계산)
          ↓
        Paint (픽셀로 변환)
          ↓
     Compositing (합성)
          ↓
       Final Output (화면에 렌더링)
```

---

필요하시면 이 전체 과정을 브라우저 개발자 도구(Chrome DevTools Performance 패널)로 **프로파일링**하는 방법도 알려드릴게요.

또는 특정 상황에서 **Reflow를 방지하고 최적화하는 방법**도 예제로 도와드릴 수 있어요.

어떤 걸 더 알고 싶으세요?

_Thanks for reading!_
[Back to top](#HTML:-Understand-Html-Rendering-Process)
