// forecast.loader.js — ML 로더 전용 모듈(IIFE, 전역/네임스페이스 동시 노출)
(function () {
	window.SaveGreen = window.SaveGreen || {};
	window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

	// 내부 헬퍼(메인 의존 최소화)
	const _rand  = (typeof window.rand  === 'function') ? window.rand  : (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
	const _sleep = (typeof window.sleep === 'function') ? window.sleep : (ms) => new Promise(r => setTimeout(r, ms));

	/* ---------- ML Loader ---------- */
	const LOADER = {
		timer: null,
		stepTimer: null,
		done: false,
		TICK_MS: 200,
		STEP_MIN: 1,
		STEP_MAX: 3,
		STEP_PAUSE_MS: [3000, 3000, 3000, 3000],
		MIN_VISIBLE_MS: 16000,
		cap: 20,                // 20 → 40 → 60 → 80 → 100
		CLOSE_DELAY_MS: 4000,
		startedAt: 0
	};

	// 로더 시작
	function startLoader() {
		LOADER.startedAt = performance.now();
		LOADER.done = false;
		if (LOADER.timer) clearInterval(LOADER.timer);
		if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

		const $bar  = $('#progressBar');
		const steps = $all('.progress-map .step');
		const $text = $('#mlStatusText');
		const labels = {
			1: '데이터 로딩',
			2: '정규화 / 스케일링',
			3: '모델 피팅',
			4: '예측 / 검증',
			5: '차트 렌더링'
		};

		if (!$bar || steps.length < 5 || !$text) {
			console.warn('[loader] required elements missing');
		}

		let progress = 0;
		let level = 1;

		if ($text) $text.textContent = '초기화';
		LOADER.cap = 20;
		LOADER.timer = setInterval(tick, LOADER.TICK_MS);

		function tick() {
			if (LOADER.done) return;
			if (!$bar) return;

			if (progress < LOADER.cap) {
				progress += _rand(LOADER.STEP_MIN, LOADER.STEP_MAX);
				if (progress > LOADER.cap) progress = LOADER.cap;
				$bar.style.width = progress + '%';
				$bar.setAttribute('aria-valuenow', String(progress));
				return;
			}

			if (LOADER.done) return;

			const stepEl = steps[level - 1];
			if (stepEl) stepEl.classList.add('done');
			if ($text) $text.textContent = labels[level] || '진행 중';

			if (level === 5) {
				clearInterval(LOADER.timer);
				return;
			}

			level += 1;
			LOADER.cap += 20;

			clearInterval(LOADER.timer);
			LOADER.stepTimer = setTimeout(() => {
				if (LOADER.done) return;
				LOADER.timer = setInterval(tick, LOADER.TICK_MS);
			}, LOADER.STEP_PAUSE_MS[level - 2] || 0);
		}
	}

	// 로더 최소 표시 시간 보장
	async function ensureMinLoaderTime() {
		const elapsed = performance.now() - LOADER.startedAt;
		const waitMs = Math.max(0, LOADER.MIN_VISIBLE_MS - elapsed);
		if (waitMs > 0) await _sleep(waitMs);
	}

	// 로더 종료
	function finishLoader() {
		return new Promise((res) => {
			LOADER.done = true;
			if (LOADER.timer) clearInterval(LOADER.timer);
			if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

			const bar = $('#progressBar');
			if (bar) {
				bar.style.width = '100%';
				bar.setAttribute('aria-valuenow', '100');
			}
			$all('.progress-map .step').forEach((el) => el.classList.add('done'));
			setTimeout(res, LOADER.CLOSE_DELAY_MS);
		});
	}

	// 전역/네임스페이스 노출(메인 호출부 변경 없이 사용 가능)
	window.LOADER = LOADER;
	window.startLoader = startLoader;
	window.ensureMinLoaderTime = ensureMinLoaderTime;
	window.finishLoader = finishLoader;

	window.SaveGreen.Forecast.LOADER = LOADER;
	window.SaveGreen.Forecast.startLoader = startLoader;
	window.SaveGreen.Forecast.ensureMinLoaderTime = ensureMinLoaderTime;
	window.SaveGreen.Forecast.finishLoader = finishLoader;
})();
