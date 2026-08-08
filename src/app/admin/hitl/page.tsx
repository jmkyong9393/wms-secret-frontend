"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Maximize2,
  Sliders,
  Sparkles,
  Bot,
  Shield as ShieldIcon,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BookCover from "@/components/BookCover";
import { adminAPI } from "@/lib/api";
import { getSystemSettings, SETTINGS_CHANGE_EVENT } from "@/lib/systemSettings";
import type { HitlTask, HitlOverrideRequest } from "@/features/hitl/types/hitl";
import { HitlImageModal, EMPTY_BBOX_EDITS, type BBoxEdits } from "@/features/hitl/components/HitlImageModal";
// 관리자 설정의 읽기 전용 정책 뷰와 같은 정의를 쓴다 (features/hitl/policy.ts)
import { UBCI_GRADE_POLICY, HITL_ROUTING_POLICY, gradeFromUbciScore, defaultDecisionForGrade } from "@/features/hitl/policy";

const DECISION_OPTIONS = [
  { value: "APPROVE_NORMAL", label: "정상 승인 (입고)" },
  { value: "APPROVE_DOWNGRADE", label: "등급 하향 승인" },
  { value: "REJECT_RETURN", label: "반려 (출판사/고객 반송)" },
  { value: "RE_CHECK", label: "재검수 요청 (재촬영)" },
];

const GRADE_OPTIONS = [
  { value: "MINT", label: "MINT (최상급)" },
  { value: "GOOD", label: "GOOD (상급)" },
  { value: "NORMAL", label: "NORMAL (중급)" },
  { value: "REJECT", label: "REJECT (폐기)" },
];

const REASON_OPTIONS = [
  { group: "오탐 방어 (정정)", items: [
    { value: "FP_SHADOW", label: "그림자 오탐" },
    { value: "FP_GLARE", label: "빛 반사 오탐" },
  ]},
  { group: "외부 손상", items: [
    { value: "DMG_EXT_CRUSH", label: "모서리 찌그러짐" },
    { value: "DMG_EXT_WET", label: "외부 습기/침수" },
    { value: "DMG_EXT_TEAR", label: "커버 찢어짐" },
  ]},
  { group: "내부 훼손", items: [
    { value: "DMG_INT_DOODLE", label: "내부 손글씨/낙서" },
    { value: "DMG_INT_STAIN", label: "내지 오염/이물질" },
    { value: "DMG_INT_DISCOLOR", label: "내지 황변/변색" },
  ]},
];

