function runCompare() {
    var eikEl1 = document.getElementById('eik1');
    var eikEl2 = document.getElementById('eik2');
    var avgEl1 = document.getElementById('average1');
    var avgEl2 = document.getElementById('average2');
    var percent = document.getElementById('percent');

    console.log('runCompare 실행됨');
    console.log('Chart 객체:', window.Chart);
    console.log('캔버스들:', document.getElementById('intensityChart1'), document.getElementById('intensityChart2'), document.getElementById('intensityChart3'));
    console.log(percent);
    if (!eikEl1 && !eikEl2) return;
    if (!avgEl1 && !avgEl2) return;

    var eikStr = '';
    if (eikEl1 && eikEl1.value !== '') {
    eikStr = eikEl1.value;
    } else if (eikEl2 && eikEl2.value !== '') {
    eikStr = eikEl2.value;
    }
    var avgStr = '';
    if (avgEl1 && avgEl1.value !== '') {
    avgStr = avgEl1.value;
    } else if (avgEl2 && avgEl2.value !== '') {
    avgStr = avgEl2.value;
}
    var percent = Number(percent.value);
    if(!percent)return;

    var eik = Number(eikStr);
    var avg = Number(avgStr);
    const BM = document.getElementById('buildingMonthly');
    const CM = document.getElementById('categoryMonthly');
    BMlist = JSON.parse(BM.value);
    CMlist = JSON.parse(CM.value);
    if(!BMlist||!CMlist){
        console.log('차트 빔');
        return;
    }
    if (isNaN(eik) || isNaN(avg)) return;

    var delta = eik - avg;
    var deltaPct;
    if (avg === 0) {
        deltaPct = 0;
    } else {
        deltaPct = (delta / avg) * 100;
    }

    var absEl = document.getElementById('deltaAbs');
    if (absEl) {
        absEl.textContent = delta.toFixed(1) + ' kWh/㎡·yr';
    }
    var pctEl = document.getElementById('deltaPct');
    if (pctEl) {
        pctEl.textContent = deltaPct.toFixed(1) + ' %';
    }

    console.log(avg,eik);
    

    //차트js
    var canvas1 = document.getElementById('intensityChart1');
    if (window.__intensityChart1) {
        const chart = window.__intensityChart1;
        chart.data.datasets[0].data = [eik];
        chart.data.datasets[1].data = [avg];
        chart.update();
        } else {
        window.__intensityChart1 = new Chart(canvas1, {
            type: 'bar',
            data: {
            labels: [''],
            datasets: [
                { label: '선택', data: [eik] },
                { label: '평균', data: [avg] }
            ]
            },
            options: {
                responsive: false,
                plugins: { 
                    legend: { display: true },
                    title: { display: true,
                            text: "단위면적당 에너지 사용량 비교" ,
                            font:{size:24},
                            color:'#333'}
                },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
    var canvas2 = document.getElementById('intensityChart2');
    if (canvas2 && window.Chart) {
        if (window.__intensityChart2) {
            const chart = window.__intensityChart2;

            chart.data.datasets[0].data = [percent, 100 - percent];
            chart.update(); 
        }      
        else {
            window.__intensityChart2 = new window.Chart(canvas2, {
            type: 'doughnut',
            data: {
                labels: ['검색 건물'],
                datasets: [{
                data: [percent, 100 - percent],
                backgroundColor: ['#1976D2', '#E0E0E0'],
                borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    title: { 
                        display: true,
                        text: "에너지 사용량 비교 백분율",
                        font: { size: 24 },
                        color: '#333'
                    },
                    tooltip: { enabled: false }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: chart => {
                const {ctx, chartArea: {width, height}} = chart;
                ctx.save();
                ctx.font = 'bold 20px sans-serif';
                ctx.fillStyle = '#333';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`선택 건물은 상위 ${percent}% 입니다`, width / 2, height / 2);
                }
            }]
            });
        }
    }
    var canvas3 = document.getElementById('intensityChart3');
    if (canvas3 && window.Chart) {
         if (window.__intensityChart3) {
            const chart = window.__intensityChart3;

            chart.data.datasets[0].data = BMlist;
            chart.data.datasets[1].data = CMlist;
            chart.update();

            console.log("기존 차트 데이터 업데이트 완료");
            return;
        }
        window.__intensityChart3 = new Chart(canvas3, {
            type: 'line',
            data: {
            labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
            datasets: [
                {
                label: '선택 건물',
                data: BMlist,
                borderColor: '#1976D2',
                borderWidth: 2,
                tension: 0.4,
                fill: false
                },
                {
                label: '비교군 평균',
                data: CMlist,
                borderColor: '#E57373',
                borderDash: [5, 5],
                borderWidth: 2,
                tension: 0.4,
                fill: false
                }
            ]
            },
            options: {
            responsive: false,
            plugins: {
                title: {
                display: true,
                text: '월별 전력 사용 비중 비교(%)',
                font: { size: 24 },
                color: '#333'
                },
                legend: {
                position: 'top',
                labels: { boxWidth: 20, font: { size: 12 } }
                }
            },
            scales: {
                y: {
                beginAtZero: true,
                max: 20,
                ticks: {
                    stepSize: 5,
                    callback: (v) => v + '%'
                },
                title: {
                    display: true,
                    text: '비중(%)'
                }
                },
                x: {
                title: {
                    display: true,
                    text: '월'
                }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutCubic'
            }
            }
        });
    
    }
}



function addNewResultToChart() {
    const solar = Number(document.getElementById('solarRadiation').value);
    const generation = Number(document.getElementById('onePanelGeneration').value);
    const co2 = Number(document.getElementById('onePanelCO2').value);
    const money = Number(document.getElementById('onePanelSaveElectric').value);
    const road = document.getElementById('roadAddr').value || '미상 지역';
    const lat = Number(document.getElementById('lat2').value);
    const lon = Number(document.getElementById('lon2').value);
    const daySolar = Number(document.getElementById('daySolar').value);

    const newData = {
        location: road,
        solarRadiation: solar,
        panelGeneration: generation,
        co2PerPanel: co2,
        taxPerPanel: money,
        lat:lat,
        lon:lon,
        daySolar:daySolar
    };

    addChartData(newData); 
    console.log("차트그리기함수시작");
}

let chartDataList = [];
function addChartData(newData) {
    if (chartDataList.length >= 3) {
        chartDataList.shift();
    }
    chartDataList.push(newData);

    updateSolarEfficiencyChart();
     console.log(chartDataList);
}


function updateSolarEfficiencyChart() {
    var canvas4 = document.getElementById('solarEfficiencyChart');
    
    console.log('누적차트그리기시작');
    console.log('Chart 객체:', window.Chart);
    console.log('canvas', document.getElementById('intensityChart1'));

    if (window.__solarEfficiencyChart) {
        const chart = window.__solarEfficiencyChart;
        chart.data.labels = chartDataList.map(d => d.location);
        chart.data.datasets[0].data = chartDataList.map(d => d.daySolar);
        chart.data.datasets[1].data = chartDataList.map(d => d.panelGeneration);
        chart.data.datasets[2].data = chartDataList.map(d => d.co2PerPanel);
        chart.data.datasets[3].data = chartDataList.map(d => d.taxPerPanel);
        chart.update();
    } else {
        window.__solarEfficiencyChart = new Chart(canvas4, {
            type: 'bar',
            data: {
                labels: chartDataList.map(d => d.location),
                datasets: [
                    { label: '일평균 일사량 (kWh/m²/day)', data: chartDataList.map(d => d.daySolar), backgroundColor: '#81C784' },
                    { label: '패널당 발전량 (kWh)', data: chartDataList.map(d => d.panelGeneration), backgroundColor: '#1976D2' },
                    { label: '패널당 탄소절감 (ton)', data: chartDataList.map(d => d.co2PerPanel), backgroundColor: '#FFB74D' },
                    { label: '패널당 절감액 (만원)', data: chartDataList.map(d => d.taxPerPanel), backgroundColor: '#BDBDBD' }
                ]
            },
            options: {
                responsive: false,
                plugins: { 
                    legend: { display: true },
                    title: { display: true, text: "지역별 패널 효율 비교", font: { size: 20 } }
                },
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}
