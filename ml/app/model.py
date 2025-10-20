# ============================================================
# SaveGreen / app/model.py — 예측 매니저(A/B/C) with auto-ensemble weights
# ------------------------------------------------------------
# [역할]
# - ./data 의 model_A.pkl, model_B.pkl, manifest.json 을 로드해서 /predict 응답.
# - C(앙상블)의 가중치:
#   1) manifest.ensemble.suggested_by_inverse_mae.{wA,wB}  ← 매 학습마다 자동 갱신
#   2) manifest.ensemble.{wA,wB}
#   3) 폴백 0.5 / 0.5
# - 가중치는 항상 합=1.0으로 정규화.
#
# [폴더 정책]
# - 표준 저장소는 프로젝트 루트의 "./data".
# - 과거 혼선을 막기 위해 "./app/data"가 보이면 경고 로그만 찍고 필요 시 참조.
#   (권장: app/data는 삭제하고 ./data로 통일)
# ============================================================

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

try:
	import joblib
	_LOAD = joblib.load
except Exception:
	import pickle
	_LOAD = lambda path: pickle.load(open(path, "rb"))  # noqa: E731

# ---------------------------- 경로 설정 ----------------------------

# 표준 데이터 디렉터리(1순위)
DATA_PRIMARY = "./data"

# 하위호환(가능하면 삭제 권장): app/data 가 남아있을 때만 보조로 조회
DATA_DEPRECATED = "./app/data"

MODEL_A = "model_A.pkl"
MODEL_B = "model_B.pkl"
MODEL_SINGLE = "model.pkl"
MANIFEST = "manifest.json"


def _first_existing_path(*candidates: str) -> Optional[str]:
	"""여러 경로 후보 중 가장 먼저 존재하는 파일 경로 반환."""
	for p in candidates:
		if p and os.path.isfile(p):
			return p
	return None


def _resolve(pathname: str) -> Optional[str]:
	"""
	동일 파일명을 표준 위치(./data)에서 먼저 찾고,
	없을 경우에만 (비권장) ./app/data 에서 찾는다.
	"""
	p1 = os.path.join(DATA_PRIMARY, pathname)
	p2 = os.path.join(DATA_DEPRECATED, pathname)
	found = _first_existing_path(p1, p2)
	if found and found.startswith(DATA_DEPRECATED):
		print(f"[ML][WARN] using deprecated path: {found}  (please move files to {DATA_PRIMARY})")
	return found


# ---------------------------- 데이터 구조 ----------------------------

@dataclass
class Loaded:
	path: str
	pipe: Any


# ---------------------------- ModelManager ----------------------------

