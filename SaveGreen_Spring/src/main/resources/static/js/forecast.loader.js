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
      TICK_MS: 120,              // [수정] 진행바 가속
      STEP_MIN: 1,
      STEP_MAX: 3,
      STEP_PAUSE_MS: [1500, 1500, 1500, 1500], // [수정] 단계 사이 대기 단축
      MIN_VISIBLE_MS: 10000,      // [수정] 최소 노출 시간(기존 16000 → 2500ms)
      cap: 20,                   // 20 → 40 → 60 → 80 → 100
      CLOSE_DELAY_MS: 2000,       // [수정] 100% 후 닫힘 지연(기존 4000 → 200ms)
      startedAt: 0
   };

   // 공통 라벨(1~5 단계)
   const LABELS = {
      1: '데이터 로딩',
      2: '정규화 / 스케일링',
      3: '모델 피팅',
      4: '예측 / 검증',
      5: '차트 렌더링'
   };

   // DOM 셀렉터
   function $(s, root = document) { return root.querySelector(s); }
   function $all(s, root = document) { return Array.from(root.querySelectorAll(s)); }

   // [추가] 내부 상태 초기화
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

   // 로더 시작
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

         // 단계 라벨 및 맵핑 처리
         const stepEl = steps[level - 1];
         if (stepEl) stepEl.classList.add('done');
         if ($text) $text.textContent = LABELS[level] || '진행 중';

         if (level === 5) {
            clearInterval(LOADER.timer);
            return;
         }

         level += 1;
         LOADER.cap = Math.min(100, level * 20);

         clearInterval(LOADER.timer);
         LOADER.stepTimer = setTimeout(() => {
            if (LOADER.done) return;
            LOADER.timer = setInterval(tick, LOADER.TICK_MS);
         }, LOADER.STEP_PAUSE_MS[level - 2] || 0);
      }
   }

   // [추가] 외부에서 단계/문구를 직접 동기화하고 싶을 때
   // step: 1~5, text(옵션): 커스텀 라벨
   function setStep(step, text) {
      const s = Math.max(1, Math.min(5, Number(step) || 1));

      const $bar  = $('#progressBar');
      const steps = $all('.progress-map .step');
      const $text = $('#mlStatusText');

      // 내부 자동 타이머 중지 후, 수동 제어
      if (LOADER.timer) clearInterval(LOADER.timer);
      if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

      // 맵 체크 표시
      for (let i = 0; i < steps.length; i++) {
         if (i < s) steps[i].classList.add('done');
         else steps[i].classList.remove('done');
      }

      // 진행바 캡/진행률
      LOADER.cap = s * 20;
      if ($bar) {
         $bar.style.width = LOADER.cap + '%';
         $bar.setAttribute('aria-valuenow', String(LOADER.cap));
      }

      // 라벨
      if ($text) $text.textContent = (text && String(text).trim()) || LABELS[s] || '진행 중';
   }

   // [추가] 상태 문구만 바꾸고 싶을 때
   function setStatus(text) {
      const $text = $('#mlStatusText');
      if ($text && text != null) $text.textContent = String(text);
   }

   // [추가] 모델명 업데이트(칩)
   function setModelName(name) {
      const $model = $('#modelName');
      if ($model && name != null) $model.textContent = String(name);
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

         const $bar = $('#progressBar');
         if ($bar) {
            $bar.style.width = '100%';
            $bar.setAttribute('aria-valuenow', '100');
         }
         $all('.progress-map .step').forEach((el) => el.classList.add('done'));

         setTimeout(res, LOADER.CLOSE_DELAY_MS);
      });
   }

   // [추가] 즉시 닫기(필요 시 사용)
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

   // 전역/네임스페이스 노출(메인 호출부 변경 없이 사용 가능)
   window.LOADER = LOADER;
   window.startLoader = startLoader;
   window.ensureMinLoaderTime = ensureMinLoaderTime;
   window.finishLoader = finishLoader;

   // [추가] 새 API 노출
   window.LOADER.setStep = setStep;
   window.LOADER.setStatus = setStatus;
   window.LOADER.setModelName = setModelName;
   window.LOADER.closeNow = closeNow;

   window.SaveGreen.Forecast.LOADER = LOADER;
   window.SaveGreen.Forecast.startLoader = startLoader;
   window.SaveGreen.Forecast.ensureMinLoaderTime = ensureMinLoaderTime;
   window.SaveGreen.Forecast.finishLoader = finishLoader;

   // [추가] 네임스페이스에 새 API도 같이 노출
   window.SaveGreen.Forecast.setLoaderStep = setStep;
   window.SaveGreen.Forecast.setLoaderStatus = setStatus;
   window.SaveGreen.Forecast.setLoaderModelName = setModelName;
   window.SaveGreen.Forecast.closeLoaderNow = closeNow;
})();
