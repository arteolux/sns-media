# 카드뉴스 → 렌더링 → 숏폼 자동화 파이프라인
> 작성일: 2026-06-01
> 목적: Claude 어느 계정에서든 동일하게 작업 가능하도록 세팅 컨텍스트 정리
> 적용 계정: OB (arteolux), cho.mole 등 모든 Claude 세션

---

## 1. 전체 파이프라인 구조

```
[입력] 이미지 파일 첨부 or HTML 파일
        ↓
[STEP 1] playwright → PNG 렌더링 (HTML인 경우)
        ↓
[STEP 2] ffmpeg → 1080×1920 숏폼 MP4 변환
        ↓
[STEP 3] git push → GitHub raw URL 생성
        ↓
[STEP 4] Mirra post_create MCP → 인스타 draft/예약 발행
```

---

## 2. 환경 정보

### Claude 실행 환경
- OS: Ubuntu 24
- 작업 디렉토리: `/home/claude/`
- 업로드 파일 경로: `/mnt/user-data/uploads/파일명.png`
- 출력 파일 경로: `/mnt/user-data/outputs/`

### 설치된 도구
- **playwright** (Python): HTML → PNG 렌더링
- **ffmpeg**: 이미지 → 영상 변환
- **git**: GitHub push

---

## 3. GitHub 레포 정보

| 항목 | 값 |
|---|---|
| 계정 | `arteolux` |
| 레포 | `sns-media` |
| 레포 URL | `https://github.com/arteolux/sns-media` |
| Raw URL 기본 | `https://raw.githubusercontent.com/arteolux/sns-media/main` |
| Token | `ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` |

### 폴더 구조
```
sns-media/
├── silverperro/
│   ├── cards/        ← 카드뉴스 PNG (1080×1080)
│   └── shortform/    ← 숏폼 MP4 (1080×1920)
└── etflux/
    ├── cards/
    └── shortform/
```

### Raw URL 패턴
```
이미지: https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/cards/파일명.png
영상:   https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/shortform/파일명.mp4
```

---

## 4. Mirra AI 계정 ID

| 계정 | 플랫폼 | ID |
|---|---|---|
| silverperro | 인스타그램 | `16efc2b1-4b17-4fcc-a2af-8316c5dbc975` |
| silverperro | 쓰레드 | `ff91a60c-4c7e-4935-8245-9557c58442d2` |
| arteolux (ETFlux) | 인스타그램 | `95bf6654-22eb-42dc-a32e-4c8f723af084` |
| arteolux (ETFlux) | 쓰레드 | `f205f14c-b7d2-47d6-b81a-8fff4e632185` |
| ETFlux | YouTube | `1304c1ed-e66e-4365-8d67-380814e229ca` |

---

## 5. STEP별 실행 코드

### STEP 1 — HTML → PNG 렌더링 (playwright)

```python
from playwright.sync_api import sync_playwright
import os

def render_card(html_path, out_path, width=1080, height=1080):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': width, 'height': height})
        page.goto(f'file://{html_path}')
        page.wait_for_timeout(1500)
        card = page.query_selector('.card')
        if card:
            card.screenshot(path=out_path)
        else:
            page.screenshot(path=out_path, clip={'x':0,'y':0,'width':width,'height':height})
        browser.close()
    print(f'렌더링 완료: {out_path} ({os.path.getsize(out_path):,} bytes)')

# 사용 예시
render_card('/home/claude/sp_card_v4_01.html', '/home/claude/card_01.png')
```

### STEP 1-B — 업로드 이미지 직접 사용 (HTML 없이)

OB가 이미지를 채팅에 첨부한 경우, 렌더링 없이 바로 사용:
```bash
# 업로드된 파일 경로 그대로 사용
INPUT_IMAGE="/mnt/user-data/uploads/파일명.png"
```

### STEP 2 — PNG → 숏폼 MP4 (ffmpeg)

