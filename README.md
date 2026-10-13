# yourcolor - 나만의 pixel stretch

<p align="center">
  <strong>너의 순간을, 조금 더 길게.</strong><br>
  사진 속 색을 펼쳐 만드는 나만의 픽셀 스트레치.
</p>

<p align="center">
  <img src="android/release-assets/feature-graphic.png" alt="yourcolor — 사진 속 색을 펼쳐 만드는 나만의 픽셀 스트레치" width="100%">
</p>

<p align="center"><a href="https://ika9810.github.io/yourcolor/"><strong>🌐 웹에서 바로 만들기 ↗</strong></a></p>

## 사진 속 색을 펼치면

<table align="center" width="100%">
  <thead>
    <tr>
      <th align="center" width="50%">원본 샘플</th>
      <th align="center" width="50%">yourcolor 결과</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="android/app/src/main/assets/samples/electric-bloom.png" alt="파란 꽃 원본 샘플" width="100%"></td>
      <td align="center"><img src="android/app/src/main/assets/samples/electric-bloom-art.png" alt="꽃의 색을 아래로 펼친 픽셀 스트레치 결과" width="100%"></td>
    </tr>
  </tbody>
</table>

<p align="center">피사체는 앱이 찾고, <strong>방향·길이·모양은 내가 정합니다.</strong></p>

## 앱에서 만들기

<table align="center" width="100%">
  <thead>
    <tr>
      <th align="center" width="33%">01 · 사진 선택</th>
      <th align="center" width="33%">02 · 직접 편집</th>
      <th align="center" width="34%">03 · JPG 저장</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="android/release-assets/screenshots/01-home.png" alt="yourcolor 시작 화면" width="100%"></td>
      <td align="center"><img src="android/release-assets/screenshots/02-editor.png" alt="픽셀 스트레치 방향과 길이를 조절하는 편집 화면" width="100%"></td>
      <td align="center"><img src="android/release-assets/screenshots/06-export.png" alt="완성한 작품을 JPG로 저장하는 화면" width="100%"></td>
    </tr>
  </tbody>
</table>

- **직접 조절** — 위·아래·왼쪽·오른쪽, 직선·펼침·곡선, 길이·시작선·배경.
- **세밀한 마무리** — 피사체 경계를 브러시로 다듬고, 원본을 보존한 채 워터마크 없는 JPG로 저장.
- **기기에서 처리** — 피사체 분리와 편집은 오프라인으로 실행. 계정이나 서버 연결 없이 사용.

## 실행하기

**웹:** [yourcolor 웹 에디터](https://ika9810.github.io/yourcolor/)에서 사진을 고르고 바로 편집하세요. 계정 없이 사용하며 사진은 브라우저에서 처리됩니다.

**Android:** [Google Play](https://play.google.com/store/apps/details?id=com.robotics.yourcolor)에서 설치할 수 있습니다. 소스에서 실행하려면 Android Studio에서 [`android/`](android) 폴더를 열고, Gradle 동기화 후 `app`을 실행하세요. Android 7.0 이상을 지원합니다.

## Google Play

사진 속 색을 펼쳐 작품을 만드는 Android 앱을 [Google Play](https://play.google.com/store/apps/details?id=com.robotics.yourcolor)에서 다운로드하세요.

<a href="https://play.google.com/store/apps/details?id=com.robotics.yourcolor"><img src="img/google-play-badge-ko.png" alt="Google Play에서 yourcolor 픽셀 스트레치 앱 다운로드" height="56"></a>

## 히스토리

이 저장소는 2022년 AI 퍼스널 컬러 진단 웹 서비스 「**너의 퍼스널 컬러는**」에서 시작했습니다. 원래 웹 버전은 [`index.html`](index.html)에 남아 있으며, 현재는 픽셀 스트레치 Android 앱과 웹 에디터를 개발하고 있습니다.
