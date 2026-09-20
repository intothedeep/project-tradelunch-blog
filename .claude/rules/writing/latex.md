---
paths:
  - "**/*.tex"
  - "**/*.bib"
  - "**/*.sty"
  - "**/*.cls"
---

# LaTeX 조판 규칙 (한국어 문서)

한국어 `.tex` 문서의 **기계적** 규칙 — 엔진, 폰트, 패키지, 빌드, 함정.
집필 내용 규칙(목소리·구조·병기 정책)은 `.claude/rules/writing/book.md`에 있다.
이식 가능한 규칙이다 — 다른 저장소에 그대로 복사해 쓴다.

---

## 1. 엔진 — XeLaTeX 고정

```bash
latexmk -xelatex main.tex
```

**pdfLaTeX를 쓰지 않는다.** 한국어가 제대로 조판되지 않는다.
LuaLaTeX도 쓰지 않는다 — 아래 폰트/패키지 구성이 XeLaTeX 기준으로 검증되어 있다.

## 2. 한글 조판 — xeCJK

로컬 TeX가 **basic 스킴**이라 `kotex`이 **없다**. `xeCJK`로 처리한다.

```latex
\usepackage{fontspec}
\usepackage{xeCJK}
\setCJKmainfont{Apple SD Gothic Neo}   % macOS 시스템 폰트, 설치 불필요
\xeCJKsetup{CJKspace=true}             % 필수
```

`CJKspace=true`가 **없으면 한글 단어 사이 띄어쓰기가 사라진다.** 선택 사항이 아니다.

## 3. 사용 가능한 패키지 (실측)

이 환경에서 **실제로 설치되어 있는 것만** 쓴다. 없는 패키지를 요구하는 규칙은 규칙이
아니라 버그다.

| 있음 | 용도 |
| --- | --- |
| `fontspec` `xeCJK` | 폰트·한글 |
| `amsmath` `unicode-math` | 수식 |
| `tikz` | 그림 |
| `booktabs` `tabularx` | 표 |
| `listings` | 예제 코드 |
| `cleveref` | `\Cref` 교차 참조 |
| `microtype` | 조판 품질 |

| 없음 | 대신 |
| --- | --- |
| `kotex` | `xeCJK` (§2) |
| `tcolorbox` | 순수 LaTeX `\newenvironment` + `fcolorbox` (§6) |
| `siunitx` | 단위는 직접 조판 — `\,` 얇은 공백 + `\text{}` (`12\,\text{mg/kg}`) |
| `biblatex` | `natbib`/기본 `thebibliography` |
| `glossaries` | 용어집이 필요하면 손으로 관리 — 자동 첫등장 확장에 의존하지 않는다 |
| `csquotes` | 인용부호 직접 |

**패키지를 새로 쓰기 전에 `kpsewhich <pkg>.sty`로 존재를 확인한다.**
없으면 설치하거나 우회하고, 이 표를 갱신한다.

## 4. 폰트

**결정 (2026-09-16, 저자): Apple SD Gothic Neo.**

```
한글    Apple SD Gothic Neo   (macOS 시스템, 설치 불필요)
라틴    기본값
모노    기본값
```

**IBM Plex는 검토 후 채택하지 않았다.** 아래는 다시 꺼내지 않기 위한 기록이다.

Plex Sans KR / Sans / Mono는 무료이고 한글·라틴·모노를 한 가족으로 맞출 수 있어 한영 혼용
문서에서 유리하다. 채택하지 않은 이유:

- 이 환경에 **설치되어 있지 않다**(실측). 도입하면 "설치 없이 오늘 빌드된다"는 성질을 잃는다.
- Plex에는 **수학 폰트가 없다.** 산세리프 본문 + 세리프 수식은 따로 논다 — `unicode-math`로
  수학 폰트를 따로 골라야 하고, 그 선택이 또 하나의 결정이 된다.
- Plex KR에는 **세리프(명조) 한글이 없다.** 명조 본문을 원하면 한글만 다른 가족으로 빼야 하고,
  그러면 "한 가족으로 맞춘다"는 애초의 이점이 사라진다.

폰트를 바꾸려면 위 세 가지가 먼저 해결되어야 한다.

## 5. 수식

- `amsmath`를 쓴다. `$$ ... $$`를 **쓰지 않는다** — `\[ ... \]` 또는 `equation` 환경.
- 연산자는 `\DeclareMathOperator`로 이름을 준다. 본문에 `\mathrm{argmax}`를 흩뿌리지 않는다.
- 참조할 수식에만 번호를 남긴다 — 나머지는 `equation*` / `align*`.
- 수식 안 한글은 `\text{}`로 감싼다. 직접 넣으면 폰트와 간격이 깨진다.

## 6. 콜아웃 박스 — tcolorbox 없이

`tcolorbox`가 없으므로 순수 LaTeX로 만든다. preamble에 한 번 정의하고 본문에서는 환경만 쓴다.

```latex
\usepackage{xcolor}
\newsavebox{\calloutbox}
\newenvironment{callout}[1][]
  {\par\medskip\noindent
   \begin{lrbox}{\calloutbox}\begin{minipage}{0.92\linewidth}
   \def\calloutttl{#1}\ifx\calloutttl\empty\else\textbf{#1}\par\smallskip\fi}
  {\end{minipage}\end{lrbox}%
   \fcolorbox{black!30}{black!3}{\usebox{\calloutbox}}\par\medskip}
```

