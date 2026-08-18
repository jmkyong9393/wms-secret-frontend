import codecs

path = 'src/app/certificate/[lpn]/page.tsx'
with codecs.open(path, 'r', 'utf-8') as f:
    content = f.read()

# Replace hardcoded defects
replacement = '''            defects: [
              { type: itemData.agent_logs?.suggested_reason || itemData.agent_logs?.policy_text || '정상 (결함 없음)', image: defectImage }
            ]'''
content = content.replace('''            defects: [
              { type: '[감점: -15점] 내지 필기/낙서/밑줄 (수험서 -15점 Cap 적용)', image: defectImage }
            ]''', replacement)

with codecs.open(path, 'w', 'utf-8') as f:
    f.write(content)
