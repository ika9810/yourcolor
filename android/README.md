# YourColor Android · v4

v4 디자인 시안을 옮긴 Kotlin 네이티브 앱입니다. WebView와 백엔드를 사용하지 않습니다. **사진 선택 → 피사체 분리 → 직접 픽셀 스트레치 → 보정 → JPG 저장**을 실행할 수 있습니다.

## 실행

1. Android Studio에서 이 `android` 폴더를 엽니다.
2. Gradle Sync 후 실행 구성 `app`과 연결한 기기를 선택합니다.
3. Run ▶을 누릅니다. 검증용 `YourColor_Test_API37` 및 Android 7.0/API 24 에뮬레이터를 사용할 수 있습니다.

JDK 17, SDK Platform 36, Build Tools 35.0.0을 사용합니다. Gradle daemon JVM 설정은 포함돼 있고, `local.properties`와 서명 파일은 Git에서 제외합니다. LG V20 실기기 시험은 기기를 확보한 뒤 선택적으로 진행합니다.

기존 Play 앱 `com.robotics.yourcolor`의 프로덕션 버전 코드는 1이고 Play App Signing을 사용합니다. 새 앱의 버전 이름은 `2.0.0`입니다. 코드 2·3 AAB는 새 업로드 키로 Play 내부 테스트 초안에 접수됐지만 출시하지 않았습니다. 코드 3에서 발견된 API 24 홈 버튼 잘림을 수정하고 코드 4를 다음 후보로 검증 중입니다. 업로드 키 사용 대기는 끝났고 Play의 Android 개발자 인증은 **등록됨 / 소유권 확인됨**으로 표시됩니다. 키 설정은 Git에서 제외한 `keystore.properties`에 있으며 형식은 `keystore.properties.example`을 참고하세요. 설정 파일이 없으면 릴리스 빌드는 서명 없이 생성됩니다.

- 설치 파일: `app/build/outputs/apk/debug/app-debug.apk`
- 개발 패키지: `com.robotics.yourcolor.dev` — 기존 앱과 함께 설치할 수 있습니다.
- 기본 패키지: `com.robotics.yourcolor`, minSdk 24(Android 7.0), target/compileSdk 36.
- ARM64 / ARMv7를 포함합니다. debug APK는 약 59 MiB입니다. 최종 후보를 만들 때 릴리스 APK·AAB의 서명, 버전 코드 및 계정별 `adi-registration.properties` 부재를 다시 확인합니다.

## 반영한 디자인과 조작

- 확정 문구: “너의 순간을, 조금 더 길게. / 사진 속 색을 펼쳐 만드는 나만의 픽셀 스트레치.”
- 본문·제목은 확정한 페이퍼로지, 로고는 Wanted Sans 800과 실제 글자 열을 늘리는 스트레치 효과를 사용합니다.
- 밝은 회색 배경, 큰 4:5 사진, 둥근 사진 카드, 파란 주요 버튼. iPhone 프레임이나 가짜 상태 표시줄을 넣지 않았습니다.
- 홈 문구는 사진과 하단 버튼 사이에 균형 있게 놓이고, 시작 버튼은 하단 여백 24dp를 유지합니다. 사진을 여는 동안에는 진행 상태와 취소 동작을 별도 화면에 표시하며, 취소하면 사진 선택으로 돌아갑니다.
- 홈의 작품 세 장은 각각 편집할 수 있습니다. 미리 계산한 샘플 작품과 마스크를 함께 넣어 시작 화면에서 AI 초기화를 기다리지 않습니다.
- 내 사진은 **효과 없음**, 사진 선택 화면의 샘플은 **직선·길이 86**으로 시작합니다. 홈의 작품 카드는 완성된 구도를 엽니다. 모델은 피사체 영역만 찾습니다.
- 늘리기: 위·아래·왼쪽·오른쪽, 길이, 시작선. 길이 100은 캔버스 끝까지 도달합니다.
- 모양: 직선·펼침·곡선, 펼치는 정도. 바탕: 원본·먹색·종이색.
- 화살표는 길이, 연두색 점은 시작선입니다. 시작선 선택 모드와 길이 슬라이더도 제공합니다. 원본 비교, 실행 취소·다시 실행을 지원합니다.
- 피사체 다듬기는 **전용 전체 화면**입니다. 영역 추가·지우기, 브러시 크기, 칠하기 취소, 두 손가락 확대·이동, 피사체 앞에 유지. 완료는 적용하고 뒤로는 이번 보정을 버립니다.
- 작은 화면은 큰 사진을 유지하며 스크롤합니다. 넓은 화면은 작품과 도구를 나란히 배치합니다. WindowManager가 구분되는 접힘 영역을 알려주면 그 영역을 피해 배치합니다.

