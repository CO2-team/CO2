const chatbotData = {
  root: {
    text: "무엇이 궁금하신가요?",
    options: [
      { text: "시뮬레이터", next: "simulator" },
      { text: "에너지등급과 ZEB", next: "tax" },
      { text: "시뮬레이터 계산 기준", next: "calc" }
    ]
  },


  simulator: {
    text: "에너지 등급 시뮬레이터, 태양광 패널 시뮬레이터 두 가지가 있습니다.",
    options: [
      { text: "에너지 등급 시뮬레이터", next: "simulator_detail_grade" },
      { text: "태양광 패널 시뮬레이터", next: "simulator_detail_solar" },
      { text: "처음으로", next: "root" }
    ]
  },
  simulator_detail_grade: {
    text: "검색된 건물의 에너지 등급을 알 수 있는 시뮬레이터로, 건물 면적, 에너지 사용량, 발전량(태양광 패널 규격, 수량 입력 시)을 고려해 책정된 등급과 그에대한 혜택이 나타납니다.<br> 또,결과 창 아래의 표는 검색된 건물의 에너지 사용량과 월별 사용량을 동일 카테고리의 평균과 비교한 것 입니다.",
    options: [
      { text: "이전으로", next: "simulator" },
      { text: "처음으로", next: "root" }
    ]
  },
  simulator_detail_solar: {
    text: "태양광 패널 시뮬레이터는 건물, 면적, 패널 규격을 입력하면 필요한 패널 수량과 예상 발전량, 탄소절감량을 계산해줍니다.<br> 또, 결과 창 아래의 표는 입력된 결과창 에선 나오지 않는 패널 한 개당 정보를 담고 있으며, 여러 번 검색 시 최대 3개 까지 누적되어 검색된 결과 끼리 비교 할 수 있습니다.",
    options: [
      { text: "이전으로", next: "simulator" },
      { text: "처음으로", next: "root" }
    ]
  },


  tax: {
    text: "에너지 등급과 ZEB등급은 각각의 기준과 정책을 가지고 있습니다. <br><br> 에너지등급 기준은 단위면적당 에너지 사용량입니다(kWh/m²).<br> 1+++등급 : 0~80 <br> 1++등급 : 80~ 140 1+등급 : 140~ 200 <br> 1등급 : 200~ 260 <br> 2등급 : 260~ 320 <br> 3등급 : 320~ 380 <br> 4등급 : 400~ 450 <br> 5등급 : 480~ 520 <br> 6등급 : 560~ 610 <br> 7등급 : 610 이상 <br><br> ZEB등급 기준은 전체 에너지 사용량에 대한 에너지 자립률입니다(%).<br> +등급 : 120% 이상 <br> 1등급 : 100%~120% <br> 2등급 : 80%~100% <br> 3등급 : 60%~80% <br> 4등급 : 40%~60% <br> 5등급 : 20%~40% <br><br> 등급에 대한 정책은 아래에서 확인하세요.",
    options: [
      { text: "에너지등급 정책", next: "energyGrade" },
      { text: "ZEB등급 정책", next: "ZEBGrade" },
      { text: "처음으로", next: "root" }
    ]
  },
  energyGrade: {
    text: "에너지 등급은 단위면적당 에너지 사용량으로 책정됩니다.<br>에너지 등급은 1+++등급부터 7등급까지 있습니다. 1+++등급이 가장 높은 등급입니다.<br>재산세 기준<br> - 1+++등급 10%감면<br> - 1++등급 9%감면<br> - 1+등급 5%감면<br> - 1등급 3%감면<br> 그 이하는 0%입니다.<br><br>취득세 기준 <br> - 1+++등급 10%감면<br> - 1++등급 9%감면<br> - 1+등급 7%감면<br> - 1등급 3%감면<br> 그 이하는 0%입니다.<br><br> 용적률 증가 기준<br> - 1+++등급 14% 증가<br> - 1++등급 12% 증가<br> - 1+등급 6% 증가 <br> - 1등급 3% 증가<br>그 이하는 0%입니다. <br><br> 에너지등급은 인증감면 혜택이 없습니다. ",
    options: [
      { text: "이전으로", next: "tax" },
      { text: "처음으로", next: "root" }
    ]
  },

  ZEBGrade: {
    text: "ZEB등급은 전체 에너지 사용량에 대한 에너지 자립률로 책정됩니다. ZEB등급은 +등급부터 5등급 까지 있습니다. +등급이 가장 높은 등급입니다.<br>재산세 기준<br> - 5등급 15%감면<br> - 4등급 18%감면<br> - 3등급 20%감면<br> - 2등급 20%감면<br> - 1등급 20%감면<br> - +등급 20%감면<br><br>취득세 기준 <br> - 5등급 5%감면<br> - 4등급 10%감면<br> - 3등급 15%감면<br> - 2등급 15%감면<br> - 1등급 15%감면<br> - +등급 15%감면<br><br>용적률 증가 기준<br> - 5등급 11% 증가<br> - 4등급 12% 증가<br> - 3등급 13% 증가<br> - 2등급 14% 증가<br> - 1등급 15%증가<br> - +등급 15% 증가<br><br> 인증비용 감소<br> - 5등급 30% 지원<br> - 4등급 50% 지원<br> - 3등급 100% 지원<br> - 2등급 100% 지원<br> - 1등급 100% 지원<br> - +등급 100% 지원 ",
    options: [
      { text: "이전으로", next: "tax" },
      { text: "처음으로", next: "root" }
    ]
  },

  calc: {
    text: "시뮬레이터 계산에 사용된 변수입니다.",
    options: [
      { text: "연간 일사량", next: "solarRadiation" },
      { text: "연간 패널 발전량", next: "panelGeneration" },
      { text: "전기세, 탄소배출계수", next: "referenceValue" },
      { text: "처음으로", next: "root" }
    ]
  },
  solarRadiation: {
    text: " 연간 일사량 = (일사량) x (연간 일수)입니다. 주소 입력시 해당 지역의 일사량이 NASA API를 통해 들어옵니다. 2025년은 윤년이라 366일로 계산됩니다.",
    options: [
      { text: "이전으로", next: "calc" },
      { text: "처음으로", next: "root" }
    ]
  },
  panelGeneration: {
    text: "연간 발전량 = (일사량) x (연간 일수) x (패널 정격 출력(wp)) x (패널 효율) x (패널 갯수) 로 계산됩니다. 패널 정격 출력은 페이지에서 선택으로 시중에 판매되는 패널 모델을 고를 수 있습니다. 패널 효율은 0.8로 고정되어있습니다.",
    options: [
      { text: "이전으로", next: "calc" },
      { text: "처음으로", next: "root" }
    ]
  },
  referenceValue: {
    text: "연간 전기세 = (연간 발전량) x (2024년 산업시설 일반 전기세)입니다. 현재 산업전기세는 평균 185.5원으로 책정되어있습니다.<br> 연간 탄소절감량 = (연간 발전량) X (2025년 국가탄소배출계수)입니다. 2025년 대한민국의 탄소배출계수는 0.419입니다",
    options: [
      { text: "이전으로", next: "calc" },
      { text: "처음으로", next: "root" }
    ]
  }
};

let currentState = "root";

function renderChatbot(state) {
  const body = document.querySelector('.chatbot-body');
  body.innerHTML = "";

  const data = chatbotData[state];
  if (!data) return;

  const p = document.createElement('p');
  p.innerHTML = data.text;
  body.appendChild(p);

  data.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.classList.add('chatbot-btn');
    btn.innerHTML = opt.text;
    btn.dataset.next = opt.next;
    body.appendChild(btn);
  });

  currentState = state;
}

document.addEventListener('click', function(e) {

  if (e.target.closest('.chatbot')) {
    const win = document.querySelector('.chatbot-window');
    win.classList.toggle('hidden');
    renderChatbot('root'); 
  }


  if (e.target.closest('.chatbot-close')) {
    const win = document.querySelector('.chatbot-window');
    win.classList.add('hidden');
    renderChatbot('root');
  }


  if (e.target.classList.contains('chatbot-btn')) {
    const next = e.target.dataset.next;
    renderChatbot(next);
  }
});


document.addEventListener('DOMContentLoaded', () => {
  renderChatbot('root');
});
