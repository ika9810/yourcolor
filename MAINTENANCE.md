# YourColor 운영·복구 안내

기준일: 2026-10-14. 이 문서는 현재 운영 중인 Android 앱과 웹 에디터를 다른 컴퓨터에서 이어받기 위한 안내입니다.

## 운영 중인 서비스

| 대상 | 공개 주소와 소스 | 현재 상태 |
| --- | --- | --- |
| Android | [Google Play](https://play.google.com/store/apps/details?id=com.robotics.yourcolor), [`android/`](android/) | `com.robotics.yourcolor` 2.0.2 / versionCode 6, 2026-10-14 프로덕션 게시 |
| 웹 에디터 | [GitHub Pages](https://ika9810.github.io/yourcolor/), [`docs/`](docs/) | `ika9810/yourcolor` 저장소의 `main:/docs`에서 게시 |
| 개인정보처리방침 | [공개 정책](https://ika9810.github.io/yourcolor-privacy/), [`legal/android-privacy.html`](legal/android-privacy.html) | 별도 공개 저장소 `ika9810/yourcolor-privacy`의 페이지 |

출시 당시의 검토 결과와 해시는 [Android 출시 기록](android/release/RELEASE_CHECKLIST.md)에, 에뮬레이터·빌드 검사 범위는 [검증 기록](android/release/VALIDATION.md)에 있습니다. 스토어 문안은 [한국어](android/release/PLAY_STORE_KO.md)와 [영어](android/release/PLAY_STORE_EN.md) 원본을 사용합니다.

## 다른 컴퓨터에서 시작하기

1. `git clone https://github.com/ika9810/yourcolor.git`으로 소스를 받습니다.
2. 웹은 `docs/`가 배포 원본입니다. 정적 서버로 `docs/`를 열어 상대 경로의 모델·Worker·이미지 로딩을 확인합니다. GitHub Pages 설정은 `main` 브랜치의 `/docs`입니다.
3. Android Studio에서 `android/`를 열고 JDK 17과 Android SDK 36을 준비합니다. `android/README.md`의 실행·검증 명령을 따릅니다.
4. 새 Play 릴리스를 만들 때는 별도 보관한 **업로드 키, 키 비밀번호, `keystore.properties` 설정**을 복원합니다. 형식은 [`android/keystore.properties.example`](android/keystore.properties.example)을 참고합니다. 키와 비밀번호를 GitHub·이슈·로그에 넣지 않습니다.

이 저장소는 서명 키와 비밀번호를 포함하지 않습니다. 저장소 폴더를 삭제해도 GitHub의 소스·문서·공개 자산은 다시 받을 수 있지만, **컴퓨터의 비공개 릴리스 보관함까지 삭제하려면 그 전에 암호화된 별도 백업과 복원 확인이 필요합니다.** Git에서 제외된 APK/AAB, Gradle 캐시, 에뮬레이터 출력물은 소스 또는 Play Console에서 다시 얻거나 생성할 수 있습니다. 최종 검사 결과의 작은 증빙은 [`android/release/evidence/`](android/release/evidence/)에 보관합니다.

## 다음 릴리스

1. 앱 기능과 정책 변경 범위를 확인합니다. 인터넷 권한, 광고·분석 SDK, 계정·서버가 추가되면 개인정보처리방침과 Play 데이터 보안 신고를 함께 다시 검토합니다.
2. `android/app/build.gradle.kts`의 `versionCode`와 `versionName`을 올립니다. 이미 Play에 업로드한 코드는 재사용하지 않습니다.
3. `android/README.md`에 적힌 테스트와 릴리스 빌드를 실행하고, AAB 서명·패키지·버전·번들 내 인증 파일 제외를 확인합니다.
4. 스토어 이미지·문안 및 앱 내 개인정보처리방침과 [공개 정책 저장소](https://github.com/ika9810/yourcolor-privacy)의 내용이 맞는지 확인합니다.
5. Play Console에 업로드·검토 제출 후 프로덕션 버전과 지역별 공개 스토어를 확인하고 출시 기록을 갱신합니다.

## 자료의 경계

- `docs/`는 배포 웹앱입니다. `legacy/`의 2022년 사이트, 실험 시안, 모델 평가는 현재 제품의 소스가 아닙니다.
- Play 업로드 키와 설정, 사용자 사진, 개인 연락처·계정 정보는 공개 저장소 밖에 둡니다. 공개 개발자 문의 주소와 정책 연락처만 문서에 남깁니다.
- 과거 발표 원본과 회의·디자인 계정 화면은 개인정보가 섞여 공개 저장소의 정리본에서 제외했습니다. 보관이 필요하다면 본인 소유의 비공개 저장소에서 관리합니다.
