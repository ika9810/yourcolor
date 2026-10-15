# 보존한 릴리스 검증 증빙

이 폴더는 로컬 빌드 디렉터리를 삭제해도 2026-10-13 **코드 4 (2.0.0)** 출시 검증의 핵심 결과를 읽을 수 있도록 보존한 선별 자료입니다. 코드 6 (2.0.2)에 같은 에뮬레이터 전체 검사를 다시 실행했다는 뜻은 아닙니다.

| 파일 | 확인 내용 |
| --- | --- |
| `api24-final-v4-instrumentation.txt` | Android 7/API 24 기능 검사 |
| `api37-final-v4-instrumentation.txt` | 최신 API 에뮬레이터 기능 검사 |
| `16kb-api36-final-v4-green.txt` | 16KB 페이지 크기 에뮬레이터 최종 통과 |
| `play-v1-to-v4-update.txt` | 공식 Play 서명 앱의 코드 1→4 설치 업데이트와 데이터 보존 |
| `device-profile-results.json`, `yourcolor-profiles-final.log` | 여덟 화면 조건 결과 |
| `screenshots/` | API 24 홈, 16KB API 36 홈, 폴더블 편집 화면의 선별 이미지 |

전체 빌드 로그·APK·AAB·일시적인 에뮬레이터 출력은 생성 파일이며 Git에서 제외합니다. 재현 명령과 검사 범위는 [검증 기록](../VALIDATION.md)에 있습니다.
