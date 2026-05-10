/** Stereo binaural beat ~4–8 Hz (theta); best with headphones. Starts after user gesture. */
const SECONDS_PER_MILLISECOND = 1 / 1000
const POINTER_LOCK_POINTER_SENSITIVITY = 2.2
const POINTER_UV_CLAMP = 1.35
const ANIMATION_FRAME_DT_CAP_SEC = 0.05
const IDLE_RELAX_THRESHOLD_SEC = 0.08
const FRACTAL_ZOOM_MIN = 0.35
const FRACTAL_ZOOM_MAX = 4
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const AUDIO_DETUNE_MAX_CENTS = 95
const AUDIO_DETUNE_FROM_POINTER_SCALE = 0.055
const AUDIO_DETUNE_CLICK_CENTS = 22

class BinauralThetaBeatPlayer {
  constructor() {
    this._graphStarted = false
    this._audioContext = null
    this._leftOscillator = null
    this._rightOscillator = null
    this._outputGainNode = null
    this._perChannelGainLinear = 0.042
    this._beatDriftTimeoutId = 0
    this.carrierFrequencyHz = 174
    this.beatCenterHz = 6
    this.beatRandomSpreadHz = 1.25
    this.masterVolumeLinear = 0.92
    this._interactionDetuneLeftCents = 0
    this._interactionDetuneRightCents = 0
  }

  start() {
    if (this._graphStarted) return
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return
    this._graphStarted = true
    const audioContext = new AudioContextCtor()
    this._audioContext = audioContext
    const channelMerger = audioContext.createChannelMerger(2)
    const gainLeft = audioContext.createGain()
    const gainRight = audioContext.createGain()
    gainLeft.gain.value = this._perChannelGainLinear
    gainRight.gain.value = this._perChannelGainLinear
    const oscLeft = audioContext.createOscillator()
    const oscRight = audioContext.createOscillator()
    oscLeft.type = "sine"
    oscRight.type = "sine"
    oscLeft.detune.value = 0
    oscRight.detune.value = 0
    const beatOffsetHz = this._sampleBeatFrequencyHz()
    oscLeft.frequency.value = this.carrierFrequencyHz
    oscRight.frequency.value = this.carrierFrequencyHz + beatOffsetHz
    oscLeft.connect(gainLeft)
    oscRight.connect(gainRight)
    gainLeft.connect(channelMerger, 0, 0)
    gainRight.connect(channelMerger, 0, 1)
    const masterGain = audioContext.createGain()
    const rampStartTime = audioContext.currentTime
    masterGain.gain.value = 0
    masterGain.gain.linearRampToValueAtTime(this.masterVolumeLinear, rampStartTime + 5)
    channelMerger.connect(masterGain)
    masterGain.connect(audioContext.destination)
    oscLeft.start()
    oscRight.start()
    this._leftOscillator = oscLeft
    this._rightOscillator = oscRight
    this._outputGainNode = masterGain
    audioContext.resume().catch(() => {})
    this._queueNextBeatFrequencyDrift()
  }

  _sampleBeatFrequencyHz() {
    const center = this.beatCenterHz
    const spread = this.beatRandomSpreadHz
    const sampled = center + (Math.random() * 2 - 1) * spread
    return Math.min(48000, Math.max(0.001, sampled))
  }

  _queueNextBeatFrequencyDrift() {
    const audioContext = this._audioContext
    const rightOsc = this._rightOscillator
    if (!audioContext || !rightOsc) return
    clearTimeout(this._beatDriftTimeoutId)
    const nextBeatHz = this._sampleBeatFrequencyHz()
    const now = audioContext.currentTime
    try {
      rightOsc.frequency.cancelScheduledValues(now)
      rightOsc.frequency.setValueAtTime(rightOsc.frequency.value, now)
      rightOsc.frequency.linearRampToValueAtTime(
        this.carrierFrequencyHz + nextBeatHz,
        now + 4 + Math.random() * 5
      )
    } catch (_) {}
    this._beatDriftTimeoutId = setTimeout(
      () => this._queueNextBeatFrequencyDrift(),
      6000 + Math.random() * 7000
    )
  }

  setVolume(linearGain) {
    this.masterVolumeLinear = Math.min(1, Math.max(0, linearGain))
    if (!this._outputGainNode || !this._audioContext) return
    const now = this._audioContext.currentTime
    try {
      this._outputGainNode.gain.cancelScheduledValues(now)
      this._outputGainNode.gain.setValueAtTime(this._outputGainNode.gain.value, now)
      this._outputGainNode.gain.linearRampToValueAtTime(this.masterVolumeLinear, now + 0.08)
    } catch (_) {}
  }

