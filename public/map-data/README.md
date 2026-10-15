# 전국 행정동 이름 데이터

기준일: 2026-07-01. `korea-dong-labels.20260701.geojson`은 동 이름·행정동 코드(`adm_cd2`)·WGS84 대표 좌표만 포함합니다. 읍·면은 제외하며 같은 이름의 다른 행정동은 코드로 구분합니다.

재생성: 저장소 루트에서 `npm run map-labels:generate`. 고정된 원본 커밋과 SHA-256은 함께 저장된 `.meta.json`을 참조하세요. 원본 경계는 다운로드 후 메모리에서 처리하며 정적 배포 파일에 포함하지 않습니다.

여러 영역으로 나뉜 행정동은 구멍을 제외한 면적이 가장 큰 영역을 선택하고, polylabel로 경계 안쪽의 대표 좌표를 계산했습니다. 이름은 원본의 행정동 명칭을 그대로 사용합니다(법정동과 다를 수 있습니다).

본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

팅맵은 위 경계를 동 이름의 대표 좌표로 추가 가공했습니다.

- 원본 이용 조건: https://github.com/vuski/admdongkor/blob/7360288277dfd12d74e54b959c59bdd66f852e3a/LICENSE-DATA
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- 공공누리 제1유형: https://www.kogl.or.kr/info/licenseType1.do