`\newsavebox`를 쓰는 이유: `\@tempboxa` 같은 내부 박스는 `\makeatletter` 없이는 쓸 수 없고,
다른 패키지와 충돌한다. 전용 박스를 하나 잡는 편이 안전하다.

## 7. TikZ — 겪은 함정

- **짧은 한글 라벨에 `text width`(고정폭)를 주지 않는다.** 글자가 늘어난다(`세 포`).
  `minimum width`를 쓴다.
- **스타일 이름으로 `at`을 쓰지 않는다.** TikZ 예약어와 충돌한다.
  다른 예약어(`node`, `edge`, `to`)도 마찬가지.
- 그림이 본문 흐름을 끊으면 `figure` 환경에 넣고 `\Cref`로 참조한다.

## 8. 표

- `booktabs`를 쓴다 — `\toprule` / `\midrule` / `\bottomrule`.
  **세로줄(`|`)을 쓰지 않는다.**
- 폭이 필요하면 `tabularx` + `X` 열.
- 숫자 열은 소수점 자리를 통일한다.

## 9. 코드 블록 (listings)

- **코드 블록을 쪽 중간에서 자르지 않는다 (2026-09-18, 저자 지시).** 잘린 코드는 앞뒤 쪽을 오가며
  읽어야 한다. preamble에서 모든 `lstlisting`을 쪽이 나뉘지 않는 `minipage`로 자동으로 감싼다.
  들어가지 않으면 블록 전체가 다음 쪽으로 넘어간다(표의 `[H]`와 같은 동작).

  ```latex
  \usepackage{etoolbox}
  \BeforeBeginEnvironment{lstlisting}{\par\medskip\noindent\begin{minipage}{\linewidth}}
  \AfterEndEnvironment{lstlisting}{\end{minipage}\par\medskip}
  ```

  - `\lstset{float=H}`로는 **안 된다**(실측: 블록이 그대로 잘렸다).
  - 본문의 `lstlisting`은 그대로 쓴다. 감싸기는 preamble이 맡는다.
  - 대가: 넘어간 자리 앞 쪽 아래에 빈 공간이 남는다.
  - **한 쪽보다 긴 코드는 쪽 밖으로 넘친다.** 그런 코드는 의미 단위(클래스·함수)로 블록을 나눈다.
- 긴 코드는 줄이 접히지 않게 `basicstyle=\ttfamily\scriptsize`로 한 단계 줄이고, 주석은 짧게 쓴다.

## 10. 교차 참조

- `cleveref`의 `\Cref`를 쓴다 — `\ref`를 직접 쓰지 않는다.
  ("그림 3"을 손으로 적지 않는다. 번호가 바뀌면 틀린다.)
- 라벨 접두사 고정: `ch:` · `sec:` · `fig:` · `tab:` · `eq:` · `ex:`.
- `\label`은 `\caption` **뒤에** 둔다. 앞에 두면 엉뚱한 번호를 잡는다.

## 11. 날짜

표시는 `YYYY/MM/DD`로 통일한다. 저장·정렬용 값은 ISO(`YYYY-MM-DD`)를 쓴다.

## 12. 빌드 산출물

- `latexmk -xelatex main.tex` — 이 한 줄이 유일한 빌드 경로다.
- `.aux` `.log` `.out` `.toc` `.fls` `.fdb_latexmk` 등 중간 산출물은 커밋하지 않는다.
- PDF 커밋 여부는 각 저장소가 정한다. 정했으면 `.gitignore`에 적어 둔다.
- `latexmk -c`로 청소한다. 손으로 지우지 않는다.

## 13. 구현 품질 (구 `sonnet-writer` §5·§6에서 이관, 2026-09-20)

문서를 **고치는** 쪽의 규칙이다. 무엇을 쓸지는 `book.md`, 어떻게 조판할지는 위 §1–12.

- **최소 diff.** 기존 섹션·매크로·표기·환경·서지 설정을 먼저 재사용한다. 불필요한
  리팩터링, 요구되지 않은 문서 전체 서식 변경, 관련 없는 섹션 재작성은 하지 않는다.
- **참조는 항상 `\Cref`/`\eqref`.** 번호를 손으로 박지 않는다(`식 (3.2)`처럼 쓰지 않는다).
- **라벨 접두사 고정**(`ch:`·`sec:`·`fig:`·`tab:`·`eq:`·`ex:` — `book.md` §3)과
  의미 있는 이름. `fig:1` 같은 이름은 쓰지 않는다.
- **매크로·정의를 중복 생성하지 않는다.** 이미 preamble에 있으면 그것을 쓴다.
- **패키지는 필요할 때만 추가한다.** 추가했다면 왜 필요한지 커밋 메시지나 보고에 남긴다.
- **프로젝트 구조를 임의로 재편하지 않는다** — `main.tex` + `preamble.tex` + `parts/` +
  `chapters/`(`book.md` §3). 명시적 요구가 없으면 파일을 옮기거나 이름을 바꾸지 않는다.
- 수식 환경·간격·서식은 그 문서가 이미 쓰고 있는 관례를 따른다.
