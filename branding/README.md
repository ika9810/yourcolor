# 현재 브랜드 자산

- `mark.svg`, `wordmark.png`: 채택한 앱 심볼과 워드마크의 편집 원본.
- `build-assets.cjs`, `build-wordmark.cjs`, `build-feature-graphic.cjs`: Android 스토어 아이콘·기능 그래픽과 웹 파비콘·공유 이미지를 생성하는 스크립트.
- `google-play-badge-ko.png`: 루트 README에서 사용하는 Google Play 배지.

이미 생성된 배포 자산은 `android/release-assets/`, `android/app/src/main/res/`, `docs/assets/`에 있습니다. 생성 스크립트는 `sharp`와 일부 파일에 `@napi-rs/canvas`를 사용합니다. 새 브랜딩을 승인·게시할 때 출력물을 검수한 뒤 앱·웹·스토어를 함께 갱신하세요. 채택 전 시안과 비교 이미지는 [`legacy/branding-explorations/`](../legacy/branding-explorations/)에 보관합니다.