  setCarrierFrequencyHz(hz) {
    this.carrierFrequencyHz = Math.min(96000, Math.max(1, hz))
    if (!this._leftOscillator || !this._rightOscillator || !this._audioContext) return
    const ctx = this._audioContext
    const now = ctx.currentTime
    const currentBeatOffset = this._rightOscillator.frequency.value - this._leftOscillator.frequency.value
    try {
      this._leftOscillator.frequency.cancelScheduledValues(now)
      this._rightOscillator.frequency.cancelScheduledValues(now)
      this._leftOscillator.frequency.setValueAtTime(this._leftOscillator.frequency.value, now)
      this._rightOscillator.frequency.setValueAtTime(this._rightOscillator.frequency.value, now)
      this._leftOscillator.frequency.linearRampToValueAtTime(this.carrierFrequencyHz, now + 0.12)
      this._rightOscillator.frequency.linearRampToValueAtTime(
        this.carrierFrequencyHz + currentBeatOffset,
        now + 0.12
      )
    } catch (_) {}
  }

  setBeatCenterHz(hz) {
    this.beatCenterHz = Math.min(48000, Math.max(0.001, hz))
    if (!this._rightOscillator || !this._leftOscillator || !this._audioContext) return
    const ctx = this._audioContext
    const now = ctx.currentTime
    const nextBeat = this._sampleBeatFrequencyHz()
    try {
      this._rightOscillator.frequency.cancelScheduledValues(now)
      this._rightOscillator.frequency.setValueAtTime(this._rightOscillator.frequency.value, now)
      this._rightOscillator.frequency.linearRampToValueAtTime(this.carrierFrequencyHz + nextBeat, now + 0.15)
    } catch (_) {}
  }

  _clampDetunePair() {
    const lim = AUDIO_DETUNE_MAX_CENTS
    this._interactionDetuneLeftCents = Math.max(-lim, Math.min(lim, this._interactionDetuneLeftCents))
    this._interactionDetuneRightCents = Math.max(-lim, Math.min(lim, this._interactionDetuneRightCents))
  }

  /** @param {number} deltaX
   *  @param {number} deltaY */
  nudgeDetuneFromPointerMotion(deltaX, deltaY) {
    if (!this._graphStarted) return
    const s = AUDIO_DETUNE_FROM_POINTER_SCALE
    this._interactionDetuneLeftCents += (deltaX - deltaY * 0.85) * s
    this._interactionDetuneRightCents += (-deltaX * 0.92 - deltaY) * s
    this._clampDetunePair()
    this._applyDetuneToOscillators()
  }

  /** Single impulse similar to a click / key tap (stereo‑asymmetric for audible beat shift). */
  nudgeDetuneFromPointerImpulse() {
    if (!this._graphStarted) return
    const j = AUDIO_DETUNE_CLICK_CENTS
    this._interactionDetuneLeftCents += (Math.random() * 2 - 1) * j
    this._interactionDetuneRightCents += (Math.random() * 2 - 1) * j
    this._clampDetunePair()
    this._applyDetuneToOscillators()
  }

  /** @param {number} wheelDeltaY - raw wheel delta (positive usually scroll down). */
  nudgeDetuneFromWheel(wheelDeltaY) {
    if (!this._graphStarted) return
    const s = AUDIO_DETUNE_FROM_POINTER_SCALE * 0.35
    this._interactionDetuneLeftCents += wheelDeltaY * s * 0.02
    this._interactionDetuneRightCents -= wheelDeltaY * s * 0.015
    this._clampDetunePair()
    this._applyDetuneToOscillators()
  }

  _applyDetuneToOscillators() {
    const leftOsc = this._leftOscillator
    const rightOsc = this._rightOscillator
    const ctx = this._audioContext
    if (!leftOsc || !rightOsc || !ctx) return
    const t = ctx.currentTime
    try {
      leftOsc.detune.cancelScheduledValues(t)
      leftOsc.detune.setValueAtTime(leftOsc.detune.value, t)
      rightOsc.detune.cancelScheduledValues(t)
      rightOsc.detune.setValueAtTime(rightOsc.detune.value, t)
      leftOsc.detune.setTargetAtTime(this._interactionDetuneLeftCents, t, 0.022)
      rightOsc.detune.setTargetAtTime(this._interactionDetuneRightCents, t, 0.026)
    } catch (_) {}
  }

  /** Smooth interaction detune back toward neutral (call once per frame after audio is running). */
  stepInteractionDetuneDecay(deltaSeconds) {
    if (!this._graphStarted || deltaSeconds <= 0) return
    const relax = Math.exp(-deltaSeconds * 4.2)
    this._interactionDetuneLeftCents *= relax
    this._interactionDetuneRightCents *= relax
    if (Math.abs(this._interactionDetuneLeftCents) < 0.04) this._interactionDetuneLeftCents = 0
    if (Math.abs(this._interactionDetuneRightCents) < 0.04) this._interactionDetuneRightCents = 0
    this._applyDetuneToOscillators()
  }
}

/** Short sine blips for UI feedback (separate graph from binaural beats). */
class GentleUiFeedbackSounds {
  constructor() {
    this._audioContext = null
    this._outputGain = null
  }

