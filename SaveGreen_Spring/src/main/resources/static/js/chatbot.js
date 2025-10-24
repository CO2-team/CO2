document.addEventListener('click', function(e) {
  // 챗봇 아이콘 클릭
  if (e.target.closest('.chatbot')) {
    const botWindow = document.querySelector('.chatbot-window');
    botWindow.classList.toggle('hidden');
    console.log("💬 챗봇 토글됨");
  }

  // 챗봇 닫기 버튼 클릭
  if (e.target.closest('.chatbot-close')) {
    const botWindow = document.querySelector('.chatbot-window');
    botWindow.classList.add('hidden');
  }
});



const chatbotData = {
  root: [
    { text: "시뮬레이터 사용법", next: "simulator" },
    { text: "세금 감면 정책 안내", next: "tax" },
    { text: "에너지 효율 등급 설명", next: "grade" },
    { text: "태양광 발전량 계산법", next: "solar" }
  ],

  simulator: [
    { text: "시뮬레이터는 어떤 구조인가요?", answer: "좌측은 현재 에너지 상태를, 우측은 태양광 시뮬레이션을 보여줍니다. 주소 입력 → 면적 → 패널 수를 입력하면 결과를 확인할 수 있습니다." },
    { text: "패널 개수를 모르면 어떻게 하나요?", answer: "패널 수를 모르면 면적만 입력해도 자동으로 추정합니다. 평균 3.3m²당 1패널 기준입니다." },
    { text: "처음으로", next: "root" }
  ],

  tax: [
    { text: "어떤 세금이 감면되나요?", answer: "재산세, 취득세, 인증비용, 용적률 증가에 대한 감면율이 계산됩니다." },
    { text: "감면율은 어떻게 결정되나요?", answer: "건물의 에너지 효율 등급과 ZEB 등급에 따라 자동으로 결정됩니다." },
    { text: "처음으로", next: "root" }
  ],

  grade: [
    { text: "에너지 등급은 어떻게 나뉘나요?", answer: "1+++, 1++, 1+, 1, 2, 3, 4, 5, 6, 7 순이며 숫자가 높을수록 효율이 낮습니다." },
    { text: "ZEB 등급은요?", answer: "ZEB는 '+', 1, 2, 3, 4, 5 등급으로 '+'가 최고 효율입니다." },
    { text: "처음으로", next: "root" }
  ],

  solar: [
    { text: "태양광 발전량 계산은 어떻게 하나요?", answer: "일사량 × 효율(0.8) × 패널 출력 × 패널 개수로 계산됩니다. NASA POWER API 데이터를 기반으로 합니다." },
    { text: "패널 1개가 얼마나 발전하나요?", answer: "500Wp 패널 기준, 연간 약 1,200kWh 발전합니다." },
    { text: "처음으로", next: "root" }
  ]
};
