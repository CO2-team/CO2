// forecast.loader.js — ML 로더 전용 모듈(IIFE, 전역/네임스페이스 동시 노출)
(function () {
	'use strict'; // Strict 모드: 암묵적 전역/삭제불가 속성 삭제 등 실수 방지

	/* =========================================================================
	   네임스페이스 (전역 오염 방지 + 기존 코드와 호환)
	   ========================================================================= */
	window.SaveGreen = window.SaveGreen || {};
	window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

	/* =========================================================================
	   내부 유틸 (메인 의존 최소화)
	   -------------------------------------------------------------------------
	   - _rand: 진행바 가속을 위한 난수
	   - _sleep: 최소 표시시간 보장 등에 사용
	   ========================================================================= */
	const _rand  = (typeof window.rand  === 'function')
		? window.rand
		: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

	const _sleep = (typeof window.sleep === 'function')
		? window.sleep
		: (ms) => new Promise(r => setTimeout(r, ms));

	/* =========================================================================
	   ML Loader 상태/파라미터
	   -------------------------------------------------------------------------
	   - TICK_MS: 진행바 틱 간격 (작을수록 부드럽고 빠름)
	   - STEP_*: 각 틱에서 증가량과 단계 사이 일시 정지 시간
	   - MIN_VISIBLE_MS: 로더 최소 노출 시간 (UX 안정)
	   - CLOSE_DELAY_MS: 100% 후 닫히기까지 지연
	   - cap: 현재 단계 목표 퍼센트 (20 → 40 → 60 → 80 → 100)
	   ========================================================================= */
	const LOADER = {
		timer: null,        // 진행바 setInterval 핸들
		stepTimer: null,    // 단계 전환 setTimeout 핸들
		done: false,        // 외부 종료 플래그
		TICK_MS: 120,       // 진행바 업데이트 간격
		STEP_MIN: 1,        // 틱당 최소 증가치
		STEP_MAX: 3,        // 틱당 최대 증가치
		// 단계 사이 일시 정지(1→2, 2→3, 3→4, 4→5)
		STEP_PAUSE_MS: [1500, 1500, 1500, 1500],

		// UX를 위해 10초 이상은 노출 보장 (너무 번쩍 꺼지는 느낌 방지)
		MIN_VISIBLE_MS: 10000,

		// 100% 도달 후 화면 닫힘 지연 (애니메이션 여유)
		CLOSE_DELAY_MS: 2000,

		// 진행 목표치(각 단계 도달 목표 %)
		cap: 20,
		startedAt: 0
	};

	/* =========================================================================
	   UI 셀렉터 헬퍼
	   ========================================================================= */
	function $(s, root = document) { return root.querySelector(s); }
	function $all(s, root = document) { return Array.from(root.querySelectorAll(s)); }

	/* =========================================================================
	   내부: DOM 초기화 (재시작 대비)
	   -------------------------------------------------------------------------
	   - 진행바 0%로 초기화
	   - 단계 체크 표시 제거
	   - 상태 문구 '초기화'로 설정
	   ========================================================================= */
	function _resetDom() {
		const $bar  = $('#progressBar');
		const steps = $all('.progress-map .step');
		const $text = $('#mlStatusText');

		if ($bar) {
			$bar.style.width = '0%';
			$bar.setAttribute('aria-valuenow', '0');
		}
		if (steps.length) steps.forEach(el => el.classList.remove('done'));
		if ($text) $text.textContent = '초기화';
	}

	/* =========================================================================
	   공개: 로더 시작
	   -------------------------------------------------------------------------
	   - 타이머 초기화 후 tick()으로 진행
	   - 단계별로 cap(목표 %)를 20% 단위로 상향
	   - 단계 라벨은 LABELS를 표시
	   ========================================================================= */
	const LABELS = {
		1: '데이터 로딩',
		2: '정규화 / 스케일링',
		3: '모델 피팅',
		4: '예측 / 검증',
		5: '차트 렌더링'
	};

	function startLoader() {
		LOADER.startedAt = performance.now();
		LOADER.done = false;
		if (LOADER.timer) clearInterval(LOADER.timer);
		if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

		_resetDom();

		const $bar  = $('#progressBar');
		const steps = $all('.progress-map .step');
		const $text = $('#mlStatusText');

		if (!$bar || steps.length < 5 || !$text) {
			console.warn('[loader] 필수 요소가 없습니다 (#progressBar, .progress-map .step×5, #mlStatusText)');
		}

		let progress = 0;
		let level = 1;

		if ($text) $text.textContent = '초기화';
		LOADER.cap = 20;
		LOADER.timer = setInterval(tick, LOADER.TICK_MS);

		function tick() {
			if (LOADER.done) return;
			if (!$bar) return;

			// 현재 목표(cap)까지 틱마다 증가
			if (progress < LOADER.cap) {
				progress += _rand(LOADER.STEP_MIN, LOADER.STEP_MAX);
				if (progress > LOADER.cap) progress = LOADER.cap;
				$bar.style.width = progress + '%';
				$bar.setAttribute('aria-valuenow', String(progress));
				return;
			}

			if (LOADER.done) return;

			// cap 도달 → 단계 완료 체크 + 라벨 업데이트
			const stepEl = steps[level - 1];
			if (stepEl) stepEl.classList.add('done');
			if ($text) $text.textContent = LABELS[level] || '진행 중';

			// 마지막 단계(5)면 틱 종료
			if (level === 5) {
				clearInterval(LOADER.timer);
				return;
			}

			// 다음 단계 준비
			level += 1;
			LOADER.cap = Math.min(100, level * 20);

			// 잠깐 멈췄다가 다음 틱 시작 (체감상 안정)
			clearInterval(LOADER.timer);
			LOADER.stepTimer = setTimeout(() => {
				if (LOADER.done) return;
				LOADER.timer = setInterval(tick, LOADER.TICK_MS);
			}, LOADER.STEP_PAUSE_MS[level - 2] || 0); // level-2: 1→2 첫 휴지시간 인덱스 = 0
		}
	}

	/* =========================================================================
	   공개: 수동 단계 동기화 setStep(step, text?)
	   -------------------------------------------------------------------------
	   - 자동틱을 멈추고 외부 로직(실제 작업 단계)에 맞춰 UI를 즉시 동기화
	   - step: 1~5, text: 커스텀 상태 문구(옵션)
	   ========================================================================= */
	function setStep(step, text) {
		const s = Math.max(1, Math.min(5, Number(step) || 1));

		const $bar  = $('#progressBar');
		const steps = $all('.progress-map .step');
		const $text = $('#mlStatusText');

		// 자동 진행 중지 → 수동 제어
		if (LOADER.timer) clearInterval(LOADER.timer);
		if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

		// 맵 체크 표시
		for (let i = 0; i < steps.length; i++) {
			if (i < s) steps[i].classList.add('done');
			else steps[i].classList.remove('done');
		}

		// 진행바 퍼센트 동기화 (단계×20)
		LOADER.cap = s * 20;
		if ($bar) {
			$bar.style.width = LOADER.cap + '%';
			$bar.setAttribute('aria-valuenow', String(LOADER.cap));
		}

		// 라벨
		if ($text) $text.textContent = (text && String(text).trim()) || LABELS[s] || '진행 중';
	}

	/* =========================================================================
	   공개: 상태 문구만 바꾸기
	   -------------------------------------------------------------------------
	   - 모델명, 네트워크 상태 등 보조 텍스트 교체용
	   ========================================================================= */
	function setStatus(text) {
		const $text = $('#mlStatusText');
		if ($text && text != null) $text.textContent = String(text);
	}

	/* =========================================================================
	   공개: 모델명 칩 업데이트
	   ========================================================================= */
	function setModelName(name) {
		const $model = $('#modelName');
		if ($model && name != null) $model.textContent = String(name);
	}

	/* =========================================================================
	   공개: 최소 표시시간 보장
	   -------------------------------------------------------------------------
	   - startLoader 호출 시점 기록(LOADER.startedAt)과 비교해 부족분만 대기
	   ========================================================================= */
	async function ensureMinLoaderTime() {
		const elapsed = performance.now() - LOADER.startedAt;
		const waitMs = Math.max(0, LOADER.MIN_VISIBLE_MS - elapsed);
		if (waitMs > 0) await _sleep(waitMs);
	}

	/* =========================================================================
	   공개: 로더 정상 종료(애니메이션 완료 → 약간의 지연 후 닫힘)
	   -------------------------------------------------------------------------
	   - 외부에서 실제 작업 완료 후 호출
	   - 내부 플래그/타이머 정리 + 100%로 채우고 닫기
	   ========================================================================= */
	function finishLoader() {
		return new Promise((res) => {
			LOADER.done = true;
			if (LOADER.timer) clearInterval(LOADER.timer);
			if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

			const $bar = $('#progressBar');
			if ($bar) {
				$bar.style.width = '100%';
				$bar.setAttribute('aria-valuenow', '100');
			}
			$all('.progress-map .step').forEach((el) => el.classList.add('done'));

			setTimeout(res, LOADER.CLOSE_DELAY_MS);
		});
	}

	/* =========================================================================
	   공개: 즉시 닫기(비상/스킵)
	   -------------------------------------------------------------------------
	   - 디버그나 사용자가 강제 종료하는 UX에 쓸 수 있음
	   ========================================================================= */
	function closeNow() {
		LOADER.done = true;
		if (LOADER.timer) clearInterval(LOADER.timer);
		if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

		const $bar = $('#progressBar');
		if ($bar) {
			$bar.style.width = '100%';
			$bar.setAttribute('aria-valuenow', '100');
		}
		$all('.progress-map .step').forEach((el) => el.classList.add('done'));
	}

	/* =========================================================================
	   전역/네임스페이스 노출 (기존 코드와의 호환 유지)
	   ========================================================================= */
	window.LOADER = LOADER;
	window.startLoader = startLoader;
	window.ensureMinLoaderTime = ensureMinLoaderTime;
	window.finishLoader = finishLoader;

	// 새 수동 동기화 API도 함께 노출
	window.LOADER.setStep = setStep;
	window.LOADER.setStatus = setStatus;
	window.LOADER.setModelName = setModelName;
	window.LOADER.closeNow = closeNow;

	// SaveGreen 네임스페이스에도 동등 노출 (기존 호출부 그대로 동작)
	window.SaveGreen.Forecast.LOADER = LOADER;
	window.SaveGreen.Forecast.startLoader = startLoader;
	window.SaveGreen.Forecast.ensureMinLoaderTime = ensureMinLoaderTime;
	window.SaveGreen.Forecast.finishLoader = finishLoader;
	window.SaveGreen.Forecast.setLoaderStep = setStep;
	window.SaveGreen.Forecast.setLoaderStatus = setStatus;
	window.SaveGreen.Forecast.setLoaderModelName = setModelName;
	window.SaveGreen.Forecast.closeLoaderNow = closeNow;
})();