```bash
# 방법: concat 방식 (가장 안정적)
# 인트로 2초 (fade-in)
ffmpeg -y \
  -loop 1 -t 2 -i INPUT.png \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,
       pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#FFFBF5,
       fade=in:st=0:d=0.5" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 2 \
  /home/claude/c1.mp4

# 스크롤 3초 (위→아래 패닝)
ffmpeg -y \
  -loop 1 -t 3 -i INPUT.png \
  -vf "scale=1920:1920,
       crop=1080:1920:'(1920-1080)/2':'min(max(0\,(ih-1920)*t/3)\,ih-1920)'" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 3 \
  /home/claude/c2.mp4

# CTA 아웃트로 1.5초
ffmpeg -y \
  -loop 1 -t 1.5 -i INPUT.png \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,
       pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#1A1A1A,
       fade=in:st=0:d=0.3" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 1.5 \
  /home/claude/c3.mp4

# concat → 최종 숏폼 (총 6.5초)
printf "file '/home/claude/c1.mp4'\nfile '/home/claude/c2.mp4'\nfile '/home/claude/c3.mp4'\n" \
  > /home/claude/concat.txt

ffmpeg -y -f concat -safe 0 -i /home/claude/concat.txt \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  OUTPUT.mp4
```

**출력 스펙:**
- 해상도: 1080×1920 (9:16 세로)
- 길이: 6.5초
- 파일 크기: 약 200~300KB
- 코덱: H.264

### STEP 3 — GitHub push

```bash
# 최초 1회 — 레포 클론 (이미 클론된 경우 생략)
git config --global user.email "arteolux@github.com"
git config --global user.name "arteolux"
git clone https://ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@github.com/arteolux/sns-media.git

# 파일 복사 및 push
cd /home/claude/sns-media
cp /home/claude/card_01.png silverperro/cards/파일명.png
cp /home/claude/shortform.mp4 silverperro/shortform/파일명.mp4
git add .
git commit -m "카드뉴스 업로드 YYYY-MM-DD"
git push origin main
```

**Raw URL 생성 규칙:**
```
https://raw.githubusercontent.com/arteolux/sns-media/main/{계정}/{타입}/{파일명}
```
한글 파일명은 URL 인코딩 필요:
- 기초연금 → `%EA%B8%B0%EC%B4%88%EC%97%B0%EA%B8%88`
- 반려동물병원비 → `%EB%B0%98%EB%A0%A4%EB%8F%99%EB%AC%BC%EB%B3%91%EC%9B%90%EB%B9%84`

또는 파일명을 영어로 저장 권장:
```bash
cp card.png silverperro/cards/gichoyeongeum.png
# URL: .../silverperro/cards/gichoyeongeum.png (인코딩 불필요)
```

### STEP 4 — Mirra 포스팅

```python
# 이미지 포스트 (피드)
post_create(
    socialAccountId="16efc2b1-4b17-4fcc-a2af-8316c5dbc975",  # silverperro 인스타
    content="캡션 텍스트 + 해시태그",
    images=["https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/cards/파일명.png"],
    status="draft"  # 또는 "scheduled" + scheduledAt="2026-06-03T22:17:00Z"
)

# 영상 포스트 (릴스)
post_create(
    socialAccountId="16efc2b1-4b17-4fcc-a2af-8316c5dbc975",
    content="캡션 텍스트 + 해시태그",
    videos=["https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/shortform/파일명.mp4"],
    videoThumbnails=["https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/cards/파일명.png"],
    status="scheduled",
    scheduledAt="2026-06-03T22:17:00Z"  # UTC 기준 (KST -9시간)
)
```

**KST → UTC 변환:**
- KST 07:17 → UTC 22:17 (전날)
- KST 22:17 → UTC 13:17 (당일)

---

## 6. 한 번에 실행하는 전체 스크립트

```bash
#!/bin/bash
# 사용법: ./pipeline.sh INPUT.png 파일명 "캡션" 소셜계정ID "예약시간UTC"
# 예시: ./pipeline.sh /mnt/user-data/uploads/image.png gichoyeongeum "기초연금..." "16efc2..." "2026-06-03T22:17:00Z"

INPUT=$1
FILENAME=$2
CAPTION=$3
ACCOUNT_ID=$4
SCHEDULED_AT=$5

# 숏폼 생성
ffmpeg -y -loop 1 -t 2 -i $INPUT \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#FFFBF5,fade=in:st=0:d=0.5" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 2 /home/claude/c1.mp4

ffmpeg -y -loop 1 -t 3 -i $INPUT \
  -vf "scale=1920:1920,crop=1080:1920:'(1920-1080)/2':'min(max(0\,(ih-1920)*t/3)\,ih-1920)'" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 3 /home/claude/c2.mp4

ffmpeg -y -loop 1 -t 1.5 -i $INPUT \
  -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=#1A1A1A,fade=in:st=0:d=0.3" \
  -c:v libx264 -pix_fmt yuv420p -r 25 -t 1.5 /home/claude/c3.mp4

printf "file '/home/claude/c1.mp4'\nfile '/home/claude/c2.mp4'\nfile '/home/claude/c3.mp4'\n" > /home/claude/concat.txt
ffmpeg -y -f concat -safe 0 -i /home/claude/concat.txt \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart /home/claude/${FILENAME}.mp4

# GitHub push
cd /home/claude/sns-media
git pull origin main
cp $INPUT silverperro/cards/${FILENAME}.png
cp /home/claude/${FILENAME}.mp4 silverperro/shortform/${FILENAME}.mp4
git add .
git commit -m "업로드: ${FILENAME} $(date +%Y-%m-%d)"
git push origin main

echo "완료!"
echo "이미지 URL: https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/cards/${FILENAME}.png"
echo "영상 URL: https://raw.githubusercontent.com/arteolux/sns-media/main/silverperro/shortform/${FILENAME}.mp4"
```

