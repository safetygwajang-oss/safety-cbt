# 🏭 포스코퓨처엠 CBT

산업안전기사 필기 기출문제 기반 CBT(Computer-Based Test) 웹앱

## 🚀 기술 스택
- Frontend: Vanilla HTML/CSS/JS
- Chart: Chart.js
- Hosting: Cloudflare Pages
- Data: JSON

## 📂 폴더 구조
```
posco-cbt/
├── index.html
├── exam.html
├── result.html
├── css/style.css
├── js/{main,exam,result,storage}.js
└── data/{index.json, YYYY-MM-DD.json}
```

## 🛠️ 로컬 실행
```bash
# 로컬 서버 (파이썬)
python -m http.server 8000
# 또는 VSCode Live Server 확장
```

## 📝 새 회차 추가
1. `data/YYYY-MM-DD.json` 생성 (기존 파일 참고)
2. `data/index.json`에 항목 추가

## 🚢 배포
GitHub push → Cloudflare Pages 자동 배포
