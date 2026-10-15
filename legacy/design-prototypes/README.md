> **최신 전체 UI 제안: [04 — 전체 흐름과 글꼴 선택](README-v4.md)**

# YourColor 디자인 시안 02

> **이전 기능 검토 시안: [03 — 피사체에서 가로·세로로 늘리기](README-v3.md).** 피사체의 가로선·세로선을 네 방향으로 늘리는 직선·펼침·곡선을 실험한다. 아래는 보존한 v2의 구현 기록이다.

2026-10-10. 현재 검토용 산출물은 `yourcolor-design-v2.html`이다. Android 구현 반영 전, 수동 편집의 결과물과 조작감을 확인하는 HTML 프로토타입이다. 이전 시안 `yourcolor-design-v1.html`은 비교용으로 보존했다.

## 이번 사용자 결정

- 자동 구도 생성은 폐기한다. 사용자가 색선을 고르고 스트레치를 직접 만든다.
- yourcolor 로고에도 픽셀 스트레치를 적용한다.
- 눈누에서 찾은 여러 글꼴을 실제 화면에서 비교한다. 최종 글꼴은 아직 선택하지 않았다.
- 모든 샘플 사진을 편집할 수 있어야 한다.
- 두 Photoshop 튜토리얼처럼 크게 펼쳐지는 색 띠와 자유로운 워프를 앱에서 쉽게 만든다.
- 기기 내 처리, 백엔드·사용량 API 비용 없음 조건을 유지한다. 자동 구도 폐기는 피사체 분리 AI까지 금지한다는 의미로 해석하지 않았다.

## 확인한 영상과 반영

