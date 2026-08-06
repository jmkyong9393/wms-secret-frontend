/**
 * 로그인 실패 원인을 화면이 바로 쓸 수 있는 형태로 해석한다.
 *
 * [도입 배경 - 2026-08-06]
 * 종전 로그인 화면은 어떤 실패든 `data.message || data.detail || '사번 또는 비밀번호가
 * 올바르지 않습니다.'` 한 줄로 처리했다. 그래서
 *  - 시도 제한(429)에 걸려도 "비밀번호가 틀렸다"고 표시됐고 (백엔드는 message가 아니라
 *    error 키로 내려주고 있었다),
 *  - 계정 비활성/서버 장애/네트워크 단절이 전부 같은 문구로 뭉개져
 * 화면만 보고는 원인을 특정할 수 없었다. 실제로 터널 시연 중 이 문구 때문에 원인 진단이
 * 크게 지연됐다.
 *
 * 그래서 판단 근거를 문구가 아니라 **백엔드가 내려주는 error_code**로 바꾸고, 사용자에게는
 * "무엇이 문제인지 + 그래서 무엇을 하면 되는지"를 함께 보여준다.
 */

export type LoginFailureSeverity = "warning" | "error";

export interface LoginFailure {
  /** 기계 판독용 사유 코드 (백엔드 error_code 또는 클라이언트 측 판정값) */
  code: string;
  /** 알림창 제목 */
  title: string;
  /** 무엇이 일어났는가 */
  message: string;
  /** 그래서 무엇을 하면 되는가 (없을 수 있음) */
  hint?: string;
  severity: LoginFailureSeverity;
  /** HTTP 상태코드 (네트워크 단절 등 응답이 없으면 undefined) */
  status?: number;
}

interface ApiErrorBody {
  error_code?: string;
  message?: string;
  detail?: string;
  error?: string;
  remaining_attempts?: number;
  retry_after_seconds?: number;
}

export function resolveLoginFailure(err: any): LoginFailure {
  const status: number | undefined = err?.response?.status;
  const body: ApiErrorBody = err?.response?.data ?? {};

  // 1) 응답 자체가 없는 경우 - 서버 다운, 프록시 미기동, 네트워크 단절
  if (!err?.response) {
    const timedOut = err?.code === "ECONNABORTED";
    return {
      code: timedOut ? "CLIENT_TIMEOUT" : "NETWORK_ERROR",
      title: timedOut ? "서버 응답 시간 초과" : "서버에 연결하지 못했습니다",
      message: timedOut
        ? "요청이 제한 시간 내에 완료되지 않았습니다."
        : "백엔드 API에 도달하지 못했습니다. 서버가 실행 중인지 확인해 주세요.",
      hint: "네트워크 연결과 API 서버(:8000) 상태를 확인하세요.",
      severity: "error",
      status,
    };
  }

  const code = body.error_code ?? (status === 429 ? "RATE_LIMITED" : "UNKNOWN");

  switch (code) {
    case "AUTH_INVALID_CREDENTIALS": {
      const remaining = body.remaining_attempts;
      return {
        code,
        title: "사번 또는 비밀번호가 일치하지 않습니다",
        message:
          typeof remaining === "number"
            ? `입력한 자격증명으로 인증하지 못했습니다. 남은 시도 횟수 ${remaining}회.`
            : "입력한 자격증명으로 인증하지 못했습니다.",
        hint:
          typeof remaining === "number" && remaining <= 3
            ? "시도 횟수를 모두 소진하면 일정 시간 로그인이 제한됩니다. 초기 암호는 1234입니다."
            : "대소문자와 사번 형식(WM으로 시작)을 확인해 주세요.",
        severity: "warning",
        status,
      };
    }

    case "AUTH_ACCOUNT_INACTIVE":
      return {
        code,
        title: "비활성 상태의 계정입니다",
        message: "자격증명은 일치하지만 계정이 활성 상태가 아니라 접속할 수 없습니다.",
        hint: "관리자(MASTER)에게 계정 활성화를 요청하세요.",
        severity: "error",
        status,
      };

    case "AUTH_TOO_MANY_ATTEMPTS": {
      const seconds = body.retry_after_seconds;
      return {
        code,
        title: "로그인 시도가 일시적으로 제한되었습니다",
        message:
          typeof seconds === "number"
            ? `연속 실패가 누적되어 이 계정의 로그인이 ${seconds}초간 제한됩니다.`
            : "연속 실패가 누적되어 이 계정의 로그인이 일시 제한됩니다.",
        hint: "제한이 풀린 뒤 정확한 비밀번호로 한 번에 로그인하면 카운터가 초기화됩니다.",
        severity: "error",
        status,
      };
    }

    case "RATE_LIMITED":
      return {
        code,
        title: "요청이 너무 많습니다",
        message: "짧은 시간에 과도한 요청이 들어와 이 IP의 요청이 잠시 차단되었습니다.",
        hint: "1분 후 다시 시도해 주세요.",
        severity: "error",
        status,
      };

    default: {
      const detail = body.message || body.detail || body.error;
      if (status && status >= 500) {
        return {
          code: "SERVER_ERROR",
          title: "서버 내부 오류",
          message: detail || "요청을 처리하는 중 서버에서 오류가 발생했습니다.",
          hint: "잠시 후 다시 시도하고, 반복되면 API 로그를 확인하세요.",
          severity: "error",
          status,
        };
      }
      return {
        code: code === "UNKNOWN" ? `HTTP_${status ?? "UNKNOWN"}` : code,
        title: "로그인에 실패했습니다",
        message: detail || "알 수 없는 이유로 인증이 거부되었습니다.",
        severity: "error",
        status,
      };
    }
  }
}