class ModelManager:
	def __init__(self) -> None:
		self.A: Optional[Loaded] = None
		self.B: Optional[Loaded] = None
		self.S: Optional[Loaded] = None  # single
		self.manifest: Optional[dict] = None
		self.manifest_path: Optional[str] = None
		self._load_all()

	def _load_all(self) -> None:
		# manifest
		mf = _resolve(MANIFEST)
		if mf:
			self.manifest_path = mf
			try:
				with open(mf, "r", encoding="utf-8") as f:
					self.manifest = json.load(f)
			except Exception as e:
				print(f"[ML][WARN] failed to load manifest: {e!r}")

		# models A/B/SINGLE
		a = _resolve(MODEL_A)
		b = _resolve(MODEL_B)
		s = _resolve(MODEL_SINGLE)

		if a:
			try:
				self.A = Loaded(a, _LOAD(a))
			except Exception as e:
				print(f"[ML][WARN] failed to load A: {a} err={e!r}")
		if b:
			try:
				self.B = Loaded(b, _LOAD(b))
			except Exception as e:
				print(f"[ML][WARN] failed to load B: {b} err={e!r}")
		if s:
			try:
				self.S = Loaded(s, _LOAD(s))
			except Exception as e:
				print(f"[ML][WARN] failed to load SINGLE: {s} err={e!r}")

		if self.A or self.B:
			print(f"[ML] model loaded: A={'ok' if self.A else '-'} B={'ok' if self.B else '-'} manifest={self.manifest_path or '-'}")
		elif self.S:
			print(f"[ML] model loaded: SINGLE={self.S.path}")
		else:
			print("[ML][WARN] no model files found → rule-based fallback")

	def status(self) -> dict:
		return {
			"has_A": bool(self.A),
			"has_B": bool(self.B),
			"SINGLE": self.S.path if self.S else None,
			"manifest": self.manifest_path,
			"ensemble_weights_effective": self._ensemble_weights()
		}

	# ---------------------- public inference ----------------------

	def predict_variant(self, payload: Dict[str, Any], variant: str = "C") -> Dict[str, Any]:
		pct = self._predict_pct(payload, variant=(variant or "C").upper())
		return self._finalize(payload, pct, variant)

	def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
		# backward-compat: C로 동작
		return self.predict_variant(payload, "C")

	# ---------------------- core logic ----------------------

	def _predict_pct(self, payload: Dict[str, Any], variant: str) -> float:
		# A/B 단일
		if variant == "A" and self.A:
			return self._predict_with(self.A, payload)
		if variant == "B" and self.B:
			return self._predict_with(self.B, payload)

		# 앙상블(C) 또는 단일 폴백
		a = self._predict_with(self.A, payload) if self.A else None
		b = self._predict_with(self.B, payload) if self.B else None

		# 단일만 있을 때
		if a is None and b is None and self.S:
			return self._predict_with(self.S, payload)

		# 둘 중 하나만 있을 때
		if a is None and b is not None:
			return b
		if b is None and a is not None:
			return a

		# 둘 다 있을 때 → 가중 평균
		wA, wB = self._ensemble_weights()
		return wA * a + wB * b  # type: ignore

	def _predict_with(self, loaded: Optional[Loaded], payload: Dict[str, Any]) -> float:
		if not loaded:
			return 0.0
		row = self._to_row(payload)
		try:
			y = loaded.pipe.predict([row])
			val = float(y[0] if isinstance(y, (list, tuple)) else y)
		except Exception as e:
			print(f"[ML][WARN] predict failed via {loaded.path}: {e!r}")
			return 0.0
		return max(0.0, min(val, 100.0))

	def _to_row(self, js: Dict[str, Any]) -> list:
		# 학습 파이프라인의 피처 순서와 맞춰야 함.
		def f(v, d=0.0):
			try:
				return float(v)
			except Exception:
				return float(d)

		typ = (js.get("type") or "office").strip().lower()
		t_factory = 1.0 if "factory" in typ else 0.0
		t_hospital = 1.0 if "hospital" in typ else 0.0
		t_school = 1.0 if "school" in typ else 0.0
		t_office = 1.0 if "office" in typ else 0.0

		return [
			f(js.get("floorAreaM2")),   # NUM
			f(js.get("energy_kwh")),
			f(js.get("eui_kwh_m2y")),
			f(js.get("builtYear")),
			t_factory, t_hospital, t_school, t_office  # CAT (간단 원핫)
		]

	# ---------------------- ensemble weights ----------------------

	def _ensemble_weights(self) -> Tuple[float, float]:
		"""
		가중치 우선순위:
		 1) manifest.ensemble.suggested_by_inverse_mae.{wA,wB}
		 2) manifest.ensemble.{wA,wB}
		 3) (0.5, 0.5)
		반드시 합=1.0로 정규화해서 반환.
		"""
		wA, wB = 0.5, 0.5
		if isinstance(self.manifest, dict):
			ens = self.manifest.get("ensemble") or {}
			sugg = ens.get("suggested_by_inverse_mae") or {}
			sA, sB = sugg.get("wA"), sugg.get("wB")
			if isinstance(sA, (int, float)) and isinstance(sB, (int, float)):
				wA, wB = float(sA), float(sB)
			else:
				mA, mB = ens.get("wA"), ens.get("wB")
				if isinstance(mA, (int, float)) and isinstance(mB, (int, float)):
					wA, wB = float(mA), float(mB)

		total = (wA or 0.0) + (wB or 0.0)
		if total <= 0:
			return 0.5, 0.5
		return wA / total, wB / total

	# ---------------------- 결과 마무리 ----------------------

	def _finalize(self, payload: Dict[str, Any], saving_pct: float, variant: str) -> Dict[str, Any]:
		# 간단 KPI 계산(데모): 실제 운영은 정책 모듈로 분리 권장
		def f(v, d=0.0):
			try:
				return float(v)
			except Exception:
				return float(d)

		energy = f(payload.get("energy_kwh"))
		floor = f(payload.get("floorAreaM2"))

		# 임시 단가/투자(서버 정책으로 대체 가능)
		COST_PER_KWH = 130.0
		CAPEX_PER_SQM = 200_000.0

		saving_kwh = energy * (saving_pct / 100.0)
		saving_cost = saving_kwh * COST_PER_KWH
		capex = floor * CAPEX_PER_SQM
		payback = (capex / saving_cost) if saving_cost > 0 else 99.0

		label = "RECOMMEND" if (saving_pct >= 15.0 and payback <= 5.0) else ("CONDITIONAL" if payback <= 8.0 else "NOT_RECOMMEND")

		return {
			"savingKwhYr": round(saving_kwh, 4),
			"savingCostYr": round(saving_cost, 2),
			"savingPct": round(saving_pct, 4),
			"paybackYears": round(payback, 3),
			"label": label
		}
