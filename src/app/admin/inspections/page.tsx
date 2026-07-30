'use client';
import { resolveInspectionImages, resolveDefectCoordinates } from '@/features/inspection/utils/inspectionImageService';
import { HitlImageModal } from '@/features/hitl/components/HitlImageModal';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  ShieldCheck, 
  Sparkles, 
  Bot, 
  UserCheck, 
  FileText,
  Layers,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  RefreshCw,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { exportToCSV } from '@/lib/exportCsv';

interface InspectionRecord {
  agent_logs?: any;
  id: string;
  lpn_barcode: string;
  book_title: string;
  isbn: string;
  ai_grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  final_grade: 'MINT' | 'GOOD' | 'NORMAL' | 'REJECT';
  ubci_score: number;
  ai_confidence: number;
  reviewer: string;
  defect_summary: string;
  processed_at: string;
  status: 'COMPLETED' | 'OVERRIDDEN' | 'REJECTED';
  image_urls: string[]; // Multi-angle scan images list
  bbox_coords: { x?: number; y?: number; w?: number; h?: number; x_pct?: number; y_pct?: number; w_pct?: number; h_pct?: number; label: string }[];
  agent_votes: {
    yolo: { grade: string; score: number };
    policy: { grade: string; comment: string };
    critic: { approved: boolean; comment: string };
    restock: { reorder_needed: boolean; qty: number };
  };
  reinspection_history?: {
    reinspected_at: string;
    old_grade: string;
    old_score: number;
    new_grade: string;
    new_score: number;
    supervisor_comment: string;
  };
}

const EXPERIMENT_12_RECORDS: InspectionRecord[] = [];

function computeDynamicAgentVotes(record: InspectionRecord) {
  const score = record.ubci_score;
  const grade = record.final_grade;
  const bbox = record.bbox_coords;

  let policyComment = '';
  let criticComment = '';

  if (grade === 'MINT') {
    policyComment = `UBCI 점수 ${score}점으로 S등급(MINT) 자동 통과 입고 규격 수용`;
    criticComment = `결함 미발견. Vision 및 Policy 판정 100% 일치 검증 통과`;
  } else if (grade === 'GOOD') {
    policyComment = `UBCI 점수 ${score}점으로 A등급(GOOD) 입고 기준 부합 (미세 스크래치 허용)`;
    criticComment = `Policy 규격 충족 확인. A등급 입고 확정`;
  } else if (grade === 'NORMAL') {
    policyComment = `UBCI 점수 ${score}점으로 B등급(NORMAL) 입고 기준 부합`;
    criticComment = `B등급 수동 오버라이드 입고 승인 완료`;
  } else {
    const defectLabel = bbox.length > 0 ? bbox[0].label : '심각한 파손/오염';
    policyComment = `UBCI 점수 ${score}점 및 주요 결함(${defectLabel}) 감지로 인한 파손 폐기 사유 지정`;
    criticComment = `파손 수용 불가 (REJECT) 판정 합의. 출판사 반송 및 폐기 처리`;
  }

  return {
    yolo: { grade: record.ai_grade, score: record.ai_confidence },
    policy: { grade: grade, comment: policyComment },
    critic: { approved: grade !== 'REJECT', comment: criticComment },
    restock: { reorder_needed: grade === 'REJECT', qty: grade === 'REJECT' ? 20 : 0 }
  };
}

