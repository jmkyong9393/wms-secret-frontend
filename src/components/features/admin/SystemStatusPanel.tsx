export default function SystemStatusPanel() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">시스템 상태</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Celery Worker Load</span>
            <span className="font-semibold text-gray-800">24%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '24%' }}></div>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">PostgreSQL DB IO</span>
            <span className="font-semibold text-gray-800">45%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: '45%' }}></div>
          </div>
        </div>
        <div className="pt-4 mt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 leading-relaxed">
            현재 모든 파이프라인이 정상 작동 중입니다. 오토스케일링(HPA) 여유 리소스가 충분합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
