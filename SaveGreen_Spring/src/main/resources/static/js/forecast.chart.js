// forecast.chart.js — Chart.js 렌더 모듈(IIFE, 전역/네임스페이스 동시 노출)
(function () {
	// 네임스페이스 보장
	window.SaveGreen = window.SaveGreen || {};
	window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

	/* ---------- Chart.js ---------- */
	// 차트 인스턴스 핸들(단일)
	let energyChart = null;

	// 에너지 막대 + 비용 선 콤보 차트 렌더
	async function renderEnergyComboChart({ years, series, cost }) {
		if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }

		const canvas = document.getElementById('chart-energy-combo');
		if (!canvas) { console.warn('#chart-energy-combo not found'); return; }

		// 기존 차트 제거 (겹침 방지)
		if (Chart.getChart) {
			const existed = Chart.getChart(canvas);
			if (existed) existed.destroy();
		}
		if (energyChart) energyChart.destroy();

		const ctx = canvas.getContext('2d');

		// 애니메이션 타이밍 상수
		const BAR_GROW_MS = 2000;
		const BAR_GAP_MS = 300;
		const POINT_MS = 600;
		const POINT_GAP_MS = 200;

		const labels = (years || []).map(String);
		const bars = Array.isArray(series?.after) ? series.after.slice(0, labels.length) : [];
		const costs = Array.isArray(cost?.saving) ? cost.saving.slice(0, labels.length) : [];
		const n = labels.length;

		// 팔레트
		const BAR_BG = 'rgba(54, 162, 235, 0.5)';
		const BAR_BORDER = 'rgb(54, 162, 235)';
		const LINE_ORANGE = '#F57C00';

		// Y=0 기준에서 애니메이션 시작
		function fromBaseline(ctx) {
			const chart = ctx.chart;
			const ds = chart.data.datasets[ctx.datasetIndex];
			const axisId = ds.yAxisID || (ds.type === 'line' ? 'yCost' : 'yEnergy');
			const scale = chart.scales[axisId];
			return scale.getPixelForValue(0);
		}

		// 전체 타임라인 계산(막대 → 선 포인트 → 선)
		const totalBarDuration = n * (BAR_GROW_MS + BAR_GAP_MS);
		const pointStartAt = totalBarDuration + 200; // 막대 완료 후 200ms 뒤 선 포인트 시작
		const totalPointDuration = n * (POINT_MS + POINT_GAP_MS);
		const lineRevealAt = pointStartAt + totalPointDuration; // 모든 포인트 표시가 끝난 뒤 선 라인 표시

		// 선 데이터셋(비용 절감, 우측 축)
		const lineDs = {
			type: 'line',
			order: 9999,
			label: '비용 절감',
			data: costs,
			yAxisID: 'yCost',
			tension: 0.3,
			spanGaps: false,
			fill: false,
			showLine: false, // 포인트 먼저 나타나고 라인은 나중에 표시
			pointRadius: new Array(n).fill(0), // 포인트도 순차로 등장
			borderWidth: 3,
			borderColor: LINE_ORANGE,
			backgroundColor: LINE_ORANGE,
			pointBackgroundColor: LINE_ORANGE,
			pointBorderWidth: 0,
			// 포인트 애니메이션에 기존 상수 적용
			animations: {
				y: {
					from: fromBaseline,
					duration: POINT_MS,
					delay: (ctx) => {
						if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
						return pointStartAt + ctx.dataIndex * (POINT_MS + POINT_GAP_MS);
					},
					easing: 'easeOutCubic'
				}
			}
		};

		// 막대 데이터셋(에너지 사용량, 좌측 축)
		const barDs = {
			type: 'bar',
			order: 1,
			label: '에너지 사용량',
			data: bars,
			yAxisID: 'yEnergy',
			backgroundColor: BAR_BG,
			borderColor: BAR_BORDER,
			borderWidth: 1,
			// 막대 애니메이션에 기존 상수 적용
			animations: {
				x: { duration: 0 },
				y: {
					from: fromBaseline,
					duration: BAR_GROW_MS,
					delay: (ctx) => {
						if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
						return ctx.dataIndex * (BAR_GROW_MS + BAR_GAP_MS);
					},
					easing: 'easeOutCubic'
				}
			}
		};

		// 선을 항상 맨앞 레이어에 그려주기 위한 플러그인
		const forceLineFront = {
			id: 'forceLineFront',
			afterDatasetsDraw(chart) {
				const idx = chart.data.datasets.indexOf(lineDs);
				if (idx < 0) return;
				const meta = chart.getDatasetMeta(idx);
				if (!meta) return;
				const { ctx } = chart;
				meta.dataset?.draw?.(ctx);
				if (Array.isArray(meta.data)) {
					meta.data.forEach(el => el?.draw && el.draw(ctx));
				}
			}
		};

		// 차트 부제(빌딩명 → 동/지번 → 동 → 연도 → 기본문구)
		const root = document.getElementById('forecast-root');
		const bname = root?.dataset?.bname?.trim() || '';
		const dong  = root?.dataset?.dongName?.trim() || '';
		const lot   = root?.dataset?.lotSerial?.trim() || '';
		const byear = root?.dataset?.builtYear ? parseInt(root.dataset.builtYear, 10) : null;

		let subtitleText = '';
		if (bname) {
			subtitleText = `🏢 ${bname}`;
		} else if (dong && lot) {
			subtitleText = `📍 ${dong} ${lot}`;
		} else if (dong) {
			subtitleText = `📍 ${dong}`;
		} else if (byear) {
			subtitleText = `🗓 사용승인연도 ${byear}년`;
		} else {
			subtitleText = '건물명 미확정';
		}

		// 차트 생성
		energyChart = new Chart(ctx, {
			type: 'bar',
			data: { labels, datasets: [barDs, lineDs] },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: {
					legend: { display: true },
					tooltip: {
						callbacks: {
							label: (ctx) => {
								const isCost = ctx.dataset.yAxisID === 'yCost';
								const val = ctx.parsed?.y ?? 0;
								// nf(v) 포맷터가 전역에 있는 경우 사용, 없으면 toLocaleString
								const fmt = (v) => (typeof nf === 'function' ? nf(v) : Number(v).toLocaleString());
								return `${ctx.dataset.label}: ${fmt(val)} ${isCost ? '원/년' : 'kWh/년'}`;
							}
						}
					},
					title: {
						display: true,
						text: '에너지 / 비용 예측',
						padding: { top: 8, bottom: 4 }
					},
					subtitle: {
						display: !!subtitleText,
						text: subtitleText,
						padding: { bottom: 8 },
						color: '#6b7280',
						font: { size: 12, weight: '600' }
					},
					forceLineFront: {}
				},
				elements: { point: { hoverRadius: 5 } },
				scales: {
					yEnergy: {
						type: 'linear',
						position: 'left',
						ticks: { callback: (v) => (typeof nf === 'function' ? nf(v) : Number(v).toLocaleString()) },
						title: { display: true, text: '에너지 사용량 (kWh/년)' }
					},
					yCost: {
						type: 'linear',
						position: 'right',
						grid: { drawOnChartArea: false },
						ticks: { callback: (v) => (typeof nf === 'function' ? nf(v) : Number(v).toLocaleString()) },
						title: { display: true, text: '비용 절감 (원/년)' }
					},
					x: {
						title: { display: false }
						// 모든 연도 라벨 표시를 원하면 주석 해제
						// ticks: { autoSkip: false }
					}
				}
			},
			plugins: [forceLineFront]
		});

		// 포인트를 순차로 나타나게 하고, 마지막에 라인을 표시
		for (let i = 0; i < n; i++) {
			const delay = pointStartAt + i * (POINT_MS + POINT_GAP_MS);
			setTimeout(() => {
				lineDs.pointRadius[i] = 3;
				energyChart.update('none');
			}, delay);
		}

		setTimeout(() => {
			barDs.animations = false;   // 막대 애니메이션 종결
			lineDs.showLine = true;     // 라인 표시
			energyChart.update('none');
		}, lineRevealAt + 50);

		// 외부 디버깅용 핸들
		window.energyChart = energyChart;
	}

	// 전역/네임스페이스에 노출(기존 호출부 그대로)
	window.renderEnergyComboChart = renderEnergyComboChart;
	window.SaveGreen.Forecast.renderEnergyComboChart = renderEnergyComboChart;
})();
