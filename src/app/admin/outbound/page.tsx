"use client";

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OutboundDashboard() {
  const [mockOrder, setMockOrder] = useState<any>(null);
  const [mockBox, setMockBox] = useState<string>("");

  const handleTestOrder = async () => {
    // 1. 동적 가격 테스트 (주문 생성)
    const orderRes = await fetch("http://localhost:8000/api/v1/orders/?customer_name=TEST_B2B&type=WHOLESALE&list_price=35000&category=Novel&ubci_score=78&days_in_inventory=120", {
      method: "POST"
    });
    const orderData = await orderRes.json();
    setMockOrder(orderData);

    // 2. 3D Bin Packing 테스트 (피킹 출고)
    const books = [
      { category: "Novel", format_size: "신국판", pages: 300, is_color: false, is_hardcover: true },
      { category: "Novel", pages: 400, is_color: false, is_hardcover: false } // 판형 누락 엣지 케이스 (AI Category Fallback 발동)
    ];
    
    const pickRes = await fetch(`http://localhost:8000/api/v1/orders/outbound/pick?order_id=${orderData.order_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(books)
    });
    const pickData = await pickRes.json();
    setMockBox(pickData.recommended_box);
  };

  return (
    <div className="p-8 space-y-8 bg-zinc-950 min-h-screen text-white">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">출고 최적화 대시보드 (AI Outbound)</h1>
          <p className="text-zinc-400 mt-2">Dynamic Pricing 및 3D Bin Packing 알고리즘 모니터링</p>
        </div>
        <Button onClick={handleTestOrder} className="bg-blue-600 hover:bg-blue-700">
          AI 시뮬레이션 가동 (Test)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Dynamic Pricing 섹션 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-emerald-400 flex items-center gap-2">
              <span>🧠 AI 동적 가격 책정 (Dynamic Pricing)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!mockOrder ? (
              <p className="text-zinc-500 text-sm">우측 상단의 시뮬레이션 버튼을 눌러주세요.</p>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800 flex justify-between items-center">
                  <span className="text-zinc-400">기준 매입가 (Category Base Rate 적용)</span>
                  <span className="font-bold">₩{mockOrder.base_b2b_price.toLocaleString()}</span>
                </div>
                <div className="p-4 bg-zinc-950 rounded-lg border border-red-900/50 flex justify-between items-center">
                  <span className="text-zinc-400">AI 방어 할인율 (악성 재고 타겟팅)</span>
                  <Badge variant="destructive" className="text-base">{mockOrder.applied_discount_rate} 할인</Badge>
                </div>
                <div className="p-4 bg-zinc-950 rounded-lg border border-emerald-900/50 flex justify-between items-center">
                  <span className="text-zinc-400">최종 B2B 매출액</span>
                  <span className="font-bold text-xl text-emerald-400">₩{mockOrder.final_price.toLocaleString()}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">* 120일 경과 장기 체류 재고(Novel)에 대해 AI가 악성 재고 처리를 위한 높은 할인율을 자동 배정했습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3D Bin Packing 섹션 */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-blue-400 flex items-center gap-2">
              <span>📦 3D Bin Packing (박스 최적화)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!mockBox ? (
              <p className="text-zinc-500 text-sm">우측 상단의 시뮬레이션 버튼을 눌러주세요.</p>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-6 py-8">
                <div className="text-zinc-400 text-sm text-center">
                  <p>AI가 체적을 분석하여 최적의 박스 규격을 추천했습니다.</p>
                  <p className="text-xs text-zinc-500 mt-1">(판형 정보 누락 시 카테고리 기반 통계 폴백 적용됨)</p>
                </div>
                
                <div className="relative w-48 h-48 border-4 border-dashed border-blue-500/50 rounded-xl flex items-center justify-center bg-blue-950/20">
                  <div className="text-center">
                    <span className="block text-4xl mb-2">📦</span>
                    <span className="text-3xl font-black text-blue-400">{mockBox}</span>
                  </div>
                  {/* 완충재 마진 시각화 */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-blue-300 bg-blue-900/50 px-3 py-1 rounded-full">
                    + 완충재 여유 마진 15% 포함
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
