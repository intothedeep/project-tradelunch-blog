---
title: 'C How to use signal handling in C'
date: 2025-04-10
tags: [c, system, signal, handler, exit, kill]
series: study C
draft: true
---

# C How to use signal handling in C - signal, sigaction with POSIX

_Posted on 2025-04-10_

[TOC]

---

## Use Signal Hanlder

좋은 질문입니다. Java의 Runtime.getRuntime().addShutdownHook(...)과 유사한 기능을 C 언어에서 구현하려면, 시스템이 종료되거나 프로그램이 종료될 때 호출될 **종료 처리 루틴(shutdown handler)**을 등록해야 합니다.

⸻

✅ C에서 종료 훅 구현 방법

1. atexit() 함수 사용 (표준 C)
   • 프로그램이 정상적으로 종료될 때 호출될 함수를 등록

#include <stdio.h>
#include <stdlib.h>

void on_shutdown() {
printf("Shutdown handler 실행 중...\n");
// 자원 해제, 로그 남기기 등
}

int main() {
// 종료 핸들러 등록
atexit(on_shutdown);

    printf("프로그램 실행 중...\n");

    // 정상 종료
    return 0;

}

✔ 특징
• exit() 또는 main() 함수의 return으로 종료될 때 실행
• 최대 32개 함수 등록 가능 (보통 시스템에 따라 다름)
• 비정상 종료 (예: kill -9, abort()) 시에는 실행되지 않음

⸻

2. 시그널 핸들러 사용 (signal() 또는 sigaction())

운영체제가 보낸 종료 시그널을 잡아서 처리할 수 있음.

#include <stdio.h>
#include <stdlib.h>
#include <signal.h>

void signal_handler(int sig) {
printf("Signal %d 수신! 종료 처리 중...\n", sig);
// 리소스 정리
exit(0); // 또는 직접 정리하고 `_exit(0)`
}

int main() {
// SIGINT (Ctrl+C) 시그널 처리 등록
signal(SIGINT, signal_handler);
signal(SIGTERM, signal_handler);

    while (1) {
        // 프로그램 계속 실행
    }

    return 0;

}

✔ 특징
• SIGINT, SIGTERM 같은 시그널에 대해 종료 처리를 할 수 있음
• 서버나 데몬에서 자주 사용
• 강제 종료 (kill -9, SIGKILL)는 여전히 잡을 수 없음

⸻

3. 커스텀 종료 처리 함수 조합

#include <stdio.h>
#include <stdlib.h>
#include <signal.h>

void cleanup() {
printf("자원 정리 중...\n");
}

void handle_signal(int sig) {
printf("신호 %d 수신\n", sig);
cleanup();
exit(0);
}

int main() {
atexit(cleanup);
signal(SIGINT, handle_signal);
signal(SIGTERM, handle_signal);

    printf("실행 중... Ctrl+C로 종료해보세요.\n");
    while (1); // 무한 루프

    return 0;

}

⸻

🔄 Java와 C 비교

항목 Java (addShutdownHook) C (atexit, signal)
지원 방식 JVM 런타임 API 표준 라이브러리 + OS 시그널
종료 후처리 Thread 실행 함수 콜백 등록
비정상 종료 대응 제한적 (halt() 시 무시됨) SIGKILL은 막을 수 없음
용도 리소스 해제, 로그, 네트워크 종료 등 동일

⸻

필요하다면 POSIX 환경(예: Linux) 기준으로 sigaction()을 사용한 보다 견고한 시그널 처리 예제도 제공드릴 수 있어요. 혹시 데몬 프로세스나 서버 개발을 염두에 두고 있는지요?

## Use POSIX Sigaction

좋습니다! POSIX 환경에서는 signal()보다는 **sigaction()**을 사용하는 것이 더 안전하고 유연합니다. 특히 서버나 데몬 프로세스에서는 **시그널을 세밀하게 제어**해야 할 필요가 많기 때문에 sigaction()이 권장됩니다.

---

**✅ sigaction() 기본 개념**

sigaction()은 특정 시그널에 대한 **정밀한 핸들링 동작을 지정**할 수 있는 POSIX 시스템 콜입니다. signal()보다 더 안정적이고 재진입 가능(reentrant)하도록 설계되어 있습니다.

---

**📌 구조체: struct sigaction**

```
struct sigaction {
    void     (*sa_handler)(int);      // 시그널 발생 시 호출할 핸들러 함수
    void     (*sa_sigaction)(int, siginfo_t *, void *); // 대체 핸들러 (확장용)
    sigset_t   sa_mask;               // 핸들러 실행 중 블록할 시그널들
    int        sa_flags;              // 핸들러 동작 플래그 (예: SA_RESTART)
};
```

---

**✅ 예제 코드: sigaction()으로 종료 훅 구현**