  ensureContext() {
    if (this._audioContext) return this._audioContext
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextCtor) return null
    this._audioContext = new AudioContextCtor()
    this._outputGain = this._audioContext.createGain()
    this._outputGain.gain.value = 0.085
    this._outputGain.connect(this._audioContext.destination)
    return this._audioContext
  }

  /** @param {'slider' | 'number' | 'button'} kind */
  play(kind) {
    const ctx = this.ensureContext()
    if (!ctx || !this._outputGain) return
    ctx.resume().catch(() => {})
    const t0 = ctx.currentTime
    const peak = kind === "slider" ? 0.038 : kind === "number" ? 0.042 : 0.052
    const freqHz =
      kind === "slider" ? 560 + Math.random() * 50 : kind === "number" ? 635 + Math.random() * 45 : 760
    const durationSec = kind === "button" ? 0.058 : 0.048
    const osc = ctx.createOscillator()
    const envelope = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freqHz, t0)
    const eps = 0.00015
    envelope.gain.setValueAtTime(eps, t0)
    envelope.gain.exponentialRampToValueAtTime(Math.max(eps, peak), t0 + 0.007)
    envelope.gain.exponentialRampToValueAtTime(eps, t0 + durationSec)
    osc.connect(envelope)
    envelope.connect(this._outputGain)
    osc.start(t0)
    osc.stop(t0 + durationSec + 0.02)
  }
}

function attachUiInteractionSounds(panelRoot, uiSounds) {
  let lastSliderSoundMs = 0
  let lastNumberSoundMs = 0
  const sliderThrottleMs = 70
  const numberThrottleMs = 90
  panelRoot.addEventListener("input", (event) => {
    const el = event.target
    if (!(el instanceof HTMLInputElement)) return
    if (el.type === "range") {
      const now = performance.now()
      if (now - lastSliderSoundMs < sliderThrottleMs) return
      lastSliderSoundMs = now
      uiSounds.play("slider")
    } else if (el.type === "number") {
      const now = performance.now()
      if (now - lastNumberSoundMs < numberThrottleMs) return
      lastNumberSoundMs = now
      uiSounds.play("number")
    }
  })
  panelRoot.addEventListener("click", (event) => {
    const btn = event.target instanceof Element ? event.target.closest("button") : null
    if (btn) uiSounds.play("button")
  })
}

function wireRangeAndNumberToPercentCallback(rangeInput, numberInput, onPercentChange, sliderMin, sliderMax) {
  const clampSlider = (percent) => Math.min(sliderMax, Math.max(sliderMin, percent))
  const syncFromRange = () => {
    const percent = parseFloat(rangeInput.value)
    if (!Number.isFinite(percent)) return
    numberInput.value = String(percent)
    onPercentChange(percent)
  }
  const syncFromNumber = () => {
    const rawText = numberInput.value.trim()
    if (rawText === "" || rawText === "-") return
    const percent = parseFloat(rawText)
    if (!Number.isFinite(percent)) return
    onPercentChange(percent)
    rangeInput.value = String(clampSlider(percent))
  }
  rangeInput.addEventListener("input", syncFromRange)
  numberInput.addEventListener("input", syncFromNumber)
  numberInput.addEventListener("change", syncFromNumber)
  syncFromRange()
}

function wireRangeAndNumberToLingerCurve(rangeInput, numberInput, onLingerPercent) {
  const clampUnit = (percent) => Math.min(100, Math.max(0, percent))
  const syncFromRange = () => {
    const percent = parseFloat(rangeInput.value)
    if (!Number.isFinite(percent)) return
    numberInput.value = String(percent)
    onLingerPercent(percent)
  }
  const syncFromNumber = () => {
    const rawText = numberInput.value.trim()
    if (rawText === "" || rawText === "-") return
    const percent = parseFloat(rawText)
    if (!Number.isFinite(percent)) return
    onLingerPercent(percent)
    rangeInput.value = String(clampUnit(percent))
  }
  rangeInput.addEventListener("input", syncFromRange)
  numberInput.addEventListener("input", syncFromNumber)
  numberInput.addEventListener("change", syncFromNumber)
  syncFromRange()
}

function wireRangeAndNumberThroughMapping(
  rangeInput,
  numberInput,
  onLogicalValueChange,
  sliderMin,
  sliderMax,
  logicalToSliderPosition,
  sliderPositionToLogical
) {
  const clampSlider = (sliderValue) => Math.min(sliderMax, Math.max(sliderMin, sliderValue))
  const syncFromRange = () => {
    const sliderValue = parseFloat(rangeInput.value)
    if (!Number.isFinite(sliderValue)) return
    const logicalValue = sliderPositionToLogical(sliderValue)
    numberInput.value = String(logicalValue)
    onLogicalValueChange(logicalValue)
  }
  const syncFromNumber = () => {
    const rawText = numberInput.value.trim()
    if (rawText === "" || rawText === "-") return
    const logicalValue = parseFloat(rawText)
    if (!Number.isFinite(logicalValue)) return
    onLogicalValueChange(logicalValue)
    rangeInput.value = String(clampSlider(logicalToSliderPosition(logicalValue)))
  }
  rangeInput.addEventListener("input", syncFromRange)
  numberInput.addEventListener("input", syncFromNumber)
  numberInput.addEventListener("change", syncFromNumber)
  syncFromRange()
}

