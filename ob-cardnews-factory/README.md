# OB Cardnews Factory v0.1

JSON 카드뉴스 원고를 1080x1920 PNG 카드뉴스, contact sheet, 무음 쇼츠 MP4로 변환하는 최소 구현입니다.

## 로컬 실행

```bash
npm install
npx playwright install chromium
npm run build
```

특정 원고 파일을 렌더링하려면:

```bash
npm run build -- data/sample_fullup.json
```

## 출력

- `output/images/*_card01.png` ~ `card07.png`
- `output/contact/*_contact_sheet.png`
- `output/videos/*_shorts.mp4`
- `output/manifests/*_manifest.json`

## v0.1 범위

- FULL-UP `info` 템플릿 1종 구현
- 과장 표현 금칙어 검증
- PNG 렌더링
- contact sheet 생성
- 무음 MP4 생성
- GitHub Actions artifact 업로드
- `MAKE_CALLBACK_URL`이 있으면 Make로 렌더링 결과 콜백