## 사진과 모델

HTML v4와 같은 U²-NetP 모델을 앱 안에 포함했습니다. ONNX Runtime Android 1.24.3 CPU 추론이며 첫 실행부터 네트워크 없이 동작합니다. 앱에 `INTERNET` 권한, Google Play 서비스, 광고 SDK, 분석 SDK, API 키, 자체 서버가 없습니다. 사용량 요금도 없습니다.

모델은 피사체 후보를 찾는 도구이며 모든 사진의 경계를 정확히 분리하지는 못합니다. 머리카락·투명 물체·복잡한 배경은 브러시로 보완할 수 있습니다. 결과가 늦게 도착해도 사용자의 방향·모양·길이를 바꾸지 않습니다.

모델의 RGB 최대값 정규화, ImageNet 평균/표준편차, 320×320 입력과 출력 알파 처리는 HTML과 맞췄습니다. 샘플 캐시는 같은 모델·렌더러로 생성했습니다. 샘플 캐시에 사용자 사진은 포함하지 않으며, 사진으로 모델을 학습하지 않습니다.

- 모델 출처: [rembg u2netp.onnx](https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx)
- SHA-256: `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`
- [U²-Net](https://github.com/xuebinqin/U-2-Net), [ONNX Runtime Java](https://onnxruntime.ai/docs/get-started/with-java.html)
- 모델·런타임·글꼴 라이선스와 샘플 제작 기록: `app/src/main/assets/licenses/`

## 해상도와 저장

EXIF 회전·반전을 먼저 적용하고 같은 중앙 4:5 크롭을 미리보기와 저장에 사용합니다. 옆에 빈 띠를 만들지 않습니다. 원본 파일은 덮어쓰지 않습니다.

미리보기 긴 변은 960px, 앱 메모리 한도가 96 MiB 미만이면 640px입니다. 합성용 마스크 최대 너비는 일반 기기 960px, 낮은 메모리 기기 320px입니다. JPG 출력은 일반 기기 1440×1800px, 낮은 메모리 기기 960×1200px입니다. 작은 원본은 이 크기로 확대되므로 원본 이상의 디테일이 생기지는 않습니다. 저장 포맷은 JPG 품질 95, 워터마크 없음, 원본 EXIF/GPS는 복사하지 않습니다.

Android 10 이상은 `Pictures/YourColor`로 저장합니다. Android 7–9는 시스템 저장 위치 선택창을 사용합니다. 파일 쓰기가 성공한 뒤에만 저장 완료를 표시합니다. 내보내기에 진입한 시점의 조절값·마스크를 고정하여 뒤늦은 모델 결과가 저장 이미지를 바꾸지 않게 했습니다.

사진은 앱 전용 캐시와 메모리에 머무릅니다. 사진 교체·홈 이동·새 앱 세션에서 원본 캐시를 정리하고, 하루 지난 임시 내보내기 JPG는 다음 실행에서 정리합니다. 프로젝트 보관 기능은 없어 **프로세스 종료 뒤 편집 복구는 지원하지 않습니다.** 화면 회전·일반적인 크기 변경에 따른 Activity 재생성은 편집을 유지합니다.

## 검증

```sh
./gradlew :app:assembleDebug :app:assembleDebugAndroidTest :app:testDebugUnitTest :app:lintDebug
# 연결한 에뮬레이터에서 기능 테스트
ANDROID_SERIAL=emulator-5554 ./gradlew :app:connectedDebugAndroidTest
# 화면 크기별 검증; 기존 해상도·밀도·글자 배율을 종료 시 복구
python3 tools/validate_profiles.py emulator-5554
```

검증 결과와 실기기 확인이 필요한 범위는 [검증 기록](../document/android-validation.md)을 확인하세요. 에뮬레이터의 해상도를 맞추는 것은 Samsung One UI, LG 펌웨어, 실제 칩셋 속도 검증과 다릅니다. 새 앱은 아직 프로덕션에 공개되지 않았습니다.
