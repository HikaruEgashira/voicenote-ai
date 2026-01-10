export type SecurityErrorCode = "GEO_RESTRICTED" | "RATE_LIMITED";

export interface SecurityError {
  code: SecurityErrorCode;
  message: string;
  messageJa: string;
}

export function isSecurityError(status: number): boolean {
  return status === 403 || status === 429;
}

export function getSecurityErrorMessage(status: number): string {
  if (status === 403) {
    return "この地域からのアクセスは許可されていません";
  }
  if (status === 429) {
    return "リクエストが多すぎます。しばらく経ってからお試しください";
  }
  return "アクセスが拒否されました";
}
