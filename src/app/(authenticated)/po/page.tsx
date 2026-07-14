'use client';

import { ShoppingCart, CheckCircle2, Clock, AlertTriangle, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poService } from '@/services/po.service';

export default function PurchaseOrderPage() {
  const queryClient = useQueryClient();

  const { data: poList = [], isLoading } = useQuery({
    queryKey: ['poList'],
    queryFn: poService.getSuggestedPOs,
  });

  const approveMutation = useMutation({
    mutationFn: (poId: string) => poService.approvePO({ poIds: [poId] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poList'] });
    },
  });

  const handleApprove = (poId: string) => {
    if (confirm('해당 발주를 승인하시겠습니까?')) {
      approveMutation.mutate(poId);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">자동 발주 현황 (Auto PO)</h1>
          <p className="text-gray-500 text-sm mt-1">AI가 감지한 재고 부족 현상에 대해 시스템이 자동으로 생성한 발주 요청서입니다.</p>
        </div>
        <button className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center transition-colors shadow-md shadow-purple-200">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          대기중인 발주 일괄 승인
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900">2건</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">긴급 발주 요망 (안전 재고 이탈)</p>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mb-3">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900">5건</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">발주 승인 대기중</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col justify-center items-center text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900">12건</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">금주 발주 완료</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">시스템 제안 발주 목록</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              자동 발주 제안 목록을 분석 중입니다...
            </div>
          ) : poList.length === 0 ? (
            <div className="p-12 text-center text-gray-400">현재 제안된 발주 건이 없습니다.</div>
          ) : (
            poList.map((order, i) => (
              <div key={order.id} className="p-5 hover:bg-blue-50/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-md ${
                      order.urgency === 'HIGH' ? 'bg-red-100 text-red-800' :
                      order.urgency === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {order.urgency === 'HIGH' ? '긴급' : order.urgency === 'MEDIUM' ? '보통' : '여유'}
                    </span>
                    <span className="text-sm font-mono text-gray-500 font-medium">{order.id}</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-gray-900">{order.book} <span className="text-sm font-medium text-gray-500 ml-2">{order.author}</span></h3>
                  <div className="flex items-center mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <FileText className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                    <span className="font-medium">발주 사유: </span>
                    <span className="ml-1">{order.reason}</span>
                  </div>
                </div>
                
                <div className="flex items-center md:flex-col md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 min-w-[120px]">
                  <div className="text-left md:text-right mb-0 md:mb-3">
                    <p className="text-xs text-gray-500 font-medium">제안 수량</p>
                    <p className="text-2xl font-black text-gray-900">{order.qty}<span className="text-sm text-gray-500 font-medium ml-1">권</span></p>
                  </div>
                  
                  {order.status === 'WAITING' ? (
                    <button 
                      onClick={() => handleApprove(order.id)}
                      disabled={approveMutation.isPending}
                      className="bg-white border-2 border-purple-500 text-purple-600 hover:bg-purple-50 font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {approveMutation.isPending ? '처리중...' : '승인하기'}
                    </button>
                  ) : (
                    <span className="flex items-center text-sm font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4 mr-1" /> 승인 완료
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
