/** 삭제 전 확인창. 취소하면 false. (브라우저 confirm 사용) */
export function confirmDelete(message = "정말 삭제할까요?"): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
