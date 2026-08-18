import codecs

path = 'src/app/admin/inventory/[id]/page.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace hardcoded logs with dynamic agent_logs
content = content.replace('4개 메인 각도 렌즈 스캔 완료 (0-Defect Clean 표지 2장 + 훼손 내지 2장)', '{data.agent_logs?.vision_text || "4개 메인 각도 렌즈 스캔 완료 (기본값)"}')
content = content.replace('상태 감점 감가상각 가중치 적용 ➔ UBCI 최종 {data.ubci_score}점 확정 ({data.grade}급)', '{data.agent_logs?.policy_text || 상태 감점 감가상각 가중치 적용 ➔ UBCI 최종 점 확정 (급)}')
content = content.replace('교차 검증: 산출 점수({data.ubci_score}점) 및 {data.grade}급 등급 분기 조건 검증 통과 (Confidence 99.2%, PostgreSQL DB Verified)', '{data.agent_logs?.critic_text || 교차 검증: 산출 점수(점) 및 급 등급 분기 조건 검증 통과}')
content = content.replace('최종 요약 리포트: "[{data.book.title}] 도서 입고 검수 결과 UBCI {data.ubci_score}점 ({data.grade}급) 정산 승인." (검수일: {data.date})', '{data.agent_logs?.explainer_summary || 최종 요약 리포트: "[] 도서 입고 검수 결과 UBCI 점 (급) 정산 승인."}')

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
