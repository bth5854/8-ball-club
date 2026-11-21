# 8 BALL CLUB — 온라인 당구

## 실행
1. Node.js 18 이상 설치
2. 압축 해제한 폴더에서 터미널 실행
3. `npm install`
4. `npm start`
5. 브라우저에서 `http://localhost:3000` 접속

## 친구 초대
공개 호스팅(Render 등)에 Node 웹 서비스로 배포한 뒤 생성된 URL을 친구에게 공유하세요. 두 사람 모두 같은 URL로 접속하고, 한 명이 방을 만든 뒤 6자리 코드를 보내면 됩니다.

## 현재 구현
- Socket.IO 기반 1:1 실시간 방
- 서버 측 공 이동/충돌/쿠션/포켓 처리
- 솔리드·스트라이프 그룹 배정
- 자기 공을 넣으면 연속 플레이
- 흰 공 포켓 파울 및 상대 공 배치권
- 마지막 8번 공 승패 판정
- 마우스 및 터치 조작

## 참고
이 버전은 친구와 빠르게 즐길 수 있는 간단한 8볼 프로토타입입니다. 공식 대회 규칙 전체(브레이크 규정, 콜샷, 모든 파울 세부 규정, 재배치 세부 절차)를 완전히 구현한 심판용 시뮬레이터는 아닙니다. 방 데이터는 서버 메모리에 보관되므로 서버 재시작 시 방이 초기화됩니다.

## Modern gameplay update
- Shot lock: blocks repeated shot inputs while balls are moving.
- Cue-ball placement guide: explains one-click placement and prevents duplicate placement on the server.
- Local trajectory preview: estimates the cue ball and first object-ball paths while aiming.
- Render optimization: caches the static table layer and batches canvas redraws with requestAnimationFrame.
- Local-only practice panel: appears only on localhost/127.0.0.1; includes max-power practice toggle and trajectory visibility. These controls do not appear on the public Render site.
