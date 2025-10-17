// function runCompare() {
//     var eikEl1 = document.getElementById('eik1');
//     var eikEl2 = document.getElementById('eik2');
//     var avgEl1 = document.getElementById('average1');
//     var avgEl2 = document.getElementById('average2');
    

//     if (!eikEl1 && !eikEl2) return;
//     if (!avgEl1 && !avgEl2) return;

//     var eikStr = eikEl1 && eikEl1.value !== '' ? eikEl1.value : (eikEl2 ? eikEl2.value : '');
//     var avgStr = avgEl1 && avgEl1.value !== '' ? avgEl1.value : (avgEl2 ? avgEl2.value : '');

//     var eik = Number(eikStr);
//     var avg = Number(avgStr);

//     if (isNaN(eik) || isNaN(avg)) return;

//     var delta = eik - avg;
//     var deltaPct;
//     if (avg === 0) {
//         deltaPct = 0;
//     } else {
//         deltaPct = (delta / avg) * 100;
//     }

//     var absEl = document.getElementById('deltaAbs');
//     if (absEl) {
//         absEl.textContent = delta.toFixed(1) + ' kWh/㎡·yr';
//     }
//     var pctEl = document.getElementById('deltaPct');
//     if (pctEl) {
//         pctEl.textContent = deltaPct.toFixed(1) + ' %';
//     }

//     //차트js
//     var canvas = document.getElementById('intensityChart');
//     if (canvas && window.Chart) {
//         if (window.__intensityChart && typeof window.__intensityChart.destroy === 'function') {
//         window.__intensityChart.destroy();
//         }
//         window.__intensityChart = new window.Chart(canvas, {
//         type: 'bar',
//         data: {
//         labels: ['비교'],
//         datasets: [
//             { label: '선택',  data: [eik] },
//             { label: '평균',  data: [avg] }
//         ]
//         },
//         options: {
//         responsive: false,
//         plugins: { legend: { display: true } },
//         scales: { y: { beginAtZero: true } }
//         }
        
//     });
    
//     }
// }



function runCompare() {
    // 1) 입력 요소 가져오기
    var eikEl1 = document.getElementById('eik1');
    var eikEl2 = document.getElementById('eik2');
    var avgEl1 = document.getElementById('average1');
    var avgEl2 = document.getElementById('average2');

    if (!eikEl1 && !eikEl2) return;
    if (!avgEl1 && !avgEl2) return;

    // 2) 값 문자열 추출 (삼항연산자 대신 if/else로 분기)
    var eikStr = '';
    if (eikEl1 && eikEl1.value !== '') {
        eikStr = eikEl1.value;
    } else if (eikEl2) {
        eikStr = eikEl2.value;
    }

    var avgStr = '';
    if (avgEl1 && avgEl1.value !== '') {
        avgStr = avgEl1.value;
    } else if (avgEl2) {
        avgStr = avgEl2.value;
    }

    // 3) 숫자로 변환 및 유효성 검사
    var eik = Number(eikStr);
    var avg = Number(avgStr);
    if (isNaN(eik) || isNaN(avg)) return;

    // 4) 텍스트 표기용 차이/퍼센트 (기존 로직 유지 가능)
    var delta = eik - avg;
    var deltaPct = 0;
    if (avg !== 0) {
        deltaPct = (delta / avg) * 100;
    }

    // 5) 결과 텍스트 표시 (절대값 권장)
    var absEl = document.getElementById('deltaAbs');
    if (absEl) {
        absEl.textContent = Math.abs(delta).toFixed(1) + ' kWh/㎡·yr';
    }
    var pctEl = document.getElementById('deltaPct');
    if (pctEl) {
        pctEl.textContent = deltaPct.toFixed(1) + ' %';
    }

    // 6) 차트: 중앙(0) 기준으로 "차이만" 좌/우로 뻗는 가로막대
    var canvas = document.getElementById('intensityChart');
    if (!canvas || !window.Chart) return;

    // 기존 차트 제거
    if (window.__intensityChart && typeof window.__intensityChart.destroy === 'function') {
        window.__intensityChart.destroy();
    }

    // 6-1) 차트용 diff: 평균 - 선택 (평균이 더 크면 + → 오른쪽)
    var diff = avg - eik;

    // 6-2) 좌우 대칭 범위 M = max(|eik|, |avg|)
    var M = Math.max(Math.abs(eik), Math.abs(avg));
    if (M === 0) {
        M = 1;
    }

    // 6-3) 방향별 색상 (삼항연산자 대신 if/else)
    var barColor;
    var borderColor;
    if (diff >= 0) {
        barColor = 'rgba(255, 99, 132, 0.6)';   // 오른쪽(평균 > 선택)
        borderColor = 'rgba(255, 99, 132, 1.0)';
    } else {
        barColor = 'rgba(54, 162, 235, 0.6)';   // 왼쪽(선택 > 평균)
        borderColor = 'rgba(54, 162, 235, 1.0)';
    }

    // 6-4) 차트 생성
    window.__intensityChart = new window.Chart(canvas, {
        type: 'bar',
        data: {
            labels: ['차이(평균−선택)'], // 카테고리 1개
            datasets: [{
                label: '차이',
                data: [diff],                 // 핵심: diff 한 값만 사용
                backgroundColor: [barColor],
                borderColor: [borderColor],
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',                   // 가로막대(좌/우로 뻗게)
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            var v = context.raw;
                            var sign;
                            if (v >= 0) {
                                sign = '+';
                            } else {
                                sign = '−';
                            }
                            var abs = Math.abs(v);
                            return ' ' + sign + abs.toLocaleString() + ' (차이)';
                        },
                        afterBody: function () {
                            var lines = [];
                            lines.push('선택: ' + eik.toLocaleString());
                            lines.push('평균: ' + avg.toLocaleString());
                            return lines;
                        }
                    }
                }
            },
            scales: {
                // 가로축(x): -M ~ +M 대칭 + 중앙선(0) 강조
                x: {
                    min: -M,
                    max: +M,
                    grid: {
                        color: function (ctx) {
                            var v = ctx.tick.value;
                            if (v === 0) {
                                return 'rgba(0,0,0,0.8)'; // 중앙선 진하게
                            } else {
                                return 'rgba(0,0,0,0.1)'; // 나머지 연하게
                            }
                        },
                        lineWidth: function (ctx) {
                            var v = ctx.tick.value;
                            if (v === 0) {
                                return 2;
                            } else {
                                return 1;
                            }
                        }
                    },
                    ticks: {
                        // 눈금은 절대값으로 표기
                        callback: function (value) {
                            return Math.abs(value);
                        }
                    }
                },
                // 세로축(y): 카테고리 1개이므로 기본 구성
                y: {
                    ticks: { display: true },
                    grid: { display: false }
                }
            }
        }
    });
}