1. [NovaDepth Studio — Pixel Stretch Viral Trend Photoshop Tutorial](https://www.youtube.com/watch?v=W0xAd05ZcXY): 0:18 피사체 복제, 0:23 한 줄 선택, 0:33 변형과 늘리기, 0:45 워프. 0:49와 1:03 화면을 직접 확인했다. 자동차 뒤에서 넓게 펼쳐지는 색 띠를 만든다.
2. [Pixel Stretch Effect in Photoshop | Mind Blowing Tutorial!](https://www.youtube.com/watch?v=7nhqaLSy9lM): 0:23 가로 한 줄 선택, 0:31 세로 스트레치, 0:35 양쪽 경계를 휘어 넓히는 자동차 합성 결과를 직접 확인했다.

두 영상의 화면이나 사진은 앱에 복사하지 않았다. 효과 원리를 참고하고 별도 생성 샘플을 사용했다. 펼침은 영상에 직접 대응한다. 물결·리본·직선은 같은 수동 워프를 쉽게 시작하기 위한 제안이다.

## 실제 동작

- 로고: Wanted Sans 글자의 기준선을 유지하고, 첫 번째 `o`에 여러 색의 가로 띠를 입힌 뒤 중앙 1px 열을 옆으로 늘린다. 글자 내부의 빈 공간을 유지한다. 이전에 아래로 흘러내리던 무지개 꼬리 로고는 교체했다. 최종 브랜드 승인은 아직 받지 않은 시안이다.
- 폰트 비교: Wanted Sans, SUIT, 페이퍼로지. 같은 제목과 편집 UI에 즉시 적용된다. 추천은 Wanted Sans이며 확정이 아니다. 세 글꼴과 OFL 라이선스를 HTML 안에 포함한다.
- 사진: 자동차·인물·꽃 샘플 각각 독립 상태 및 실행 취소 이력. 로컬 JPG/PNG/WebP 가져오기, 가져온 사진 재선택. 가져온 사진은 전체가 보이도록 4:5 작업 영역에 맞춘다.
- 색선: 시작점·끝점·중앙 드래그, 위치 슬라이더, 가로/세로 전환. 해당 선의 실제 사진 픽셀을 추출한다.
- 워프: 양쪽 경계를 각각 4개 조절점의 3차 베지어 곡선으로 정의하고, 그 사이에 색 띠를 채운다. 8개 점 드래그, 네 시작 형태, 끝 폭, 방향 회전. 슬라이더만 바꾸는 기존 고정 곡선보다 직접적인 변형이 가능하다.
- 피사체: U²-Net 소형 모델(u2netp)을 ONNX Runtime Web WASM으로 실행한다. 사진을 선택할 때 한 번 분석하고 마스크를 재사용한다. 모델은 별도 Web Worker에서 실행해 편집 UI와 분리한다. 모델 준비/분석/완료/실패 상태, 재시도, 선택 영역 오버레이, 앞으로 합성 켜기/끄기, 보호/지우기 브러시를 제공한다. 모델 결과가 늦게 도착해도 브러시 획과 사용자의 스위치 상태를 유지한다.
- 편집: 원본 비교, 실행 취소/다시 실행, 초기화. 색선과 워프 조절점은 방향키로도 이동한다. Shift+방향키는 큰 간격이다.
- 내보내기: 현재 효과를 1440×1800 JPG로 그린다. 카드·로고·편집점은 저장 이미지에 포함하지 않는다. 직접 다운로드를 시도하고, 브라우저가 자동 다운로드를 처리하지 않으면 `이미지 직접 열기`를 제공한다.
- 사진과 폰트는 로컬/내장 데이터만 사용한다. 모델과 WASM도 이 프로젝트에 포함했다. CSP는 same-origin 파일 읽기와 WebAssembly 실행만 추가 허용한다. 사진 업로드·분석 서버·외부 추론 API는 없다. 로컬 HTTP 서버는 파일만 제공하며 분석은 브라우저에서 실행한다.

## 정직하게 구분할 범위

- 홈의 작품 예시는 사전 제작한 알파 이미지로 그린다. 편집 화면은 샘플과 가져온 사진 모두 실제 모델이 추론한 마스크를 사용한다. 초기 샘플 마스크를 편집용 인식 결과로 재사용하지 않는다.
- u2netp는 320×320 입력의 작은 saliency 모델이다. 머리카락·가느다란 줄기·복잡한 배경·여러 피사체를 정교하게 선택한다고 보장하지 않는다. 오류 보정 브러시가 필요하다. HTML 검증용 선택이며 Android 최종 모델 확정은 아니다.
- 사진을 예쁘게 자동 분석·추천하거나 생성하지 않는다. 샘플 시작값은 수동으로 디자인한 예시다.
- 픽셀 스트레치 엔진은 실제 Canvas 코드다. Photoshop Warp 전체 기능을 그대로 복제한 것은 아니다.
- 미리보기 및 원본 캐시는 960×1200이다. 1440×1800 출력은 원본 해상도 보존/초해상도를 뜻하지 않는다.
- 브라우저 메모리에만 편집 상태를 보관한다. 새로고침하면 사라진다. 프로젝트 저장, 줌, 다중 레이어는 이번 시안에 없다.
- Android 네이티브 코드는 이번 변경에서 수정하지 않았다. V20 속도·실제 터치감·AI 분리 품질은 별도 네이티브 검증이 필요하다.

## 실행과 수정

모델/런타임/Worker 파일이 필요하므로 HTML 단독 file:// 열기 대신 `legacy/design-prototypes/` 전체를 로컬 서버로 제공한다. 저장소 루트에서:

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory legacy/design-prototypes
```

`http://127.0.0.1:8767/yourcolor-design-v2.html`

원본은 `src/v2.html`, `src/v2.css`, `src/v2.js`, `src/segment-worker.mjs`. 수정 후 `python3 legacy/design-prototypes/build_v2.py`로 HTML을 다시 만든다. 빌드에 npm 설치는 필요 없으며, 런타임 파일은 `vendor/`, 모델은 `models/`에 동봉했다. 이 폴더들을 함께 유지해야 한다.

## 출처

- [눈누 Wanted Sans](https://noonnu.cc/font_page/1269) / [원저작자](https://github.com/wanteddev/wanted-sans), commit `02c9b822349c188ada95f9e2d90c2ed18f853235`.
- [눈누 SUIT](https://noonnu.cc/font_page/845) / [원저작자](https://sun.fo/suit/), commit `55118d981336d8fce005eb62888c12c0568ef7b0`.
- [눈누 페이퍼로지](https://noonnu.cc/font_page/1456) / [원저작자](https://freesentation.blog/paperlogyfont), 눈누 제공 woff2 v1.0 링크와 원저작자 OFL 파일.
- 사진 생성 프롬프트와 파일은 `provenance.json`, `assets/`에 기록했다. 새 자동차 사진은 내장 image_gen 도구로 생성한 독립 샘플이다. 앱 실행 중 이미지 생성 API를 호출하지 않는다.

## 검증 기록

- 1280px 데스크톱 / 375px 모바일 폭에서 실제 브라우저 확인. 가로 넘침 없음, 하단 도구가 시스템 바와 겹치지 않도록 수정.
- 폰트 3종 선택 시 실제 computed font-family 변경 확인.
- 자동차·인물·꽃 전환, 홈의 인물 선택, 색선 드래그, 워프 드래그, 브러시 획, 실행 취소/다시 실행 확인. 샘플별 이력 분리 확인.
- 로컬 PNG 가져오기 → 색선 도구 → 워프 → 내보내기 확인.
- Canvas JPEG 데이터를 로컬 파일로 저장해 1440×1800 픽셀 확인. `export-check.jpg`는 가져오기 경로 검증용 파일이다.
- 브라우저 콘솔 오류 없음, JavaScript 문법 검사 통과, 중복 DOM ID 없음. 런타임 에셋은 same-origin으로 동봉했다.
- **제한:** 인앱 브라우저에서 다운로드 이벤트가 확인되지 않았고, 생성된 blob 이미지 링크 열기는 브라우저 보안 정책에 의해 차단됐다. 파일 생성은 확인했지만 인앱 브라우저의 다운로드 완료·직접 열기 성공은 검증하지 못했다. 정책 우회는 시도하지 않았다.
- 최종 화면: `preview-v2.png`, 글꼴 비교: `typography-v2.png`.

## 2026-10-10 피사체 인식 수정 검증

- 내장 브라우저에서 모델 로딩 및 자동차 분리 완료: 첫 실행 약 1.5초. 배경이 있는 일반 JPG(rembg 공식 예제 `girl-1.jpg`)를 파일 선택기로 가져와 인물 분리 완료: 약 1.2초. 모델 준비를 포함한 Worker 처리 시간이며, Mac 측정값이다. V20 성능이나 일반적인 정확도 수치로 해석하지 않는다.
- 일반 JPG의 선택 영역 오버레이에서 인물의 몸통·팔이 선택되고 산 배경은 제외되는 것을 시각 확인했다. 피사체 합성 스위치 전후 Canvas 픽셀이 달라지고, 실행 취소로 복구됨을 확인했다.
- 테스트 이미지는 `/tmp/yourcolor-segmentation-qa/`에만 받았으며 제품 샘플에 포함하지 않았다. 출처: https://github.com/danielgatis/rembg/tree/main/examples . 확인 화면은 `segmentation-import-check.png`.
- 다운로드 경로는 앞서 기록한 브라우저 정책 제한 때문에 이번 수정에서 재시험하지 않았다.

## 분리 모델과 런타임 출처

- [U²-Net 원본](https://github.com/xuebinqin/U-2-Net): Apache-2.0, 라이선스 `models/U-2-Net-LICENSE.txt` 동봉.
- [rembg u2netp 모델 연결 및 전처리](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py): 배포 ONNX 4,574,861 bytes. MD5 `8e83ca70e441ab06c318d82300c84806` 확인. SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`. rembg MIT 라이선스도 동봉했다. JavaScript 전처리를 새로 작성했고, 배경 잔상을 줄이는 soft threshold를 후처리에 추가했다.
- [ONNX Runtime Web 1.22.0](https://www.npmjs.com/package/onnxruntime-web/v/1.22.0): 공식 npm 배포 tarball SHA-512 integrity 검증 후 WASM 전용 모듈과 바이너리만 추출. MIT 라이선스 및 ThirdPartyNotices 동봉. WASM 약 11.2MB, 모델 약 4.6MB. 기기 내 단일 스레드 Worker 실행.
- [배포 문서](https://onnxruntime.ai/docs/tutorials/web/deploy.html): 런타임/모델 동봉 방식. 브라우저 시안은 최신 WASM SIMD 지원 환경을 전제로 하며 Android 7 WebView 지원을 뜻하지 않는다.

- 추가 확인: 꽃·인물 샘플은 각각 약 1.1초에 실제 인식 완료. `segmentation-preview-v2.png`는 인물 샘플에서 모델이 선택한 영역을 표시한 화면이다. 새 로고 산출물은 `assets/yourcolor-wordmark-stretch.png`이며 이전 꼬리 로고 파일은 비교용으로만 남겼다.