function createFloatingControlPanel(canvasRenderer, thetaAudio) {
  const panelRoot = document.createElement("div")
  panelRoot.id = "hypno-control-panel"
  panelRoot.className =
    "is-hidden fixed inset-x-0 bottom-0 z-20 flex max-h-[46vh] flex-wrap content-end items-end gap-x-5 gap-y-2.5 overflow-y-auto border-t border-white/10 bg-neutral-950/80 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-25px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-2xl transition-[transform,opacity,visibility] duration-300 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.06)]"
  const inputRangeClass =
    "h-1 min-h-1 w-0 min-w-0 flex-1 cursor-pointer accent-violet-500 hover:accent-fuchsia-400"
  const inputNumClass =
    "w-[7.5rem] shrink-0 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1.5 text-[11px] text-neutral-100 tabular-nums outline-none transition placeholder:text-neutral-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25"
  const fieldWrapClass = "flex min-w-[108px] flex-1 flex-col gap-1.5"
  const labelClass = "flex items-baseline justify-between gap-2 text-[11px] text-neutral-300"
  const rowClass = "flex w-full items-center gap-2.5"

  panelRoot.innerHTML = `
    <div class="mb-1 flex w-full basis-full items-center justify-between gap-3 border-b border-white/5 pb-3">
      <div class="flex min-w-0 flex-col gap-1">
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Controls</span>
        <a href="https://github.com/253153/hypnosis.io.lol" target="_blank" rel="noopener noreferrer" class="w-fit text-[10px] font-medium text-violet-400/90 underline-offset-2 hover:text-fuchsia-300 hover:underline">Source on GitHub</a>
      </div>
      <button type="button" id="hypno-panel-close" class="shrink-0 grid size-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent text-lg leading-none text-neutral-200 shadow-sm transition hover:border-violet-400/35 hover:from-violet-500/15 hover:text-white" aria-label="Close controls">×</button>
    </div>
    <h2 class="mt-1 w-full basis-full text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Visual <span class="font-normal normal-case tracking-normal text-neutral-600">(any %)</span></h2>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Mouse warp</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-mouse" class="${inputRangeClass}" min="0" max="200" value="100" step="1"><input type="number" id="cv-mouse-num" class="${inputNumClass}" step="any" value="100"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Click FX</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-click" class="${inputRangeClass}" min="0" max="200" value="100" step="1"><input type="number" id="cv-click-num" class="${inputNumClass}" step="any" value="100"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Spin / reels</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-spin" class="${inputRangeClass}" min="0" max="200" value="100" step="1"><input type="number" id="cv-spin-num" class="${inputNumClass}" step="any" value="100"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Flash brightness</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-flash" class="${inputRangeClass}" min="0" max="200" value="100" step="1"><input type="number" id="cv-flash-num" class="${inputNumClass}" step="any" value="100"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Click linger</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-click-decay" class="${inputRangeClass}" min="0" max="100" value="70" step="1"><input type="number" id="cv-click-decay-num" class="${inputNumClass}" step="any" value="70"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Spin linger</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-spin-decay" class="${inputRangeClass}" min="0" max="100" value="70" step="1"><input type="number" id="cv-spin-decay-num" class="${inputNumClass}" step="any" value="70"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Click kick</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="cv-kick" class="${inputRangeClass}" min="25" max="200" value="100" step="1"><input type="number" id="cv-kick-num" class="${inputNumClass}" step="any" value="100"></div></div>
    <h2 class="w-full basis-full text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Sound <span class="font-normal normal-case tracking-normal text-neutral-600">(manual)</span></h2>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Volume</span><span class="text-[10px] text-neutral-500">%</span></label><div class="${rowClass}"><input type="range" id="aud-vol" class="${inputRangeClass}" min="0" max="100" value="92" step="1"><input type="number" id="aud-vol-num" class="${inputNumClass}" step="any" value="92"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Carrier Hz</span><span class="text-[10px] text-neutral-500">&nbsp;</span></label><div class="${rowClass}"><input type="range" id="aud-carrier" class="${inputRangeClass}" min="100" max="320" value="174" step="1"><input type="number" id="aud-carrier-num" class="${inputNumClass}" step="any" value="174"></div></div>
    <div class="${fieldWrapClass}"><label class="${labelClass}"><span>Theta beat Hz</span><span class="text-[10px] text-neutral-500">&nbsp;</span></label><div class="${rowClass}"><input type="range" id="aud-beat" class="${inputRangeClass}" min="400" max="800" value="600" step="5"><input type="number" id="aud-beat-num" class="${inputNumClass}" step="any" value="6"></div></div>
  `
  document.body.appendChild(panelRoot)

  panelRoot.querySelector("#hypno-panel-close").addEventListener("click", () => {
    panelRoot.classList.add("is-hidden")
    document.getElementById("hypno-panel-toggle")?.classList.remove("hidden")
  })

  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#cv-mouse"),
    panelRoot.querySelector("#cv-mouse-num"),
    (p) => {
      canvasRenderer.visualIntensityScales[0] = p / 100
    },
    0,
    200
  )
  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#cv-click"),
    panelRoot.querySelector("#cv-click-num"),
    (p) => {
      canvasRenderer.visualIntensityScales[1] = p / 100
    },
    0,
    200
  )
  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#cv-spin"),
    panelRoot.querySelector("#cv-spin-num"),
    (p) => {
      canvasRenderer.visualIntensityScales[2] = p / 100
    },
    0,
    200
  )
  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#cv-flash"),
    panelRoot.querySelector("#cv-flash-num"),
    (p) => {
      canvasRenderer.visualIntensityScales[3] = p / 100
    },
    0,
    200
  )

  wireRangeAndNumberToLingerCurve(panelRoot.querySelector("#cv-click-decay"), panelRoot.querySelector("#cv-click-decay-num"), (lingerPercent) => {
    canvasRenderer.clickHighlightDecayPerSecond = Math.max(0.005, Math.min(80, 4.5 - (lingerPercent / 100) * 3.5))
  })
  wireRangeAndNumberToLingerCurve(panelRoot.querySelector("#cv-spin-decay"), panelRoot.querySelector("#cv-spin-decay-num"), (lingerPercent) => {
    canvasRenderer.spinMomentumDecayPerSecond = Math.max(0.005, Math.min(120, 11 - (lingerPercent / 100) * 8))
  })

  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#cv-kick"),
    panelRoot.querySelector("#cv-kick-num"),
    (p) => {
      canvasRenderer.pointerDownSpinBoost = p / 100
    },
    25,
    200
  )

  wireRangeAndNumberToPercentCallback(
    panelRoot.querySelector("#aud-vol"),
    panelRoot.querySelector("#aud-vol-num"),
    (p) => {
      thetaAudio.setVolume(p / 100)
    },
    0,
    100
  )

  wireRangeAndNumberThroughMapping(
    panelRoot.querySelector("#aud-carrier"),
    panelRoot.querySelector("#aud-carrier-num"),
    (hz) => thetaAudio.setCarrierFrequencyHz(hz),
    100,
    320,
    (hz) => hz,
    (sv) => sv
  )

  wireRangeAndNumberThroughMapping(
    panelRoot.querySelector("#aud-beat"),
    panelRoot.querySelector("#aud-beat-num"),
    (hz) => thetaAudio.setBeatCenterHz(hz),
    400,
    800,
    (hz) => hz * 100,
    (sv) => sv / 100
  )
}

