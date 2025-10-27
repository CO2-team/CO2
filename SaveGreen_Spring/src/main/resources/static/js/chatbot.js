const chatbotData = {
  root: {
    text: "무엇이 궁금하신가요?",
    options: [
      { text: "시뮬레이터", next: "simulator" },
      { text: "세금 감면 정책", next: "tax" },
      { text: "시뮬레이터 산출 계산식", next: "calc" }
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
    text: "재산세, 취득세, 인증비용, 용적률 증가에 대한 기준입니다. 기준은 에너지등급, ZEB인증 등급에 따라 달라집니다.",
    options: [
      { text: "에너지등급", next: "energyGrade" },
      { text: "ZEB등급", next: "ZEBGrade" },
      { text: "처음으로", next: "root" }
    ]
  },
  energyGrade: {
    text: "재산세 기준<br> - 1+++등급 10%감면<br> - 1++등급 9%감면<br> - 1+등급 5%감면<br> - 1등급 3%감면<br> 그 이하는 0%입니다.<br><br>취득세 기준 <br> - 1+++등급 10%감면<br> - 1++등급 9%감면<br> - 1+등급 7%감면<br> - 1등급 3%감면<br> 그 이하는 0%입니다.<br><br> 용적률 증가 기준<br> - 1+++등급 14% 증가<br> - 1++등급 12% 증가<br> - 1+등급 6% 증가 <br> - 1등급 3% 증가<br>그 이하는 0%입니다. <br><br> 에너지등급은 인증감면 혜택이 없습니다. ",
    options: [
      { text: "이전으로", next: "tax" },
      { text: "처음으로", next: "root" }
    ]
  },

  ZEBGrade: {
    text: ".",
    options: [
      { text: "이전으로", next: "tax" },
      { text: "처음으로", next: "root" }
    ]
  },

  calc: {
    text: "시뮬레이터 계산에 사용된 변수입니다.",
    options: [
      { text: "일사량", next: "solarRadiation" },
      { text: "패널 발전량", next: "panelGeneration" },
      { text: "전기세, 탄소배출계수", next: "referenceValue" },
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
