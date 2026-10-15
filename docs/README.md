# 공개 웹 에디터

이 디렉터리가 [GitHub Pages 웹앱](https://ika9810.github.io/yourcolor/)의 배포 원본입니다. Pages 설정은 `main` 브랜치의 `/docs`입니다. 루트의 `legacy/`는 배포 소스가 아닙니다.

## 구성

- `index.html`, `assets/app.css`: 페이지와 화면 스타일. Open Graph 메타데이터는 `index.html`에 있습니다.
- `src/app.js`, `src/engine.js`: 화면 흐름, 사진 선택, 픽셀 스트레치 편집과 JPG 다운로드.
- `src/segment-worker.mjs`, `models/u2netp.onnx`, `vendor/`: 브라우저 안에서 실행하는 피사체 분리 모델과 ONNX Runtime Web.
- `assets/`: 자체 샘플 사진·작품·마스크·글꼴·공유 미리보기 이미지.
- `licenses/`: 사용한 모델·런타임·글꼴 라이선스.

## 로컬 확인

저장소 루트에서 정적 서버를 시작한 뒤 `http://127.0.0.1:8767/`을 엽니다.

```sh
python3 -m http.server 8767 --bind 127.0.0.1 --directory docs
```

HTML 파일을 직접 열면 Worker·WASM·모델 경로가 정상 동작하지 않을 수 있습니다. 샘플 선택, 사용자 사진 가져오기, 피사체 보정, JPG 저장을 확인하세요.

## 데이터 처리와 게시

선택한 사진과 편집 상태는 브라우저에서 처리하며 업로드 서버·계정이 없습니다. 브라우저 탭을 닫거나 새로고침하면 편집 상태가 사라집니다. 웹 소스를 수정해 `main`에 푸시하면 Pages가 `/docs`를 다시 게시합니다. 모델·런타임·이미지·글꼴의 상대 경로를 유지하고, 배포 후 [공개 페이지](https://ika9810.github.io/yourcolor/)와 공유 미리보기를 확인하세요. Android 개인정보처리방침은 [별도 공개 페이지](https://ika9810.github.io/yourcolor-privacy/)에서 제공합니다.