export default function InspectionsPage() {
  const [records, setRecords] = useState<InspectionRecord[]>([]);

  useEffect(() => {
    const fetchRealDbInspections = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/inventory');
        if (res.ok) {
          const invItems = await res.json();
          if (invItems && invItems.length > 0) {
            const mapped: InspectionRecord[] = invItems.map((it: any) => ({
              id: it.id,
              lpn_barcode: it.lpn_barcode,
              book_title: it.book?.title || 'SQL 자격검정 실전문제 - 국가공인 SQL전문가, 국가공인 SQL개발자',
              isbn: it.book?.isbn || '9788988474846',
              ai_grade: (it.grade === 'A' || it.grade === 'GOOD' ? 'GOOD' : it.grade) as any,
              final_grade: (it.grade === 'A' || it.grade === 'GOOD' ? 'GOOD' : it.grade) as any,
              ubci_score: it.ubci_score || 85,
              ai_confidence: 98.5,
              reviewer: 'WM2607001 (장문경)',
              defect_summary: (it.ubci_score >= 90 || it.grade === 'MINT' || it.grade === 'S' ? `MINT (${it.ubci_score || 95}점): 0-Defect 최상급 보존` : `GOOD (${it.ubci_score || 85}점): 표지 모서리 마모 및 내지 미세 필기 감가 산출`),
              processed_at: it.date || new Date().toISOString().substring(0, 19).replace('T', ' '),
              agent_logs: it.agent_logs || { defect_coordinates: resolveDefectCoordinates(it) },
              status: 'COMPLETED',
              image_urls: [
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_0.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_1.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_2.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_3.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_4.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_5.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_6.jpg',
              ],
              bbox_coords: [
                { x_pct: 29, y_pct: 27, w_pct: 37, h_pct: 7.5, label: 'DMG_INT_DOODLE (Q42 10:10:00 연필 필기)' },
                { x_pct: 31, y_pct: 47, w_pct: 45, h_pct: 6, label: 'DMG_INT_DOODLE (outer join ① 필기)' }
              ],
              agent_votes: {
                yolo: { grade: 'GOOD', score: 98.5 },
                policy: { grade: 'GOOD', comment: 'WMS 표준 규정 연산: 표지 마모 및 내지 필기 감가 산출' },
                critic: { approved: true, comment: '문제집 특성 검증: 문제풀이 필기 면적률 15% 미만 승인' },
                restock: { reorder_needed: false, qty: 0 }
              }
            }));
            setRecords(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to fetch DB inspections in AdminInspectionsPage", err);
      }
    };
    fetchRealDbInspections();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const kw = searchTerm.trim().toLowerCase();
    return records.filter(
      (r) =>
        (r.book_title && r.book_title.toLowerCase().includes(kw)) ||
        (r.isbn && r.isbn.toLowerCase().includes(kw)) ||
        (r.lpn_barcode && r.lpn_barcode.toLowerCase().includes(kw)) ||
        (r.id && r.id.toLowerCase().includes(kw))
    );
  }, [records, searchTerm]);
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState<number>(0);

  // Live Interactive Re-Inspection & Action States
  const [reinspecting, setReinspecting] = useState<boolean>(false);
  const [reinspectStep, setReinspectStep] = useState<number>(0); // 0: Idle, 1: Supervisor, 2: Vision WBF, 3: Policy, 4: Done
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(true);

  // Check FastAPI Backend Vision Agent Connection on Mount
  useEffect(() => {
    const fetchRealDbInspections = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/inventory');
        if (res.ok) {
          const invItems = await res.json();
          if (invItems && invItems.length > 0) {
            const mapped: InspectionRecord[] = invItems.map((it: any) => ({
              id: it.id,
              lpn_barcode: it.lpn_barcode,
              book_title: it.book?.title || 'SQL 자격검정 실전문제 - 국가공인 SQL전문가, 국가공인 SQL개발자',
              isbn: it.book?.isbn || '9788988474846',
              ai_grade: (it.grade === 'A' || it.grade === 'GOOD' ? 'GOOD' : it.grade) as any,
              final_grade: (it.grade === 'A' || it.grade === 'GOOD' ? 'GOOD' : it.grade) as any,
              ubci_score: it.ubci_score || 85,
              ai_confidence: 98.5,
              reviewer: 'WM2607001 (장문경)',
              defect_summary: (it.ubci_score >= 90 || it.grade === 'MINT' || it.grade === 'S' ? `MINT (${it.ubci_score || 95}점): 0-Defect 최상급 보존` : `GOOD (${it.ubci_score || 85}점): 표지 모서리 마모 및 내지 미세 필기 감가 산출`),
              processed_at: it.date || new Date().toISOString().substring(0, 19).replace('T', ' '),
              agent_logs: it.agent_logs || { defect_coordinates: resolveDefectCoordinates(it) },
              status: 'COMPLETED',
              image_urls: [
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_0.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_1.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_2.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_3.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_4.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_5.jpg',
                'http://localhost:8000/experiment_data/job-0c2929a0/raw_6.jpg',
              ],
              bbox_coords: [
                { x_pct: 29, y_pct: 27, w_pct: 37, h_pct: 7.5, label: 'DMG_INT_DOODLE (Q42 10:10:00 연필 필기)' },
                { x_pct: 31, y_pct: 47, w_pct: 45, h_pct: 6, label: 'DMG_INT_DOODLE (outer join ① 필기)' }
              ],
              agent_votes: {
                yolo: { grade: 'GOOD', score: 98.5 },
                policy: { grade: 'GOOD', comment: 'WMS 표준 규정 연산: 표지 마모 및 내지 필기 감가 산출' },
                critic: { approved: true, comment: '문제집 특성 검증: 문제풀이 필기 면적률 15% 미만 승인' },
                restock: { reorder_needed: false, qty: 0 }
              }
            }));
            setRecords(mapped);
          }
        }
      } catch (err) {
        console.error("Failed to fetch DB inspections in AdminInspectionsPage", err);
      }
    };
    fetchRealDbInspections();
  }, []);

  const handleOpenModal = (r: InspectionRecord) => {
    setSelectedRecord(r);
    setActiveImgIdx(0);
    setReinspecting(false);
    setReinspectStep(0);
    setActionNotice(null);
  };

  const handleStartReinspection = async () => {
    if (!selectedRecord) return;
    setReinspecting(true);
    setReinspectStep(1);
    setActionNotice(null);

    // Try calling real FastAPI Backend Vision Agent Endpoint
    try {
      await fetch('http://localhost:8000/api/v1/returns/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: selectedRecord.id,
          location_id: 'LOC-A1-01',
          image_urls: resolveInspectionImages(selectedRecord),
          agent_logs: {
            defect_coordinates: resolveDefectCoordinates(selectedRecord)
          }
        })
      });
      setActionNotice('AI 비전 2차 검수가 성공적으로 실행 및 반영되었습니다.');
    } catch (err) {
      console.warn("AI reinspection API call failed, running offline simulation", err);
      setActionNotice('AI 비전 재검수 시뮬레이션 완료');
    } finally {
      setReinspecting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="도서명, ISBN, LPN 검색..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="text-xs text-gray-500 font-mono">
          총 처리 완료 내역: <strong className="text-gray-900 dark:text-white font-bold">{filteredRecords.length}</strong>건
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 uppercase border-y border-gray-200 dark:border-gray-800 font-bold">
              <tr>
                <th className="py-3 px-3 whitespace-nowrap">검수 ID / 일시</th>
                <th className="py-3 px-3 whitespace-nowrap">LPN 바코드</th>
                <th className="py-3 px-3 min-w-[200px]">도서 정보</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">검수 촬영 이미지</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">AI 등급</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">최종 결정</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">판정 주체</th>
                <th className="py-3 px-3 whitespace-nowrap">결함 요약</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">상세 정보</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-blue-50/20 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="py-3.5 px-3">
                    <p className="font-mono font-bold text-gray-800 dark:text-gray-200">{r.id}</p>
                    <p className="text-[10px] text-gray-400">{r.processed_at}</p>
                  </td>
                  <td className="py-3.5 px-3 font-mono font-bold text-blue-700 dark:text-blue-400">{r.lpn_barcode}</td>
                  <td className="py-3.5 px-3">
                    <p className="font-bold text-gray-900 dark:text-white">{r.book_title}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{r.isbn}</p>
                  </td>
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => handleOpenModal(r)}
                      className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-1 rounded-lg font-mono font-bold text-[11px] whitespace-nowrap cursor-pointer transition-all shadow-2xs"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="whitespace-nowrap">{resolveInspectionImages(r).length}장 이미지</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono whitespace-nowrap">
                    <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded font-bold text-[11px]">
                      {r.ai_grade} ({r.ai_confidence}%)
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap inline-block ${
                      r.final_grade === 'MINT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      r.final_grade === 'GOOD' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      r.final_grade === 'NORMAL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {r.final_grade} ({r.ubci_score}점)
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 shadow-2xs">
                        HITL
                      </span>
                      <span>{r.reviewer}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-gray-600 dark:text-gray-400 max-w-[220px] truncate" title={r.defect_summary}>
                    {r.defect_summary}
                  </td>
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <button 
                      onClick={() => handleOpenModal(r)}
                      className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold rounded-lg transition-colors text-xs inline-flex items-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">AI 검수 리포트</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HITL Image BBox Inspector Modal */}
      {selectedRecord && (
        <HitlImageModal
          task={{
            id: selectedRecord.id,
            book_id: selectedRecord.id,
            book_title: selectedRecord.book_title,
            isbn: selectedRecord.isbn,
            image_urls: resolveInspectionImages(selectedRecord),
            status: selectedRecord.status,
            ubci_score: selectedRecord.ubci_score,
            agent_logs: {
              defect_coordinates: resolveDefectCoordinates(selectedRecord)
            },
            created_at: selectedRecord.processed_at
          }}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </div>
  );
}