const REASON_CODE_MAP: Record<string, { label: string; category: string; color: string }> = {
  DMG_EXT_CRUSH: { label: '모서리 찌그러짐', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_WET: { label: '외부 습기/침수', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_EXT_TEAR: { label: '커버 찢어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DOODLE: { label: '내부 손글씨/낙서', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_INT_STAIN: { label: '내지 오염/이물질', category: '내부 훼손', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_INT_DISCOLOR: { label: '내지 황변/변색', category: '내부 훼손', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
  FP_SHADOW: { label: '그림자 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  FP_GLARE: { label: '빛 반사 오탐', category: '오탐 방어', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  // [2026-08-08 추가] app/ai/agents/__init__.py DEFECT_TRANSLATION_MAP에는 있지만
  // 여기 빠져 있던 실제 결함 코드. 없으면 칩이 한글 라벨 없이 원시 코드로 표시된다.
  DMG_EXT_SCRATCH: { label: '표지 긁힘/스크래치', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_EXT_STICKER: { label: '스티커/바코드 자국', category: '외부 손상', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800' },
  DMG_EDGE_WEAR: { label: '모서리 마모', category: '외부 손상', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_SPINE_CRACK: { label: '책등 갈라짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_BINDING_LOOSE: { label: '제본 벌어짐', category: '외부 손상', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  DMG_SIGNATURE: { label: '측면 서명/이름', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  DMG_STAMP: { label: '도서관/장서인 도장', category: '내부 훼손', color: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  // Supervisor가 사유 코드 없이 이관한 건은 백엔드가 이 상태 코드를 내려준다.
  // 매핑이 없으면 원시 코드가 그대로 노출되어 다른 관제 화면과 이질적으로 보였다.
  AWAITING_HUMAN_REVIEW: { label: '관리자 판독 대기', category: 'HITL 이관', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
};

export default function AdminHitlDashboard() {
  const [reinspectingIds, setReinspectingIds] = useState<Set<string>>(new Set());
  const [activeReinspectionTask, setActiveReinspectionTask] = useState<{
    id: string;
    lpn: string;
    title: string;
    step: number;
    logs: string[];
    isDone: boolean;
    error?: string;
  } | null>(null);

  // [수정 이력 2026-08-04] 구 명칭 "Explainer Agent"는 파이프라인 개편(Detector→Vision→
  // Policy→Critic→Supervisor→Report)으로 사라진 노드다. 로그 패널을 실제 파이프라인
  // 명칭 기준으로 정리 (저장 키도 교체, 구 키는 마운트 시 청소).
  const [pipelineLogs, setPipelineLogs] = useState<Array<{ time: string; agent: string; text: string; type: string }>>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hitl_explainer_logs");
      const saved = localStorage.getItem("hitl_pipeline_logs");
      if (saved) {
        try {
          setPipelineLogs(JSON.parse(saved));
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== "undefined") {
      localStorage.setItem("hitl_pipeline_logs", JSON.stringify(pipelineLogs));
    }
  }, [pipelineLogs, isMounted]);

  const handleClearLogs = () => {
    setPipelineLogs([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("hitl_pipeline_logs");
    }
  };

  const handleTriggerAiReinspect = async (jobId: string) => {
    const targetTask = tasks.find((t) => t.id === jobId) as any;
    const yymmdd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const lpnStr = targetTask?.agent_logs?.lpn_barcode || targetTask?.lpn_barcode || `LPN-${yymmdd}-${jobId.slice(0, 4).toUpperCase()}`;
    const titleStr = targetTask?.book_title || "수동 검수 요청 도서";

    setReinspectingIds((prev) => new Set(prev).add(jobId));
    setActiveReinspectionTask({
      id: jobId,
      lpn: lpnStr,
      title: titleStr,
      step: 1,
      logs: [
        // 이 시점에 확실한 사실은 "요청을 보냈다"뿐이다. 워커가 아직 작업을 집지도
        // 않았는데 "Detector 추론 중"이라고 쓰면 화면이 없는 사실을 말하게 된다.
        // 실제 단계별 서술은 파이프라인이 끝난 뒤 agent_logs에서 가져온다.
        `[${new Date().toLocaleTimeString()}] 재검수 요청 전송...`,
      ],
      isDone: false,
    });

    try {
      // 재검수는 Celery 비동기다. 큐 등록 응답에는 판독 결과가 없으므로(십수 초 뒤 완료),
      // 등록 직후에는 "진행 중"만 보여주고 **실제 결과가 DB에 반영되면 그때 렌더**한다.
      //
      // [2026-08-06 수정] 종전에는 여기서 `const logs = {}`(빈 객체)와 `const score = 75`를
      // 두고 `logs?.x || 폴백`으로 문자열을 만들었다. logs가 비어 있으니 다섯 줄 전부 고정
      // 문구였고 점수도 상수였다 - 화면 전체가 연출이었다. 게다가 등록 즉시 step:5, isDone:true로
      // "완료"를 선언해, 실제 파이프라인이 17초 뒤 내놓은 결과(예: UBCI 100, HITL 유지)와
      // 무관하게 영원히 "UBCI 75점"을 말했다.
      const t = () => new Date().toLocaleTimeString();
      await adminAPI.triggerAiReinspection(jobId);

      setActiveReinspectionTask((prev) =>
        prev && prev.id === jobId
          ? { ...prev, step: 2, logs: [...prev.logs, `[${t()}] ⏳ 큐 등록 완료 - 파이프라인 실행을 기다리는 중...`] }
          : prev
      );

      // --- 결과 폴링 ---
      const POLL_MS = 2000;
      const MAX_WAIT_MS = 120000;
      const startedAt = Date.now();
      let result: Awaited<ReturnType<typeof adminAPI.getInspectionResult>> | null = null;

      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
          const cur = await adminAPI.getInspectionResult(jobId);
          const lg = (cur?.agent_logs || {}) as Record<string, string | undefined>;
          // 재검수가 끝나면 Policy/Report 서술이 채워진다. 둘 다 없으면 아직 실행 중이다.
          if (lg.policy_text || lg.report_text) {
            result = cur;
            break;
          }
        } catch {
          // 일시적 조회 실패는 무시하고 다음 주기에 재시도한다.
        }
      }

      if (!result) {
        setActiveReinspectionTask((prev) =>
          prev && prev.id === jobId
            ? {
                ...prev,
                isDone: true,
                logs: [...prev.logs, `[${t()}] ⚠️ 제한 시간(2분) 내에 결과가 반영되지 않았습니다. 목록을 새로고침해 확인하세요.`],
              }
            : prev
        );
        return;
      }

      const logs = (result.agent_logs || {}) as Record<string, string | undefined>;
      const score = result.ubci_score;
      const scoreStr = typeof score === "number" ? `UBCI ${score}점` : "UBCI 점수 보류";
      // 실제 서술만 싣는다. 없는 단계는 줄 자체를 만들지 않는다 - 문구를 지어내지 않기 위해서다.
      const realLines: Array<[string, string | undefined]> = [
        ["🔬 [Detector]", logs.detector_text],
        ["👁️ [Vision Agent]", logs.vision_text],
        ["⚖️ [Policy Agent]", logs.policy_text],
        ["🛡️ [Critic Agent]", logs.critic_text],
        ["🧭 [Supervisor]", logs.supervisor_rationale],
        ["💬 [Report Agent]", logs.report_text],
      ];
      const summaryMsg = logs.report_text || logs.policy_text || scoreStr;

      setActiveReinspectionTask((prev) =>
        prev && prev.id === jobId
          ? {
              ...prev,
              step: 5,
              isDone: true,
              logs: [
                ...prev.logs,
                `[${t()}] ✅ 파이프라인 완료 - ${scoreStr}`,
                ...realLines.filter(([, v]) => v && v.trim()).map(([tag, v]) => `[${t()}] ${tag} ${v}`),
              ],
            }
          : prev
      );

      const timeNow = t();
      setPipelineLogs((prev) => [
        {
          time: timeNow,
          agent: "Report Agent 💬",
          text: `[${lpnStr}] DB 연산 결과: "${summaryMsg}" DB 반영 완료!`,
          type: "success",
        },
        ...prev,
      ]);

      await fetchTasks();
    } catch (err: any) {
      console.error("AI Re-inspection failed:", err);
      setActiveReinspectionTask((prev) =>
        prev
          ? {
              ...prev,
              isDone: true,
              error: err?.message || "서버 통신 실패",
              logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ❌ 재검수 오류: ${err?.message || "서버 오류"}`],
            }
          : null
      );
    } finally {
      setReinspectingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };
  const [tasks, setTasks] = useState<HitlTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 시스템 설정의 HITL 대기열 경보 임계값 (설정 페이지에서 변경 시 실시간 반영)
  const [alertThreshold, setAlertThreshold] = useState<number>(10);
  useEffect(() => {
    setAlertThreshold(getSystemSettings().hitlAlertThreshold);
    const onSettingsChange = (e: Event) => {
      const evt = e as CustomEvent<{ hitlAlertThreshold?: number }>;
      if (evt.detail && Number.isFinite(evt.detail.hitlAlertThreshold)) {
        setAlertThreshold(evt.detail.hitlAlertThreshold as number);
      }
    };
    window.addEventListener(SETTINGS_CHANGE_EVENT, onSettingsChange);
    return () => window.removeEventListener(SETTINGS_CHANGE_EVENT, onSettingsChange);
  }, []);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  // 결재 규칙 패널. 매번 펼쳐 두면 목록이 밀려나므로 기본은 접어 둔다.
  const [showPolicy, setShowPolicy] = useState(false);
  const [modalTask, setModalTask] = useState<HitlTask | null>(null);
  // 결재 건별 BBox 채택/제외. 모달을 닫아도 유지되어야 제출까지 이어진다.
  const [bboxEdits, setBboxEdits] = useState<Record<string, BBoxEdits>>({});
  const [approvalToast, setApprovalToast] = useState<string | null>(null);

  // 각 row별 선택 및 설정 상태
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const pageEnterTime = useRef(Date.now());

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await adminAPI.getPendingHitlTasks();
      const list = data || [];
      // 재검수를 누르면 백엔드가 status를 PENDING으로 바꿔 큐에 넣는다. 이 목록은
      // HITL_REQUIRED만 조회하므로 그 사이 해당 도서가 목록에서 통째로 사라졌다가
      // 파이프라인이 끝나면 다시 나타난다 - 결재자에게는 "누르니까 사라졌다"로 보인다.
      // 데이터가 늦게 오는 문제가 아니라서 새로고침으로는 해결되지 않는다(오히려 더 빨리
      // 사라진다). 재검수 중인 건은 직전 목록의 행을 그대로 붙잡아 둔다.
      setTasks((prev) => {
        if (reinspectingIds.size === 0) return list;
        const returned = new Set(list.map((t: HitlTask) => t.id));
        const pinned = prev.filter((t) => reinspectingIds.has(t.id) && !returned.has(t.id));
        return pinned.length > 0 ? [...pinned, ...list] : list;
      });

      // 개별 라우별 initial state 미리 매핑
      const initDecisions: Record<string, string> = {};
      const initGrades: Record<string, string> = {};
      const initReasons: Record<string, string> = {};
      const initComments: Record<string, string> = {};

      const getDefaultReason = (desc: string) => {
        if (!desc) return "DMG_INT_DOODLE";
        const d = desc.toLowerCase();
        
        for (const key of Object.keys(REASON_CODE_MAP)) {
          if (d.includes(key.toLowerCase())) return key;
        }
        
        // 1. 외부 손상 / 찌그러짐
        if (d.includes("찌그러짐") || d.includes("찍힘") || d.includes("구겨짐") || d.includes("긁힘") || d.includes("스크래치") || d.includes("갈라짐")) return "DMG_EXT_CRUSH";
        // 2. 외부 습기 / 침수
        if (d.includes("습기") || d.includes("침수") || d.includes("물") || d.includes("액체") || d.includes("울기") || d.includes("warping") || d.includes("water")) return "DMG_EXT_WET";
        // 3. 커버 찢어짐
        if (d.includes("찢어짐") || d.includes("tear")) return "DMG_EXT_TEAR";
        // 4. 오염 / 얼룩
        if (d.includes("오염") || d.includes("얼룩") || d.includes("stain")) return "DMG_INT_STAIN";
        // 5. 변색 / 황변
        if (d.includes("변색") || d.includes("황변") || d.includes("빛바램")) return "DMG_INT_DISCOLOR";
        // 6. 오탐 방어
        if (d.includes("그림자") || d.includes("shadow")) return "FP_SHADOW";
        if (d.includes("빛반사") || d.includes("glare")) return "FP_GLARE";
        // 7. 필기 / 낙서 / 밑줄 (기본값)
        if (d.includes("필기") || d.includes("낙서") || d.includes("밑줄") || d.includes("handwriting") || d.includes("scribble")) return "DMG_INT_DOODLE";
        
        return "DMG_INT_DOODLE";
      };

      // [2026-08-08 신설] agent_logs.reason_code/primary_reason_code(CRITIC_INTEGRITY_VIOLATION,
      // SCORE_BOUNDARY, NO_VALID_IMAGE_HITL, CRITIC_RETRY_EXCEEDED 등)는 "왜 HITL로 이관됐는가"를
      // 나타내는 파이프라인 라우팅 코드이지, primaryReasonCode가 요구하는 결함 분류 코드
      // (DMG_EXT_CRUSH 등)가 아니다. 그런데도 종전 기본값 로직은 이 라우팅 코드를 그대로
      // primaryReasonCode에 흘려보내, 검수자가 손대지 않고 제출하면 "우리가 실제로 검증한
      // 결함"이 아니라 "이관 사유"가 사유 코드로 저장됐다. 실제로 Vision/YOLO가 확정한
      // agent_logs.defects[]에서 가장 비중이 큰(감점 기준) 결함 유형을 대표 사유로 쓴다.
      const getPrimaryDefectReason = (t: HitlTask): string | null => {
        const defects: any[] = Array.isArray(t.agent_logs?.defects) ? t.agent_logs.defects : [];
        const candidates = defects.filter(
          (d) => d && typeof d.type === "string" && d.type && !d.hitl_excluded && !d.evidence_suspect
        );
        if (candidates.length === 0) return null;
        candidates.sort(
          (a, b) =>
            Number(b.applied_deduction ?? b.preliminary_deduction ?? 0) -
            Number(a.applied_deduction ?? a.preliminary_deduction ?? 0)
        );
        return candidates[0].type;
      };

      list.forEach((t: HitlTask) => {
        // [2026-08-08] AI가 이미 산출한 UBCI 점수(t.ubci_score)를 등급 경계에 대입해
        // 처분/목표등급 기본값을 추천한다. suggested_grade/suggested_decision이 있으면
        // (파이프라인이 명시적으로 내려준 값) 그쪽을 우선한다.
        const scoreGrade = gradeFromUbciScore(t.ubci_score);
        const recommendedGrade = t.agent_logs?.suggested_grade || scoreGrade || "NORMAL";
        initDecisions[t.id] =
          t.agent_logs?.suggested_decision || defaultDecisionForGrade(recommendedGrade);
        initGrades[t.id] = recommendedGrade;
        // 실제로 검증된 결함(agent_logs.defects) 중 감점 비중이 가장 큰 유형을 사유
        // 기본값으로 쓴다. defects가 비어 있는 건(NO_VALID_IMAGE_HITL 등 판독 자체가 없던
        // 경우)만 예전 서술 기반 추론으로 폴백한다.
        initReasons[t.id] =
          getPrimaryDefectReason(t) || getDefaultReason(t.agent_logs?.defect_description || "");
        initComments[t.id] = t.human_issue_notes || "관리자 검수 오버라이드";
      });

      setDecisions(initDecisions);
      setGrades(initGrades);
      setReasons(initReasons);
      setComments(initComments);
    } catch (err: any) {
      // 401(세션 만료) 처리는 apiClient의 전역 response 인터셉터(lib/api-client.ts)가
      // 이미 담당한다 - 여기서 중복으로 리다이렉트하지 않는다.
      console.error("Failed to fetch HITL tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // 검색어 필터링
  const filteredTasks = useMemo(() => {
    if (!keyword.trim()) return tasks;
    const kw = keyword.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (t.book_title && t.book_title.toLowerCase().includes(kw)) ||
        (t.isbn && t.isbn.includes(kw)) ||
        (t.id && t.id.toLowerCase().includes(kw))
    );
  }, [tasks, keyword]);

  // 체크박스 제어
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  const [masterDecision, setMasterDecision] = useState<string>("APPROVE_DOWNGRADE");
  const [masterGrade, setMasterGrade] = useState<string>("GOOD");
  const [masterReasons, setMasterReasons] = useState<string[]>(["DMG_INT_DOODLE", "DMG_EXT_CRUSH"]);

  const handleMasterDecisionChange = (val: string | null) => {
    if (val) setMasterDecision(val);
  };

  const handleMasterGradeChange = (val: string | null) => {
    if (val) setMasterGrade(val);
  };

  const toggleMasterReason = (code: string) => {
    if (masterReasons.includes(code)) {
      if (masterReasons.length > 1) {
        setMasterReasons(masterReasons.filter((c) => c !== code));
      }
    } else {
      setMasterReasons([...masterReasons, code]);
    }
  };

  // 마스터 설정값을 선택된 항목들에 [폼에 세팅] 버튼 클릭 시 수동 반영
  const handleApplyMasterSettings = () => {
    if (selectedIds.size === 0) {
      alert("일괄 세팅할 항목의 체크박스를 먼저 선택해 주세요.");
      return;
    }
    const nextDecisions = { ...decisions };
    const nextGrades = { ...grades };
    const nextReasons = { ...reasons } as Record<string, any>;

    selectedIds.forEach((id) => {
      nextDecisions[id] = masterDecision;
      nextGrades[id] = masterGrade;
      nextReasons[id] = masterReasons.length > 0 ? masterReasons.join(", ") : "";
    });

    setDecisions(nextDecisions);
    setGrades(nextGrades);
    setReasons(nextReasons);
  };

  // 개별/일괄 승인 제출 (테이블에 설정된 실제 row 데이터 최종 제출)
  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      alert("최종 처리할 항목을 하나 이상 선택해 주세요.");
      return;
    }

    const payloadList: HitlOverrideRequest[] = [];
    for (const id of Array.from(selectedIds)) {
      const task = tasks.find((t) => t.id === id);
      if (!task) continue;

      const decision = decisions[id] || "APPROVE_DOWNGRADE";
      const targetGrade = grades[id] || "NORMAL";
      const rawReason = reasons[id];
      const reasonList: string[] = Array.isArray(rawReason)
        ? (rawReason as any)
        : (rawReason ? [rawReason as any] : []);
      const primaryReasonCode = reasonList.join(",");
      const comment = comments[id] || "관리자 HITL 최종 결재 승인";

      payloadList.push({
        ticketId: id,
        decision,
        targetGrade: decision === "REJECT_RETURN" || decision === "RE_CHECK" ? "REJECT" : targetGrade,
        primaryReasonCode,
        reasonComment: comment,
        defectCoordinates: task.agent_logs?.defect_coordinates || [],
        reviewDurationMs: Math.floor((Date.now() - pageEnterTime.current)),
        // 검수자가 고친 판정. 백엔드가 이 목록으로 감점을 재산정한다.
        excludedDefectIndexes: bboxEdits[id]?.excluded ?? [],
        adoptedCandidateIndexes: bboxEdits[id]?.adopted ?? [],
        editedBboxes: Object.entries(bboxEdits[id]?.edited ?? {}).map(([index, bbox]) => ({
          index: Number(index),
          ...bbox,
        })),
      });
    }

    try {
      const res = await adminAPI.submitHitlOverrides(payloadList);
      const timeNow = new Date().toLocaleTimeString();
      const firstPayload = payloadList[0];
      const summaryInfo = `총 ${payloadList.length}건 데이터베이스 오버라이드 승인 완료 (처분: ${firstPayload?.decision || 'APPROVE'}, 목표등급: ${firstPayload?.targetGrade || 'B'}, 사유: ${firstPayload?.primaryReasonCode || 'CLEAN'})`;

      // 1. 하단 실시간 모니터링 로그에 누적 기록
      setPipelineLogs((prev) => [
        {
          time: timeNow,
          agent: "Human Node (HITL) 👤",
          text: `🚀 [HITL 최종 결재 승인 성공] ${summaryInfo}`,
          type: "success",
        },
        ...prev,
      ]);

      // 2. 브라우저 alert 대신 고급 승인 완료 토스트 메시지 렌더링
      setApprovalToast(`🚀 [HITL 최종 결재 승인 완료] ${summaryInfo}`);
      setTimeout(() => setApprovalToast(null), 4500);

      setSelectedIds(new Set());
      fetchTasks();
    } catch (err: any) {
      console.error("Batch submit failed:", err);
      const timeNow = new Date().toLocaleTimeString();
      setPipelineLogs((prev) => [
        {
          time: timeNow,
          agent: "Human Node (HITL) 👤",
          text: `❌ [HITL 결재 처리 실패] ${err?.response?.data?.message || err?.message}`,
          type: "error",
        },
        ...prev,
      ]);
      setApprovalToast(`❌ 처리에 실패했습니다. (${err?.response?.data?.message || err?.message})`);
      setTimeout(() => setApprovalToast(null), 4500);
    }
  };

  return (
    <div className="w-full max-w-[1920px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Top Banner Header (admin/inspections, admin/inventory 등 다른 관제 페이지와 동일 패턴) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-bold font-mono flex items-center gap-1">
              <ShieldIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> HUMAN-IN-THE-LOOP OVERRIDE CONSOLE
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">Supervisor 이관 건 수동 결재</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShieldIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            HITL 예외 검수 대시보드
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
            Supervisor가 자동 확정이 부적절하다고 판단해 이관한 건(HITL_REQUIRED)을 관리자가 직접 검증하여 최종 승인/반려/등급을 확정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchTasks}
            disabled={loading}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-extrabold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" />
            선택 {selectedIds.size}건 최종 결재 제출
          </button>
        </div>
      </div>

      {/* HITL 대기열 누적 경보 (시스템 설정의 임계값과 실연동) */}
      {tasks.length >= alertThreshold && (
        <div className="flex items-center gap-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-2xl px-5 py-3.5 shadow-xs animate-in fade-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 animate-pulse" />
          <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
            HITL 승인 대기열 누적 경보 — 대기 <strong className="font-mono text-sm">{tasks.length}</strong>건이
            설정 임계값(<strong className="font-mono">{alertThreshold}건</strong>)에 도달했습니다. 결재 지연 시 입고 리드타임에 영향을 줍니다.
          </p>
        </div>
      )}

      {/* Summary Cards (검수 처리 내역 KPI 카드와 동일 패턴) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`bg-white dark:bg-gray-900 p-5 rounded-2xl border shadow-xs space-y-1 transition-colors ${
          tasks.length >= alertThreshold
            ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20'
            : 'border-gray-200 dark:border-gray-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>검수 대기 총계</span>
            <AlertTriangle className={`w-4 h-4 ${tasks.length >= alertThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} />
          </div>
          <p className={`text-3xl font-black font-mono ${tasks.length >= alertThreshold ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {tasks.length}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Supervisor 이관 - 관리자 결재 대기 (경보 기준 {alertThreshold}건)
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>선택된 처리 건</span>
            <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-3xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {selectedIds.size}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">체크박스 선택 시 결재 폼 활성화</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold text-gray-500 dark:text-gray-400">
            <span>검색 필터 적용 건</span>
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {filteredTasks.length}<span className="text-sm font-bold text-gray-500 dark:text-gray-400 ml-1">건</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">도서명 / ISBN / Task ID 키워드 필터</p>
        </div>
      </div>

      {/* 결재 규칙 안내 — 이 대기열에 왜 올라왔는지와 무엇을 먼저 볼지 */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <button
          type="button"
          onClick={() => setShowPolicy((v) => !v)}
          className="w-full flex items-center justify-between gap-2 p-5 cursor-pointer"
        >
          <span className="flex items-center gap-2 text-sm font-extrabold text-gray-800 dark:text-gray-100">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            HITL 결재 규칙 · UBCI 등급 기준
          </span>
          <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
            {showPolicy ? '접기 ▲' : '펼치기 ▼'}
          </span>
        </button>

        {showPolicy && (
          <div className="px-5 pb-5 space-y-4">
            <div>
              <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 mb-2">
                자동 이관 규칙 (Supervisor / Critic)
              </p>
              <ul className="space-y-2">
                {HITL_ROUTING_POLICY.map((rule, i) => (
                  <li
                    key={rule.code}
                    className="flex items-start gap-2 text-[11px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5 border border-gray-100 dark:border-gray-800"
                  >
                    <span className="text-amber-500 font-black shrink-0">{i + 1}.</span>
                    <span className="min-w-0">
                      <span className="font-bold text-gray-700 dark:text-gray-200">{rule.title}</span>
                      <span className="ml-1.5 font-mono text-[10px] px-1 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        {rule.code}
                      </span>
                      <span className="block mt-1 leading-snug">{rule.detail}</span>
                      <span className="block mt-1 leading-snug text-blue-600 dark:text-blue-400 font-medium">
                        → {rule.reviewHint}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-black text-gray-600 dark:text-gray-300 mb-2">
                UBCI 등급 기준 (확정 등급 선택 시 참고)
              </p>
              <div className="space-y-1.5">
                {UBCI_GRADE_POLICY.map((p) => (
                  <div
                    key={p.grade}
                    className="grid grid-cols-[7rem_5.5rem_1fr] items-start gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 text-xs"
                  >
                    <span className={`font-black ${p.color}`}>{p.grade}</span>
                    <span className="font-mono font-bold text-gray-700 dark:text-gray-300 tabular-nums">{p.range}</span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug">{p.quality}</p>
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${p.badge}`}>
                        {p.action}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control & Toolbar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="도서명, ISBN, Task ID 검색..."
              className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 dark:bg-gray-800 dark:text-white font-medium"
            />
          </div>

          {/* Master Bulk Setting Toolbar */}
          <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 dark:bg-blue-950/50 p-2 rounded-xl border border-blue-100 dark:border-blue-800 w-full md:w-auto">
            <div className="flex items-center text-xs font-extrabold text-blue-900 dark:text-blue-300 mr-1">
              <Sliders className="w-3.5 h-3.5 mr-1" />
              선택항목 일괄 설정:
            </div>
            <Select value={masterDecision} onValueChange={handleMasterDecisionChange}>
              <SelectTrigger className="h-9 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white w-36">
                <SelectValue>
                  {DECISION_OPTIONS.find((o) => o.value === masterDecision)?.label || masterDecision}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {DECISION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={masterGrade} onValueChange={handleMasterGradeChange}>
              <SelectTrigger className="h-9 text-xs font-bold rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white w-28">
                <SelectValue>
                  {GRADE_OPTIONS.find((o) => o.value === masterGrade)?.label || masterGrade}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                {GRADE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              {masterReasons.map((code) => {
                const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                return (
                  <span
                    key={code}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                  >
                    {meta.label}
                    {masterReasons.length > 1 && (
                      <button
                        type="button"
                        onClick={() => toggleMasterReason(code)}
                        className="hover:text-red-500 font-bold ml-0.5 text-xs leading-none"
                        title="사유 제거"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
              <Select
                onValueChange={(val: string | null) => {
                  if (val && !masterReasons.includes(val)) {
                    setMasterReasons([...masterReasons, val]);
                  }
                }}
              >
                <SelectTrigger className="h-6 w-24 text-[10px] font-bold px-2 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                  <span>+ 사유 선택</span>
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  {REASON_OPTIONS.map((grp) => (
                    <React.Fragment key={grp.group}>
                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                      {grp.items.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-1.5">
                            {masterReasons.includes(opt.value) ? "✓ " : ""}
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={handleApplyMasterSettings}
              disabled={selectedIds.size === 0}
              className="h-9 px-4 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              ⚡ {selectedIds.size > 0 ? `선택 ${selectedIds.size}건 폼에 세팅` : '선택 항목 폼에 세팅'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-black text-gray-900 dark:text-white">
            결재 대기 목록: <strong className="text-blue-600 dark:text-blue-400 font-mono">{filteredTasks.length}</strong>건
          </h2>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">데이터를 불러오는 중...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">대기 중인 검수 건이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 uppercase border-y border-gray-200 dark:border-gray-800 text-xs font-bold">
                <tr>
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      checked={selectedIds.size === filteredTasks.length && filteredTasks.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="py-3.5 px-4 w-20 text-center whitespace-nowrap">이미지</th>
                  <th className="py-3.5 px-4 w-56 whitespace-nowrap">도서 정보 및 바코드</th>
                  <th className="py-3.5 px-4 w-48 whitespace-nowrap">AI 비전 감지 사유</th>
                  <th className="py-3.5 px-4 w-36 whitespace-nowrap">처분 결정 (Decision)</th>
                  <th className="py-3.5 px-4 w-28 whitespace-nowrap">목표 등급</th>
                  <th className="py-3.5 px-4 w-40 whitespace-nowrap">오버라이드 사유</th>
                  <th className="py-3.5 px-4 w-48 whitespace-nowrap">관리자 메모</th>
                  <th className="py-3.5 px-4 w-28 text-center whitespace-nowrap">AI 재검수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {filteredTasks.map((t) => {
                  const isSelected = selectedIds.has(t.id);
                  const hasImage = t.image_urls && t.image_urls.length > 0;
                  const firstImage = hasImage ? t.image_urls[0] : t.cover_image_url;

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        // 재검수 중 붙잡아 둔 행. 목록에서 사라지지는 않지만 지금 값이
                        // 갱신 전이라는 사실은 드러나야 한다.
                        reinspectingIds.has(t.id)
                          ? "bg-purple-50/50 dark:bg-purple-950/30 animate-pulse"
                          : isSelected
                            ? "bg-blue-50/40 dark:bg-blue-950/40"
                            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                        />
                      </td>

                      <td className="p-3">
                        <div
                          className="relative w-14 h-18 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer group shadow-sm flex items-center justify-center"
                          onClick={() => setModalTask(t)}
                          title="클릭하여 원본 이미지 및 결함 박스 확대보기"
                        >
                          <BookCover
                            src={firstImage || t.cover_image_url}
                            title={t.book_title || "도서 제목 미지정"}
                            isbn={t.isbn}
                            className="w-full h-full"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-gray-900 dark:text-white line-clamp-1">{t.book_title || "도서 정보 없음"}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] font-extrabold px-2 py-0.5 rounded shadow-2xs">
                            {(t as any).agent_logs?.lpn_barcode || (t as any).lpn_barcode || `LPN-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${t.id.slice(0, 4).toUpperCase()}`}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">ISBN: {t.isbn || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-gray-400 dark:text-gray-500 font-mono text-[10px]">Task: {t.id.slice(0, 8)}...</span>
                          {t.ubci_score !== undefined && (
                            <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                              UBCI: {t.ubci_score}점
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {(() => {
                          const code = t.agent_logs?.reason_code || t.agent_logs?.primary_reason_code || "DMG_EXT_CRUSH";
                          const meta = REASON_CODE_MAP[code] || {
                            label: code,
                            category: 'AI 감지',
                            color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
                          };
                          return (
                            <div className="space-y-1">
                              {/* 원시 코드([DMG_...]) 노출 대신 검수 처리 내역과 동일한 한글 라벨 필 배지로 표기 */}
                              <span
                                title={`[${code}] ${meta.category}`}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${meta.color}`}
                              >
                                {meta.label}
                              </span>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate" title={t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}>
                                {t.agent_logs?.reason || "Vision Agent 1차 감지 완료"}
                              </p>

                              {/*
                                [신설 2026-08-06] HITL 이관 근거를 검수자에게 노출한다.
                                증거 대조 검증이 결함을 오탐으로 지목하면 Policy가 감점에서 제외하고,
                                그 결과 감점이 0이 되면 Critic이 "결함 N건인데 감점 0점"으로 잡아
                                여기로 보낸다. 이 맥락 없이 결함 목록과 점수만 보면 검수자는
                                "결함 4건인데 왜 100점인가"를 판단할 수 없다.
                              */}
                              {(() => {
                                const logs = t.agent_logs || {};
                                const lines: { label: string; text: string; tone: string }[] = [];
                                const vision: string = logs.vision_text || "";
                                const policy: string = logs.policy_text || "";
                                const critic: string = logs.critic_text || "";

                                if (vision.includes("증거 대조 검증 반려")) {
                                  lines.push({
                                    label: "증거 대조",
                                    text: vision.split("증거 대조 검증 반려 -")[1]?.trim() || vision,
                                    tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900",
                                  });
                                }
                                if (policy.includes("감점 제외")) {
                                  const seg = policy.split("증거 대조 검증에서 오탐으로 지목되어 감점 제외:")[1];
                                  lines.push({
                                    label: "감점 제외",
                                    text: (seg || "").split("|")[0].trim(),
                                    tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900",
                                  });
                                }
                                if (critic.includes("교차 검증 실패")) {
                                  lines.push({
                                    label: "이관 사유",
                                    text: critic.split("불일치 감지:")[1]?.split(".")[0]?.trim() || critic,
                                    tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900",
                                  });
                                }
                                if (lines.length === 0) return null;

                                return (
                                  <div className="pt-1.5 space-y-1">
                                    {lines.map((l) => (
                                      <div
                                        key={l.label}
                                        className={`px-2 py-1 rounded-lg border text-[10px] leading-snug font-semibold ${l.tone}`}
                                      >
                                        <span className="font-black">{l.label}</span> · {l.text}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="p-3">
                        <Select
                          disabled={!isSelected}
                          value={decisions[t.id] || "APPROVE_DOWNGRADE"}
                          onValueChange={(val: any) => setDecisions({ ...decisions, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
                            <SelectValue>
                              {DECISION_OPTIONS.find((o) => o.value === (decisions[t.id] || "APPROVE_DOWNGRADE"))?.label || (decisions[t.id] || "APPROVE_DOWNGRADE")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {DECISION_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-3">
                        <Select
                          disabled={!isSelected || decisions[t.id] === "REJECT_RETURN" || decisions[t.id] === "RE_CHECK"}
                          value={grades[t.id] || "GOOD"}
                          onValueChange={(val: any) => setGrades({ ...grades, [t.id]: val })}
                        >
                          <SelectTrigger className="w-full h-9 text-xs font-bold rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
                            <SelectValue>
                              {GRADE_OPTIONS.find((o) => o.value === (grades[t.id] || "GOOD"))?.label || (grades[t.id] || "GOOD")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {GRADE_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="p-3">
                        {(() => {
                          const rawVal = reasons[t.id];
                          const selectedList: string[] = Array.isArray(rawVal)
                            ? (rawVal as any)
                            : (rawVal ? [rawVal as any] : []);

                          const toggleReasonCode = (codeToToggle: string) => {
                            const current = selectedList.includes(codeToToggle)
                              ? selectedList.filter((c) => c !== codeToToggle)
                              : [...selectedList, codeToToggle];
                            setReasons({ ...reasons, [t.id]: current.join(", ") });
                          };

                          return (
                            <div className="flex flex-wrap items-center gap-1.5 min-w-[210px]">
                              {selectedList.length === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                                  [CLEAN] 결함 없음 (정상)
                                </span>
                              ) : (
                                selectedList.map((code) => {
                                  const meta = REASON_CODE_MAP[code] || { label: code, color: "bg-gray-100 text-gray-700 border-gray-200" };
                                  return (
                                    <span
                                      key={code}
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-all ${meta.color}`}
                                    >
                                      {meta.label}
                                      {isSelected && (
                                        <button
                                          type="button"
                                          onClick={() => toggleReasonCode(code)}
                                          className="hover:text-red-600 dark:hover:text-red-400 font-bold ml-1 text-xs leading-none p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                          title="AI 감지 사유 삭제/수정"
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </span>
                                  );
                                })
                              )}
                              <Select
                                disabled={!isSelected}
                                onValueChange={(val: string | null) => {
                                  if (val && !selectedList.includes(val)) {
                                    setReasons({ ...reasons, [t.id]: [...selectedList, val].join(", ") });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-6 w-20 text-[10px] font-bold px-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-dashed border-purple-300 dark:border-purple-800">
                                  <span>+ 사유 추가</span>
                                </SelectTrigger>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {REASON_OPTIONS.map((grp) => (
                                    <React.Fragment key={grp.group}>
                                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800">{grp.group}</div>
                                      {grp.items.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          <span className="flex items-center gap-1.5">
                                            {selectedList.includes(opt.value) ? "✓ " : ""}
                                            {opt.label}
                                          </span>
                                        </SelectItem>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })()}
                      </td>

                      <td className="p-3">
                        <Input
                          disabled={!isSelected}
                          placeholder="사유 작성 (선택)"
                          value={comments[t.id] || ""}
                          onChange={(e) => setComments({ ...comments, [t.id]: e.target.value })}
                          className="h-9 text-xs font-medium rounded-xl bg-gray-50/50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white"
                        />
                      </td>

                      <td className="p-3 text-center">
                        <button
                          className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-extrabold rounded-xl transition-all text-xs flex items-center gap-1 shadow-2xs active:scale-95 whitespace-nowrap cursor-pointer disabled:opacity-50 mx-auto"
                          onClick={() => handleTriggerAiReinspect(t.id)}
                          disabled={reinspectingIds.has(t.id)}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          {reinspectingIds.has(t.id) ? "재검수 중..." : "AI 재검수"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Multi-Agent 파이프라인 실시간 처리 로그 (Bottom Panel) */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded-lg text-purple-600 dark:text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Multi-Agent 파이프라인 실시간 처리 로그
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" /> Live Stream
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Detector(YOLO) ➔ Vision(GPT-4o) ➔ Policy ➔ Critic ➔ Supervisor ➔ Report ➔ Human Node(HITL)
              </p>
            </div>
          </div>
          <Button size="xs" variant="ghost" className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800" onClick={handleClearLogs}>
            로그 초기화
          </Button>
        </div>

        {/* 재고 상세의 파이프라인 진단 기록과 동일한 라이트/다크 겸용 로그 패널 스타일 */}
        <div className="bg-gray-50/70 dark:bg-gray-800/60 text-gray-700 dark:text-gray-200 p-4 rounded-xl text-xs space-y-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700">
          {pipelineLogs.length === 0 ? (
            <div className="text-gray-400 dark:text-gray-500 italic text-center py-4">대기 중인 Multi-Agent 로그가 없습니다. [AI 재검수] 실행 시 실시간 스트리밍됩니다.</div>
          ) : (
            pipelineLogs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 py-1 border-b border-gray-200/70 dark:border-gray-700/60 last:border-0">
                <span className="text-gray-400 dark:text-gray-500 font-mono text-[11px] min-w-[65px]">[{log.time}]</span>
                <span className="font-bold text-purple-700 dark:text-purple-400 min-w-[120px]">{log.agent}</span>
                <span className={`flex-1 leading-relaxed ${log.type === "success" ? "text-emerald-700 dark:text-emerald-400" : log.type === "warning" ? "text-amber-700 dark:text-amber-300" : "text-gray-700 dark:text-gray-300"}`}>
                  {log.text}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* HITL Image BBox Modal */}
      {modalTask && (
        <HitlImageModal
          task={modalTask}
          onClose={() => setModalTask(null)}
          edits={bboxEdits[String(modalTask.id)] ?? EMPTY_BBOX_EDITS}
          onEditsChange={(next) =>
            setBboxEdits((prev) => ({ ...prev, [String(modalTask.id)]: next }))
          }
        />
      )}

      {/* Multi-Agent AI Re-inspection Live Modal */}
      {activeReinspectionTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                  <Sparkles className="w-6 h-6 text-purple-300 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold flex items-center gap-2">
                    Multi-Agent AI 비전 실시간 재검수 파이프라인
                  </h3>
                  <p className="text-xs text-purple-200 mt-0.5">
                    대상 LPN: <span className="font-mono font-bold text-yellow-300">{activeReinspectionTask.lpn}</span> ({activeReinspectionTask.title})
                  </p>
                </div>
              </div>
              {activeReinspectionTask.isDone && (
                <button
                  onClick={() => setActiveReinspectionTask(null)}
                  className="text-purple-200 hover:text-white text-xl font-bold p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Stepper Progress */}
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  { step: 1, label: "Vision 👁️", desc: "VLM 2차검증+4o-mini예비" },
                  { step: 2, label: "Policy ⚖️", desc: "사내WMS룰+B2B평가" },
                  { step: 3, label: "Critic 🛡️", desc: "프로세스/루프검증" },
                  // HITL이 Report보다 앞이다. Supervisor가 HITL로 이관하면 그래프는
                  // human_node에서 끝나고, 보증서(Report)는 관리자 결재가 확정된 뒤에야
                  // 생성된다. 종전 순서(Report → HITL)는 실제 흐름과 반대였다.
                  { step: 4, label: "HITL 👤", desc: "관리자결재" },
                  { step: 5, label: "Report 📋", desc: "디지털품질보증서" },
                ].map((s) => {
                  const isActive = activeReinspectionTask.step >= s.step;
                  const isCurrent = activeReinspectionTask.step === s.step;

                  return (
                    <div
                      key={s.step}
                      className={`p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? "bg-purple-50 dark:bg-purple-950 border-purple-500 text-purple-700 dark:text-purple-300 font-extrabold ring-2 ring-purple-500/20"
                          : isActive
                          ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 text-emerald-700 dark:text-emerald-300"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400"
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{s.desc}</div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (activeReinspectionTask.step / 5) * 100)}%` }}
                />
              </div>

              {/* Live Terminal Stream */}
              <div className="bg-gray-950 text-gray-100 p-5 rounded-xl font-mono text-xs sm:text-sm space-y-3 h-64 overflow-y-auto border border-gray-800 shadow-inner">
                {activeReinspectionTask.logs.map((log, i) => (
                  <div key={i} className="leading-relaxed border-b border-gray-900/60 pb-1.5 last:border-none">
                    {log}
                  </div>
                ))}
                {!activeReinspectionTask.isDone && (
                  <div className="text-purple-400 animate-pulse flex items-center gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Multi-Agent 비전 텐서 및 룰 엔진 계산 중...
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 dark:bg-gray-800/80 px-6 py-4 flex items-center justify-between border-t border-gray-200 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {activeReinspectionTask.isDone
                  ? "✅ Multi-Agent 비전 재검수 완료 (PostgreSQL DB 동기화 완료)"
                  : "⏳ 비전 검수 파이프라인 가동 중..."}
              </span>
              <Button
                disabled={!activeReinspectionTask.isDone}
                onClick={() => setActiveReinspectionTask(null)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2 rounded-lg"
              >
                {activeReinspectionTask.isDone ? "완료 및 결과 반영" : "재검수 진행 중..."}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Floating Approval Toast Notification */}
      {approvalToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-gray-900 text-white dark:bg-blue-950 dark:text-blue-100 border border-blue-500/30 px-5 py-3.5 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-sans tracking-tight">{approvalToast}</span>
          <button 
            onClick={() => setApprovalToast(null)} 
            className="ml-2 text-gray-400 hover:text-white text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
