# [보존] kubeadm 클러스터 시절 워크플로 (2026-09-01 이동)

운영이 Lightsail로 이전하며 소멸한 클러스터 대상 워크플로를 옮겼다.
분류 체계와 사유는 백엔드 레포 `k8s/workflows/README.md`가 정본이다.

- `cluster-apply-manifests.yml` — 복귀 세트. k8s 복귀 1단계에서
  `.github/workflows/`로 되돌려 재사용한다 (백엔드 `k8s/RETURN.md` 참조).
- `deploy-prod.yml` — 지정 태그 클러스터 롤백. 현행 롤백은 백엔드 레포의
  `deploy-lightsail.yml` SHA 입력이 대체했다.
