/**
 * 직원 관리 API 주소
 *
 * 직원 목록 조회, 계정 생성, 상태 변경, 역할 변경에 사용
 *
 * 계정 생성 주소만 참고 문서에서 확인된 임시 값
 * 나머지 주소는 백엔드 명세 확정 전까지 사용하는 임시 주소
 */
export const EMPLOYEE_LIST_ENDPOINT = "/api/v1/users/admin";
export const EMPLOYEE_BULK_CREATE_ENDPOINT = "/api/v1/users/admin/create-accounts";
export const employeeStatusEndpoint = (employeeId: string) =>
  `/api/v1/users/admin/${employeeId}/status`;
export const employeeRoleEndpoint = (employeeId: string) =>
  `/api/v1/users/admin/${employeeId}/role`;