window.onload = bootstrapHypnosisExperience

function bootstrapHypnosisExperience() {
  let canvasRenderer
  let primaryCanvas
  const devicePixelRatioClamped = Math.max(1, devicePixelRatio)
  const matchCanvasResolutionToWindow = () => {
    const { innerWidth: width, innerHeight: height } = window
    primaryCanvas.width = width * devicePixelRatioClamped
    primaryCanvas.height = height * devicePixelRatioClamped
    if (canvasRenderer) {
      canvasRenderer.applyBackingScale(devicePixelRatioClamped)
    }
  }
  const fragmentShaderSource = document.querySelector("script[type='x-shader/x-fragment']").textContent
  primaryCanvas = document.createElement("canvas")
  document.title = "Theta Hypnosis"
  document.body.innerHTML = ""
  document.body.appendChild(primaryCanvas)
  document.body.style = "margin:0;touch-action:none;overflow:hidden"
  primaryCanvas.style.width = "100%"
  primaryCanvas.style.height = "auto"
  primaryCanvas.style.userSelect = "none"
  canvasRenderer = new HypnoticWebGLCanvasRenderer(primaryCanvas, devicePixelRatioClamped)
  canvasRenderer.buildShaderProgramFromSources()
  canvasRenderer.uploadFullscreenTriangleGeometry()
  matchCanvasResolutionToWindow()
  if (canvasRenderer.probeFragmentShaderCompileLog(fragmentShaderSource) === null) {
    canvasRenderer.swapFragmentShader(fragmentShaderSource)
  }
  window.onresize = matchCanvasResolutionToWindow

  const thetaAudio = new BinauralThetaBeatPlayer()
  const uiFeedbackSounds = new GentleUiFeedbackSounds()

  createFloatingControlPanel(canvasRenderer, thetaAudio)

  const panelRevealButton = document.createElement("button")
  panelRevealButton.id = "hypno-panel-toggle"
  panelRevealButton.type = "button"
  panelRevealButton.className =
    "fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-[max(12px,env(safe-area-inset-left))] z-[25] grid size-11 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-neutral-950/95 to-violet-950/30 text-lg text-violet-100 shadow-lg shadow-violet-950/50 backdrop-blur-xl transition hover:border-violet-400/40 hover:from-neutral-900 hover:to-violet-900/40 active:scale-[0.96]"
  panelRevealButton.textContent = "☰"
  panelRevealButton.setAttribute("aria-label", "Open controls")
  document.body.appendChild(panelRevealButton)
  const floatingPanel = document.getElementById("hypno-control-panel")
  attachUiInteractionSounds(floatingPanel, uiFeedbackSounds)
  panelRevealButton.addEventListener("click", () => {
    uiFeedbackSounds.play("button")
    releaseDocumentPointerLockIfActive()
    floatingPanel?.classList.remove("is-hidden")
    panelRevealButton.classList.add("hidden")
  })

  const normalizedCoordsFromClient = (clientX, clientY) => {
    const rect = primaryCanvas.getBoundingClientRect()
    const framebufferX = ((clientX - rect.left) / rect.width) * primaryCanvas.width
    const framebufferY =
      primaryCanvas.height - ((clientY - rect.top) / rect.height) * primaryCanvas.height
    const minSide = Math.min(primaryCanvas.width, primaryCanvas.height)
    return [
      (framebufferX - 0.5 * primaryCanvas.width) / minSide,
      (framebufferY - 0.5 * primaryCanvas.height) / minSide,
    ]
  }

  function releaseDocumentPointerLockIfActive() {
    const doc = document
    ;(doc.exitPointerLock || doc.mozExitPointerLock || doc.webkitExitPointerLock)?.call(doc)
  }

  function requestPointerLockOnCanvas() {
    const request =
      primaryCanvas.requestPointerLock ||
      primaryCanvas.mozRequestPointerLock ||
      primaryCanvas.webkitRequestPointerLock
    if (request) request.call(primaryCanvas).catch(() => {})
  }

  function shouldIgnoreKeyForGlobalBindings(event) {
    if (event.defaultPrevented || event.repeat) return true
    if (event.key === "Tab" || event.key === "Escape") return true
    if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return true
    const t = event.target
    if (t && typeof t.closest === "function" && t.closest('input, textarea, select, [contenteditable="true"]'))
      return true
    return false
  }

  const pointerLockedNormalizedCoords = [0, 0]
  let lastPointerActivityMs = 0
  let lastFreePointerClientX = 0
  let lastFreePointerClientY = 0
  let hasLastFreePointerSample = false

  const runSyntheticPointerDownAtCurrentTarget = () => {
    thetaAudio.start()
    lastPointerActivityMs = performance.now()
    canvasRenderer.applyPointerDownKick()
    thetaAudio.nudgeDetuneFromPointerImpulse()
  }

  document.addEventListener("pointerlockchange", () => {
    const pointerLockedToCanvas = document.pointerLockElement === primaryCanvas
    primaryCanvas.style.cursor = pointerLockedToCanvas ? "none" : ""
  })

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== primaryCanvas) return
    thetaAudio.start()
    lastPointerActivityMs = performance.now()
    const minSide = Math.min(primaryCanvas.width, primaryCanvas.height)
    const pointerSensitivity = POINTER_LOCK_POINTER_SENSITIVITY / minSide
    pointerLockedNormalizedCoords[0] += event.movementX * pointerSensitivity
    pointerLockedNormalizedCoords[1] -= event.movementY * pointerSensitivity
    pointerLockedNormalizedCoords[0] = Math.max(
      -POINTER_UV_CLAMP,
      Math.min(POINTER_UV_CLAMP, pointerLockedNormalizedCoords[0])
    )
    pointerLockedNormalizedCoords[1] = Math.max(
      -POINTER_UV_CLAMP,
      Math.min(POINTER_UV_CLAMP, pointerLockedNormalizedCoords[1])
    )
    canvasRenderer.normalizedPointerCoords[0] = pointerLockedNormalizedCoords[0]
    canvasRenderer.normalizedPointerCoords[1] = pointerLockedNormalizedCoords[1]
    thetaAudio.nudgeDetuneFromPointerMotion(event.movementX, event.movementY)
  })

  primaryCanvas.addEventListener("pointermove", (event) => {
    if (document.pointerLockElement === primaryCanvas) return
    thetaAudio.start()
    lastPointerActivityMs = performance.now()
    if (hasLastFreePointerSample) {
      thetaAudio.nudgeDetuneFromPointerMotion(
        event.clientX - lastFreePointerClientX,
        event.clientY - lastFreePointerClientY
      )
    } else {
      hasLastFreePointerSample = true
    }
    lastFreePointerClientX = event.clientX
    lastFreePointerClientY = event.clientY
    canvasRenderer.setNormalizedPointerFromUv(normalizedCoordsFromClient(event.clientX, event.clientY))
  })
  primaryCanvas.addEventListener("pointerleave", () => {
    hasLastFreePointerSample = false
  })
  primaryCanvas.addEventListener("pointerdown", (event) => {
    thetaAudio.start()
    lastPointerActivityMs = performance.now()
    hasLastFreePointerSample = true
    lastFreePointerClientX = event.clientX
    lastFreePointerClientY = event.clientY
    const uv = normalizedCoordsFromClient(event.clientX, event.clientY)
    pointerLockedNormalizedCoords[0] = uv[0]
    pointerLockedNormalizedCoords[1] = uv[1]
    canvasRenderer.setNormalizedPointerFromUv(pointerLockedNormalizedCoords)
    canvasRenderer.applyPointerDownKick()
    thetaAudio.nudgeDetuneFromPointerImpulse()
    requestPointerLockOnCanvas()
  })

  primaryCanvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault()
      thetaAudio.start()
      lastPointerActivityMs = performance.now()
      canvasRenderer.applyWheelZoomDelta(event.deltaY)
      thetaAudio.nudgeDetuneFromWheel(event.deltaY)
    },
    { passive: false }
  )

  window.addEventListener("keydown", (event) => {
    if (shouldIgnoreKeyForGlobalBindings(event)) return
    runSyntheticPointerDownAtCurrentTarget()
  })

  let previousFrameTimestampMs = 0
  const animationFrameHandler = (nowMs) => {
    const deltaSeconds = previousFrameTimestampMs
      ? Math.min(ANIMATION_FRAME_DT_CAP_SEC, (nowMs - previousFrameTimestampMs) * SECONDS_PER_MILLISECOND)
      : 0
    previousFrameTimestampMs = nowMs
    const idleSeconds = lastPointerActivityMs ? (nowMs - lastPointerActivityMs) * SECONDS_PER_MILLISECOND : 999
    canvasRenderer.stepInteractionPhysics(deltaSeconds, idleSeconds)
    canvasRenderer.drawFrame(nowMs)
    thetaAudio.stepInteractionDetuneDecay(deltaSeconds)
    requestAnimationFrame(animationFrameHandler)
  }
  animationFrameHandler(0)

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {})
  }
}

