import HistoryDataGrid from "@/features/queue/components/HistoryDataGrid";

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">재고 대기열</h1>
        <p className="text-gray-500">현재 입고 완료 후 적재 대기 중인 재고 내역을 확인합니다.</p>
      </div>
      <HistoryDataGrid />
    </div>
  );
}