```
#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <unistd.h>
#include <string.h>

void cleanup() {
    printf("정리 작업 수행 중...\n");
    // 예: 파일 닫기, 메모리 해제, 로그 기록 등
}

void handle_signal(int sig, siginfo_t *info, void *context) {
    printf("시그널 %d 수신\n", sig);
    cleanup();
    exit(0);
}

void setup_sigaction() {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));

    sa.sa_sigaction = handle_signal;  // 확장된 핸들러 사용
    sa.sa_flags = SA_SIGINFO | SA_RESTART;  // 자세한 정보 + 재시작 플래그

    // 핸들링할 시그널 등록
    sigaction(SIGINT, &sa, NULL);   // Ctrl+C
    sigaction(SIGTERM, &sa, NULL);  // kill PID
}

int main() {
    setup_sigaction();

    printf("프로그램 실행 중... PID: %d\n", getpid());
    while (1) {
        pause();  // 시그널이 들어올 때까지 대기 (CPU 낭비 없음)
    }

    return 0;
}
```

---

**🔍 주요 설명**

| **항목**     | **설명**                                                |
| ------------ | ------------------------------------------------------- |
| sigaction()  | signal handler를 설정하는 시스템 콜                     |
| sa_sigaction | sa_handler보다 확장된 버전 (추가 정보 사용 가능)        |
| SA_SIGINFO   | siginfo_t와 ucontext_t를 통해 더 많은 정보 제공         |
| SA_RESTART   | 시스템 콜이 중단되었을 때 자동 재시도 (read, accept 등) |
| pause()      | 시그널이 들어올 때까지 프로세스를 대기 상태로 유지      |

---

**✅ 고급: 블록할 시그널 설정**

```
sigemptyset(&sa.sa_mask);
sigaddset(&sa.sa_mask, SIGTERM); // SIGINT 처리 중 SIGTERM은 블록
```

---

**🔐 시그널에 대응할 수 없는 경우**

| **시그널**   | **설명**                                  |
| ------------ | ----------------------------------------- |
| SIGKILL (9)  | **강제 종료**. 어떤 핸들러로도 처리 불가. |
| SIGSTOP (19) | **강제 정지**. 핸들러 등록 불가.          |

즉, kill -9 같은 경우는 **운영체제가 프로세스를 강제로 종료시키는 것이라**, 종료 훅은 실행되지 않습니다. 이건 Java shutdownHook과 동일한 한계입니다.

---

**✍️ 요약**

| **목적**              | **방법**                    | **특징**                        |
| --------------------- | --------------------------- | ------------------------------- |
| 안전한 시그널 처리    | sigaction()                 | signal보다 안전하고 유연        |
| 리소스 해제/로그/정리 | 핸들러에서 직접 수행        | exit() 전에 수행                |
| 종료 대기             | pause() 또는 select()       | CPU 낭비 없이 대기 가능         |
| 권장 사용             | 데몬, 서버, 멀티스레드 환경 | 예외 처리 및 리소스 관리에 적합 |

---

필요하다면 위 코드를 리눅스 데몬 형태로 리팩토링하거나, 멀티스레드 환경에서 안전하게 시그널 처리하는 방법도 설명드릴 수 있어요. 그런 쪽도 관심 있으신가요?

## 아니요. **sigaction(SIGTERM, ...)은 kill -9로 보낸 시그널을 처리할 수 없습니다.**

---

**❌ kill -9는 SIGKILL을 보내며, 잡을 수 없습니다**

```
kill -9 <pid>
```

• 위 명령은 SIGKILL 시그널을 보냅니다.

• SIGKILL은 **운영체제가 프로세스를 강제로 종료**시키는 시그널입니다.

• 이 시그널은:

• **무조건 즉시 종료**되고,

• **사용자 코드에서 처리할 수 없습니다**.

• sigaction(), signal(), atexit() 어떤 것도 실행되지 않습니다.

---

**✅ 잡을 수 있는 시그널 예시**

| **시그널**       | **설명**              | **핸들링 가능 여부** |
| ---------------- | --------------------- | -------------------- |
| SIGINT           | Ctrl+C (interruption) | ✅                   |
| SIGTERM          | 일반 종료 요청 (kill) | ✅                   |
| SIGHUP           | 터미널 종료           | ✅                   |
| SIGUSR1, SIGUSR2 | 사용자 정의 시그널    | ✅                   |
| SIGQUIT          | Ctrl+\                | ✅                   |
| SIGKILL          | **강제 종료**         | ❌                   |
| SIGSTOP          | **강제 정지**         | ❌                   |

---

**📌 정리**

| **명령어**     | **시그널** | **핸들링 가능?** | **비고**           |
| -------------- | ---------- | ---------------- | ------------------ |
| kill <pid>     | SIGTERM    | ✅               | 기본 시그널        |
| kill -15 <pid> | SIGTERM    | ✅               | 명시적 종료        |
| kill -2 <pid>  | SIGINT     | ✅               | Ctrl+C와 동일      |
| kill -9 <pid>  | SIGKILL    | ❌               | **절대 처리 불가** |

---

**🔒 보안 및 시스템 관리 시 참고**

• 데몬 프로세스나 중요 서버 프로그램은 SIGTERM이나 SIGINT에 정리 코드를 넣어두고,

• 시스템 관리자나 모니터링 도구는 되도록 kill -TERM으로 종료하도록 해야 합니다.

• **정상 종료를 유도하는 설계**가 중요합니다 (kill -9은 마지막 수단).

---

필요하시면 kill -9을 방지하기 위한 리눅스 보호 메커니즘(Linux capabilities, cgroups, PID namespace 등)도 안내드릴 수 있어요. 관심 있으세요?

---

_Thanks for reading!_
[Back to top](#C-How-to-use-signal-handling-in-C)