class HypnoticWebGLCanvasRenderer {
  #passthroughVertexGlsl = "#version 300 es\nprecision highp float;\nin vec4 position;\nvoid main(){gl_Position=position;}"
  #gradientFallbackFragmentGlsl =
    "#version 300 es\nprecision highp float;\nout vec4 O;\nuniform float uTimeSeconds;\nuniform vec2 uCanvasResolution;\nuniform float uFractalZoom;\nvoid main() {\n\tvec2 uv=(gl_FragCoord.xy-.5*uCanvasResolution)/min(uCanvasResolution.x,uCanvasResolution.y);\n\tuv/=max(1e-4,uFractalZoom);\n\tO=vec4(uv,sin(uTimeSeconds)*.5+.5,1);\n}"
  #fullscreenTrianglePositions = [-1, 1, -1, -1, 1, 1, 1, -1]

  constructor(canvasElement, backingScaleMultiplier) {
    this.canvas = canvasElement
    this.backingScaleMultiplier = backingScaleMultiplier
    this.gl = canvasElement.getContext("webgl2")
    this.gl.viewport(0, 0, canvasElement.width * backingScaleMultiplier, canvasElement.height * backingScaleMultiplier)
    this.activeFragmentSource = this.#gradientFallbackFragmentGlsl
    this.normalizedPointerCoords = [0, 0]
    this.multiTouchPackedCoords = [0, 0]
    this.activePointerCount = 0
    this.clickHighlightLevel = 0
    this.spinMomentum = 0
    this.visualIntensityScales = new Float32Array([1, 1, 1, 1])
    this.clickHighlightDecayPerSecond = 2.05
    this.spinMomentumDecayPerSecond = 5.2
    this.pointerDownSpinBoost = 1
    /** User scroll zoom: 1 = default; larger = further into the pattern. */
    this.fractalWheelZoom = 1
  }