---

## 7. OB 요청 → Claude 실행 패턴

### 패턴 A — HTML 파일로 렌더링
```
OB: "기초연금 카드 6/3 07:17 인스타 예약해줘"
Claude:
  1. /home/claude/sp_card_v4_01.html playwright 렌더링
  2. ffmpeg 숏폼 변환
  3. GitHub push
  4. Mirra 예약 (scheduledAt: 2026-06-02T22:17:00Z)
```

### 패턴 B — 이미지 파일 첨부
```
OB: [이미지 첨부] "이거 숏폼으로 만들어서 6/3 07:17 예약해줘"
Claude:
  1. /mnt/user-data/uploads/파일명.png 직접 사용
  2. ffmpeg 숏폼 변환
  3. GitHub push
  4. Mirra 예약
```

### 패턴 C — 이미지 + 계정 + 시간 지정
```
OB: [이미지] "ETFlux 인스타에 6/5 07:47 릴스로 예약"
Claude:
  1. 이미지 → 숏폼 MP4
  2. GitHub push (etflux/shortform/ 폴더)
  3. Mirra 예약 (socialAccountId: 95bf6654..., scheduledAt: 2026-06-04T22:47:00Z)
```

---

## 8. 주의사항

### 파일명 규칙
- **영어 권장**: 한글 파일명은 URL 인코딩 필요해서 번거로움
- 패턴: `{계정}_{주제}_{날짜}.png` (예: `sp_gichoyeongeum_0603.png`)

### GitHub 용량 제한
- 파일당 100MB 이하 (숏폼 MP4는 보통 200~300KB → 문제 없음)
- 레포 전체 1GB 이하 권장

### KST ↔ UTC 변환표
| KST | UTC |
|---|---|
| 07:00 | 전날 22:00 |
| 07:17 | 전날 22:17 |
| 07:42 | 전날 22:42 |
| 22:17 | 당일 13:17 |
| 22:00 | 당일 13:00 |

### Mirra 이미지 처리
- GitHub raw URL 전달 시 Mirra가 자체 CDN(`storage.mirra.my`)으로 자동 복사
- 외부 URL 만료 걱정 없음

---

## 9. 새 Claude 세션 시작 시 체크리스트

새 세션(cho.mole 등)에서 이 파이프라인을 쓰려면:

```bash
# 1. 레포 클론
git config --global user.email "arteolux@github.com"
git config --global user.name "arteolux"
git clone https://ghp_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX@github.com/arteolux/sns-media.git

# 2. 도구 확인
python3 -c "from playwright.sync_api import sync_playwright; print('playwright ok')"
ffmpeg -version | head -1
git --version

# 3. 테스트 push
cd sns-media && echo "test $(date)" > test.txt && git add . && git commit -m "test" && git push origin main && rm test.txt && git add . && git commit -m "remove test" && git push origin main
```

---

## 10. 현재 GitHub 레포 파일 목록 (2026-06-01 기준)

```
sns-media/
├── README.md
├── silverperro/
│   ├── cards/
│   │   ├── 기초연금.png       (97KB, 1080×1080)
│   │   ├── 반려동물병원비.png  (85KB, 1080×1080)
│   │   └── 노인일자리.png     (96KB, 1080×1080)
│   └── shortform/
│       └── 기초연금.mp4       (241KB, 1080×1920, 6.5초)
└── etflux/
    └── cards/
        ├── 월배당.png         (97KB, 1080×1080)
        └── ETF실수TOP5.png    (97KB, 1080×1080)
```