  /** @param {number} deltaY - wheel `deltaY` (positive ≈ scroll down). */
  applyWheelZoomDelta(deltaY) {
    this.fractalWheelZoom *= Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY)
    this.fractalWheelZoom = Math.max(FRACTAL_ZOOM_MIN, Math.min(FRACTAL_ZOOM_MAX, this.fractalWheelZoom))
  }

  applyPointerDownKick() {
    this.clickHighlightLevel = 1
    this.spinMomentum += (14 + Math.random() * 28) * this.pointerDownSpinBoost
  }

  stepInteractionPhysics(deltaSeconds, idleSeconds = 0) {
    if (deltaSeconds <= 0) return
    this.clickHighlightLevel *= Math.exp(-deltaSeconds * this.clickHighlightDecayPerSecond)
    if (this.clickHighlightLevel < 0.001) this.clickHighlightLevel = 0
    this.spinMomentum *= Math.exp(-deltaSeconds * this.spinMomentumDecayPerSecond)
    if (this.spinMomentum < 0.02) this.spinMomentum = 0
    if (idleSeconds > IDLE_RELAX_THRESHOLD_SEC) {
      const driftBlend = 1 - Math.exp(-deltaSeconds * (10 + Math.min(25, (idleSeconds - IDLE_RELAX_THRESHOLD_SEC) * 40)))
      this.normalizedPointerCoords[0] *= 1 - driftBlend
      this.normalizedPointerCoords[1] *= 1 - driftBlend
    }
  }

  get defaultFragmentSource() {
    return this.#gradientFallbackFragmentGlsl
  }

  swapFragmentShader(fragmentSourceText) {
    this.disposeLinkedShaderProgram()
    this.activeFragmentSource = fragmentSourceText
    this.buildShaderProgramFromSources()
    this.uploadFullscreenTriangleGeometry()
  }

  setNormalizedPointerFromUv(coords) {
    this.normalizedPointerCoords = coords
  }

  setMultiTouchCoordinatePacked(coords) {
    this.multiTouchPackedCoords = coords
  }

  setActivePointerCount(count) {
    this.activePointerCount = count
  }

  applyBackingScale(scale) {
    this.backingScaleMultiplier = scale
    this.gl.viewport(0, 0, this.canvas.width * scale, this.canvas.height * scale)
  }

  compileShaderStage(shaderObject, sourceText) {
    const gl = this.gl
    gl.shaderSource(shaderObject, sourceText)
    gl.compileShader(shaderObject)
    if (!gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shaderObject))
      this.canvas.dispatchEvent(new CustomEvent("shader-error", { detail: gl.getShaderInfoLog(shaderObject) }))
    }
  }

  /** @returns {string|null} compile error log, or null when compile succeeds */
  probeFragmentShaderCompileLog(sourceText) {
    const gl = this.gl
    const probeShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(probeShader, sourceText)
    gl.compileShader(probeShader)
    const errorLog = gl.getShaderParameter(probeShader, gl.COMPILE_STATUS)
      ? null
      : gl.getShaderInfoLog(probeShader)
    gl.deleteShader(probeShader)
    return errorLog
  }

  disposeLinkedShaderProgram() {
    const { gl, gpuProgram, vertexShader, fragmentShader } = this
    if (!gpuProgram || gl.getProgramParameter(gpuProgram, gl.DELETE_STATUS)) return
    if (gl.getShaderParameter(vertexShader, gl.DELETE_STATUS)) {
      gl.detachShader(gpuProgram, vertexShader)
      gl.deleteShader(vertexShader)
    }
    if (gl.getShaderParameter(fragmentShader, gl.DELETE_STATUS)) {
      gl.detachShader(gpuProgram, fragmentShader)
      gl.deleteShader(fragmentShader)
    }
    gl.deleteProgram(gpuProgram)
  }

  buildShaderProgramFromSources() {
    const gl = this.gl
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER)
    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    this.compileShaderStage(this.vertexShader, this.#passthroughVertexGlsl)
    this.compileShaderStage(this.fragmentShader, this.activeFragmentSource)
    this.gpuProgram = gl.createProgram()
    gl.attachShader(this.gpuProgram, this.vertexShader)
    gl.attachShader(this.gpuProgram, this.fragmentShader)
    gl.linkProgram(this.gpuProgram)
    if (!gl.getProgramParameter(this.gpuProgram, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(this.gpuProgram))
    }
  }

  uploadFullscreenTriangleGeometry() {
    const { gl, gpuProgram } = this
    this.vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.#fullscreenTrianglePositions), gl.STATIC_DRAW)
    const positionAttrib = gl.getAttribLocation(gpuProgram, "position")
    gl.enableVertexAttribArray(positionAttrib)
    gl.vertexAttribPointer(positionAttrib, 2, gl.FLOAT, false, 0, 0)
    gpuProgram.uCanvasResolution = gl.getUniformLocation(gpuProgram, "uCanvasResolution")
    gpuProgram.uTimeSeconds = gl.getUniformLocation(gpuProgram, "uTimeSeconds")
    gpuProgram.uNormalizedPointer = gl.getUniformLocation(gpuProgram, "uNormalizedPointer")
    gpuProgram.uClickHighlight = gl.getUniformLocation(gpuProgram, "uClickHighlight")
    gpuProgram.uSpinMomentum = gl.getUniformLocation(gpuProgram, "uSpinMomentum")
    gpuProgram.uVisualIntensityScales = gl.getUniformLocation(gpuProgram, "uVisualIntensityScales")
    gpuProgram.uActivePointerCount = gl.getUniformLocation(gpuProgram, "uActivePointerCount")
    gpuProgram.uMultiTouchPackedUv = gl.getUniformLocation(gpuProgram, "uMultiTouchPackedUv")
    gpuProgram.uFractalZoom = gl.getUniformLocation(gpuProgram, "uFractalZoom")
  }

  drawFrame(nowMs = 0) {
    const { gl, gpuProgram, vertexBuffer, canvas, normalizedPointerCoords, multiTouchPackedCoords, activePointerCount } =
      this

    if (!gpuProgram || gl.getProgramParameter(gpuProgram, gl.DELETE_STATUS)) return
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(gpuProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.uniform2f(gpuProgram.uCanvasResolution, canvas.width, canvas.height)
    gl.uniform1f(gpuProgram.uTimeSeconds, nowMs * SECONDS_PER_MILLISECOND)
    gl.uniform2f(gpuProgram.uNormalizedPointer, ...normalizedPointerCoords)
    gl.uniform1f(gpuProgram.uClickHighlight, this.clickHighlightLevel)
    gl.uniform1f(gpuProgram.uSpinMomentum, this.spinMomentum)
    gl.uniform4fv(gpuProgram.uVisualIntensityScales, this.visualIntensityScales)
    gl.uniform1i(gpuProgram.uActivePointerCount, activePointerCount)
    gl.uniform2fv(gpuProgram.uMultiTouchPackedUv, multiTouchPackedCoords)
    gl.uniform1f(gpuProgram.uFractalZoom, this.fractalWheelZoom)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }
}
