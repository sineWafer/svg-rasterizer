// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const MAX_IMAGE_SIZE = 4096;
  const DEFAULT_IMAGE_SIZE = 300;
  const EPSILON = 0.000001;
  const DEFAULT_ANIMATION_DURATION = 4;
  const DEFAULT_FPS = 30;
  const MIN_FPS = 0.001;
  const MAX_FPS = 65536;
  const CLOCK_VALUE_VALIDITY_DESCRIPTION = 'Use e.g. 70 or 70s or 70000ms or 01:10';

  const sandboxIFrame = /** @type {HTMLIFrameElement} */ (document.getElementById('sandbox'));

  sandboxIFrame.addEventListener('load', () => {
    const sandboxDocument = /** @type {Document} */ (sandboxIFrame.contentDocument);

    const sandboxSvgContainer = /** @type {HTMLElement} */ (sandboxDocument.getElementById('svg-container'));
    const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
    const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
    const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
    const lockAspectInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-aspect'));
    const enableAnimationInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-enable-animation'));
    const animationFpsInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-fps'));
    const animationTotalFramesInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-total-frames'));
    const animationPlayPauseButton = /** @type {HTMLButtonElement} */ (document.getElementById('view-animation-play-pause'));
    const animationTimeInput = /** @type {HTMLInputElement} */ (document.getElementById('view-animation-time'));
    const animationTimeValueInput = /** @type {HTMLInputElement} */ (document.getElementById('view-animation-time-value'));
    const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));
    const saveSequenceButton = /** @type {HTMLButtonElement} */ (document.getElementById('save-sequence'));
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));

    /**
     * @param {string} name 
     */
    function qAnimationTimingInput(name) {
      return {
        value: /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-' + name)),
        lock: /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-animation-' + name)),
      };
    }
    const animTimingInputs = {
      start: qAnimationTimingInput('start-time'),
      duration: qAnimationTimingInput('duration'),
      end: qAnimationTimingInput('end-time'),
    };

    const renderingContext = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const xmlSerializer = new XMLSerializer();
    const image = new Image();
    /** @type {string?} */ let svgContent = null;
    let originalWidth = 1;
    let originalHeight = 1;
    let lastUsedSizeInput = widthInput;
    let lastUsedAnimationFrameInput = animationFpsInput;
    let fileName = 'img';

    /** @type {number?} */ let playAnimTimeoutHandle = null;
    function animationPlaying() { return playAnimTimeoutHandle !== null };

    const allControls = [
      fileInput,
      widthInput,
      heightInput,
      lockAspectInput,
      enableAnimationInput,
      ...Object.values(animTimingInputs).flatMap(v => [v.value, v.lock]),
      animationFpsInput,
      animationTotalFramesInput,
      animationPlayPauseButton,
      animationTimeInput,
      animationTimeValueInput,
      saveButton,
      saveSequenceButton,
    ];

    function reset() {
      fileInput.value = '';
      image.src = '';
      sandboxSvgContainer.innerHTML = '';
      svgContent = null;
      originalWidth = 1;
      originalHeight = 1;
      widthInput.value = '';
      heightInput.value = '';
      lockAspectInput.checked = true;
      enableAnimationInput.checked = false;
      animTimingInputs.start.value.value = '0s';
      animTimingInputs.start.lock.checked = true;
      animTimingInputs.duration.value.value = `${DEFAULT_ANIMATION_DURATION}s`;
      animTimingInputs.duration.lock.checked = false;
      animTimingInputs.end.value.value = `${DEFAULT_ANIMATION_DURATION}s`;
      animTimingInputs.end.lock.checked = false;
      animationFpsInput.value = String(DEFAULT_FPS);
      animationTotalFramesInput.value = String(DEFAULT_ANIMATION_DURATION * DEFAULT_FPS);
      animationTimeInput.value = '1';
      updateAnimationTimeInputFromDuration(DEFAULT_ANIMATION_DURATION);
      pauseAnimation();
    }

    function aspectRatio() {
      const ratio = originalWidth / originalHeight;
      return isNaN(ratio) ? 1 : ratio;
    }

    /**
     * @param {'update' | 'apply svg change' | 'apply svg change keep settings'} mode 
     * @param {boolean} setControlStatuses 
     */
    async function rerender(mode = 'update', setControlStatuses = true) {
      /**
       * @param {HTMLInputElement} input 
       */
      function parseDimension(input) {
        return input.value.length === 0 ? DEFAULT_IMAGE_SIZE : lib.util.clamp(Number(input.value), 1, MAX_IMAGE_SIZE);
      }

      let width = parseDimension(widthInput);
      let height = parseDimension(heightInput);
      let isAnimatedSvg = false;

      if (svgContent === null) {
        image.src = '';
      } else {
        sandboxSvgContainer.innerHTML = svgContent;
        const svg = /** @type {SVGSVGElement} */ (sandboxSvgContainer.children[0]);
        svg.pauseAnimations();

        const timingVals = parseTimingInputSecondsForUse();
        const fps = animationFpsInput.value.length === 0 ? DEFAULT_FPS :
          lib.util.clamp(Number(animationFpsInput.value), MIN_FPS, MAX_FPS);
        const currentFrame = Number(animationTimeInput.value);

        svg.setCurrentTime(timingVals.start + (currentFrame - 1) / fps);

        const svgAnimationElements = lib.svg.getAllAnimationElements(svg);
        if (svgAnimationElements.length > 0) {
          isAnimatedSvg = true;
        }

        async function loadSvgIntoImage() {
          const svgString = xmlSerializer.serializeToString(svg);
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          image.src = URL.createObjectURL(blob);
          await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
        }

        if (mode !== 'update') {
          await loadSvgIntoImage();

          originalWidth = image.width;
          originalHeight = image.height;

          // Keep settings mode is to preserve user settings on page reload. Only works on Firefox.
          if (mode !== 'apply svg change keep settings') {
            widthInput.value = String(originalWidth);
            heightInput.value = String(originalHeight);
            width = originalWidth;
            height = originalHeight;
            enableAnimationInput.checked = isAnimatedSvg;
          }
        }

        if (isAnimatedSvg && enableAnimationInput.checked) {
          lib.svg.applyAnimation(svg);
        }

        // The renderer will use some values from animation elements if they are not removed
        for (const element of svgAnimationElements) {
          element.remove();
        }

        const scaleY = originalWidth / (originalHeight * (width / height));
        svg.style.transform += scaleY >= 1 ? ` scaleY(${scaleY})` : ` scaleX(${1 / scaleY})`;

        await loadSvgIntoImage();
      }

      canvas.width = width;
      canvas.height = height;
      renderingContext.drawImage(image, 0, 0, width, height);

      animationTimeValueInput.value = animationTimeInput.value;

      if (!setControlStatuses) return;

      const disableInputs = svgContent === null;
      const disableAnimationInputs = disableInputs || !isAnimatedSvg;

      widthInput.disabled = disableInputs;
      heightInput.disabled = disableInputs;
      lockAspectInput.disabled = disableInputs;
      saveButton.disabled = disableInputs;

      enableAnimationInput.disabled = disableAnimationInputs;

      if (disableInputs) {
        widthInput.value = '';
        heightInput.value = '';
        lockAspectInput.checked = true;
      }
      if (disableAnimationInputs) {
        enableAnimationInput.checked = false;
        animationTimeInput.value = '1';
        pauseAnimation();
      }
    }

    async function loadImageAndRerender(isInitialImageLoad = false) {
      const file = fileInput.files?.[0];

      if (!file) {
        reset();
        rerender('apply svg change');
        return;
      }

      const fileNameMatch = /^(.*?)\.[^.]*$/.exec(file.name);
      fileName = fileNameMatch?.[1] ?? file.name;

      try {
        // Might fail if the file isn't at the original location anymore after the page reloads
        svgContent = await file.text();
      } catch (e) {
        svgContent = null;
      }

      if (svgContent !== null) {
        sandboxSvgContainer.innerHTML = svgContent;
      }

      const children = sandboxSvgContainer.children;

      if (svgContent === null) {
        reset();
        rerender('apply svg change');
      } else if (
        children.length !== 1 ||
        // instanceof does not work here because the SVG lives in a different context inside the iframe
        children[0].tagName.toLowerCase() !== 'svg'
      ) {
        reset();
        rerender('apply svg change');
        window.alert('The chosen file is not a valid SVG.');
      } else {
        rerender(isInitialImageLoad ? 'apply svg change keep settings' : 'apply svg change')
      }
    }

    fileInput.addEventListener('change', () => loadImageAndRerender());

    function saveCurrent(fileNameSuffix = '') {
      const link = document.createElement('a');
      link.href = canvas.toDataURL();
      link.download = fileName + fileNameSuffix;
      link.click();
    }

    saveButton.addEventListener('click', () => saveCurrent());

    saveSequenceButton.addEventListener('click', async () => {
      const frameCount = Number(animationTimeInput.max);

      if (frameCount === 1) {
        saveCurrent();
        return;
      }

      const controlsActiveState = allControls.map(c => ({ control: c, disabled: c.disabled }));
      for (const c of allControls) {
        c.disabled = true;
      }

      const suffixLength = String(frameCount).length;

      /**
       * @param {number} frame 
       */
      function doUpdate(frame) {
        saveCurrent(`-${String(frame).padStart(suffixLength, '0')}`);

        if (frame < Number(animationTimeInput.max)) return;

        for (const state of controlsActiveState) {
          state.control.disabled = state.disabled;
        }

        pauseAnimation();
        rerender();
      }

      animationTimeInput.value = '1';
      await rerender();
      await doUpdate(1);

      playAnimation('all frames', doUpdate);
    });

    /**
     * @param {string} value 
     * @param {boolean} allowNonInt 
     */
    function sanitizeNumberInput(value, allowNonInt) {
      if (!allowNonInt) {
        const str = value.replaceAll(/[^\d]/g, '');
        return str.length === 0 ? null : Number(str);
      } else {
        let str = value.replaceAll(/[^\d.]/g, '');
        const slices = str.split('.');
        str = slices.slice(0, 2).join('.') + slices.slice(2).join();
        return str.length === 0 ? null : Number(str);
      }
    }

    /**
     * @param {HTMLInputElement?} sizeInput 
     * @param {boolean} allowEmpty 
     */
    function handleSizeInputChange(sizeInput = null, allowEmpty = true) {
      sizeInput ??= lastUsedSizeInput;
      lastUsedSizeInput = sizeInput;
      const isWidth = sizeInput === widthInput;
      const otherSizeInput = isWidth ? heightInput : widthInput;

      const inputValue = sanitizeNumberInput(sizeInput.value, false);

      let dimension = inputValue ?? DEFAULT_IMAGE_SIZE;
      if (dimension > MAX_IMAGE_SIZE) {
        dimension = MAX_IMAGE_SIZE;
      }

      if (lockAspectInput.checked || otherSizeInput.value.length === 0) {
        let dimensionToOtherDimension = isWidth ? 1 / aspectRatio() : aspectRatio();
        let otherDimension = Math.floor(dimension * dimensionToOtherDimension);
        if (otherDimension > MAX_IMAGE_SIZE) {
          otherDimension = MAX_IMAGE_SIZE;
          dimension = Math.floor(otherDimension / dimensionToOtherDimension);
        }

        otherSizeInput.value = String(otherDimension);
      }

      sizeInput.value = !allowEmpty ? String(dimension) : String(inputValue) ?? '';

      rerender();
    }

    widthInput.addEventListener('input', () => handleSizeInputChange(widthInput));
    widthInput.addEventListener('focusout', () => {
      if (widthInput.value.length === 0) {
        handleSizeInputChange(widthInput, false);
      }
    });

    heightInput.addEventListener('input', () => handleSizeInputChange(heightInput));
    heightInput.addEventListener('focusout', () => {
      if (heightInput.value.length === 0) {
        handleSizeInputChange(heightInput, false);
      }
    });

    lockAspectInput.addEventListener('change', () => handleSizeInputChange());

    enableAnimationInput.addEventListener('change', () => rerender());

    if (!Object.values(animTimingInputs).some(inputs => inputs.lock.checked)) {
      animTimingInputs.start.lock.checked = true;
    }

    for (const inputs of Object.values(animTimingInputs)) {
      inputs.lock.addEventListener('change', () => {
        for (const { value: val } of Object.values(animTimingInputs)) {
          val.disabled = false;
        }
        inputs.value.disabled = inputs.lock.checked;
      });

      inputs.value.disabled = inputs.lock.checked; // Initialize correct state
    }

    function parseTimingInputValues() {
      /** @type {{ [kind in keyof typeof animTimingInputs]: ReturnType<typeof lib.util.parseOffsetValue> }} */
      const result = /** @type {any} */ ({});

      for (const kind of /** @type {(keyof typeof animTimingInputs)[]} */ (Object.keys(animTimingInputs))) {
        const input = animTimingInputs[kind].value;
        const val = lib.util.parseOffsetValue(input.value);
        result[kind] = val === null || (input === animTimingInputs.duration.value && val.seconds < 0) ? null : val;
      }
      return result;
    }

    /**
     * @param {keyof typeof animTimingInputs} kind 
     * @param {ReturnType<parseTimingInputValues>} vals 
     */
    function substituteTimingInputDefaults(kind, vals) {
      switch (kind) {
        case 'start': return vals.end === null ? 0 : vals.end.seconds - (vals.duration?.seconds ?? 0);
        case 'duration': return vals.start === null || vals.end === null ? 0 : vals.end.seconds - vals.start.seconds;
        case 'end': return (vals.start?.seconds ?? 0) + (vals.duration?.seconds ?? 0);
      }
    }

    function parseTimingInputSecondsForUse() {
      const vals = parseTimingInputValues();
      /** @type {{ [kind in keyof typeof animTimingInputs]: number }} */
      const results = /** @type {any} */ ({});

      for (const kind of lib.util.keys(animTimingInputs)) {
        results[kind] = vals[kind]?.seconds ?? substituteTimingInputDefaults(kind, vals);
      }
      return results;
    }

    /**
     * @param {number} frames 
     */
    function updateAnimationTimeInputFromFrames(frames) {
      animationTimeInput.max = String(frames);
    }

    /**
     * @param {number} animationDuration 
     */
    function updateAnimationTimeInputFromDuration(animationDuration) {
      const frames = Math.max(
        1,
        lastUsedAnimationFrameInput === animationFpsInput
          ? Math.floor(animationDuration * handleAnimationFpsInput(false, false))
          : handleAnimationTotalFramesInput(false, false)
      );
      updateAnimationTimeInputFromFrames(frames);
    }

    /**
     * @param {number} seconds 
     * @param {{ toStringRep: (seconds: number) => string }?} parseResult 
     */
    function toTimingInputValueRepresentation(seconds, parseResult) {
      return parseResult?.toStringRep(seconds) ?? `${seconds}s`;
    }

    /**
     * @param {keyof typeof animTimingInputs} kind 
     */
    function handleTimingInputChange(kind) {
      const vals = parseTimingInputValues();

      const changedVal = kind === 'start' ? vals.start : kind === 'duration' ? vals.duration : vals.end;
      animTimingInputs[kind].value.setCustomValidity(changedVal === null ? CLOCK_VALUE_VALIDITY_DESCRIPTION : '');
      if (changedVal === null) return;

      let start = vals.start?.seconds ?? 0;
      let duration = vals.duration?.seconds ?? 0;
      let end = vals.end?.seconds ?? start;

      switch (kind) {
        case 'start':
          if (animTimingInputs.end.lock.checked) {
            const max = vals.end?.seconds ?? (vals.duration === null ? null : start + vals.duration.seconds);
            if (max !== null && start > max) {
              start = max;
              animTimingInputs.start.value.value = toTimingInputValueRepresentation(start, vals.start);
            }
          }
          break;
        case 'end':
          if (animTimingInputs.start.lock.checked) {
            const min = vals.start?.seconds ?? (vals.duration === null ? null : end - vals.duration.seconds);
            if (min !== null && end < min) {
              end = min;
              animTimingInputs.end.value.value = toTimingInputValueRepresentation(end, vals.end);
            }
          }
          break;
      }

      if (kind !== 'start' && !animTimingInputs.start.lock.checked) { // Start unlocked
        start = end - duration;
        animTimingInputs.start.value.value = toTimingInputValueRepresentation(start, vals.start);
      } else if (kind !== 'duration' && !animTimingInputs.duration.lock.checked) { // Duration unlocked
        duration = end - start;
        animTimingInputs.duration.value.value = toTimingInputValueRepresentation(duration, vals.duration);
      } else { // End unlocked
        end = start + duration;
        animTimingInputs.end.value.value = toTimingInputValueRepresentation(end, vals.end);
      }

      updateAnimationTimeInputFromDuration(duration);

      rerender();
    }

    function handleTimingInputFocusOut() {
      const vals = parseTimingInputValues();

      let anyChange = false;
      let duration = 0;

      for (const kind of lib.util.keys(animTimingInputs)) {
        const input = animTimingInputs[kind].value;
        const parseResult = vals[kind];

        let value;
        if (parseResult === null) {
          value = substituteTimingInputDefaults(kind, vals);
          input.value = toTimingInputValueRepresentation(value, parseResult);
          anyChange = true;
        } else {
          value = parseResult.seconds;
        }

        if (kind === 'duration') {
          duration = value;
        }
      }

      if (!anyChange) return;

      updateAnimationTimeInputFromDuration(duration);

      rerender();
    }

    for (const kind of lib.util.keys(animTimingInputs)) {
      const inputs = animTimingInputs[kind];
      inputs.value.addEventListener('input', () => handleTimingInputChange(kind));
      inputs.value.addEventListener('focusout', handleTimingInputFocusOut);
    }

    /**
     * @param {boolean} allowEmpty 
     * @param {boolean} doRerender 
     */
    function handleAnimationFpsInput(allowEmpty, doRerender = true) {
      let fps = sanitizeNumberInput(animationFpsInput.value, true);
      const animDuration = parseTimingInputSecondsForUse().duration;

      if (fps === null) {
        const frames = sanitizeNumberInput(animationTotalFramesInput.value, false);
        fps = frames === null || animDuration <= EPSILON ? DEFAULT_FPS : Math.max(1, frames) / animDuration;
        if (allowEmpty) return fps;
        animationFpsInput.value = String(fps);
      }

      animationTotalFramesInput.value = String(Math.floor(animDuration * fps));
      lastUsedAnimationFrameInput = animationFpsInput;

      updateAnimationTimeInputFromFrames(Math.floor(fps * animDuration));

      if (doRerender) {
        rerender();
      }

      return fps;
    }

    animationFpsInput.addEventListener('input', () => handleAnimationFpsInput(true));
    animationFpsInput.addEventListener('focusout', () => handleAnimationFpsInput(false));

    /**
     * @param {boolean} allowEmpty 
     * @param {boolean} doRerender 
     */
    function handleAnimationTotalFramesInput(allowEmpty, doRerender = true) {
      let frames = sanitizeNumberInput(animationTotalFramesInput.value, false);
      const animDuration = parseTimingInputSecondsForUse().duration;

      if (frames === null) {
        const fps = sanitizeNumberInput(animationFpsInput.value, true) ?? DEFAULT_FPS;
        frames = Math.max(1, Math.floor(fps * animDuration));
        if (allowEmpty) return frames;
        animationTotalFramesInput.value = String(frames);
      } else {
        frames = Math.max(1, frames);
      }

      animationFpsInput.value = String(frames / animDuration);
      animationTotalFramesInput.value = String(frames);
      lastUsedAnimationFrameInput = animationTotalFramesInput;

      updateAnimationTimeInputFromFrames(frames);

      if (doRerender) {
        rerender();
      }

      return frames;
    }

    animationTotalFramesInput.addEventListener('input', () => handleAnimationTotalFramesInput(true));
    animationTotalFramesInput.addEventListener('focusout', () => handleAnimationTotalFramesInput(false));
    
    /**
     * @param {'all frames' | 'real time'} mode 
     * @param {((frame: number) => void) | null} onFrameRendered 
     */
    function playAnimation(mode, onFrameRendered = null) {
      if (playAnimTimeoutHandle !== null) {
        pauseAnimation();
      }

      animationTimeValueInput.disabled = true;

      let timeMs = performance.now();

      async function renderFrame() {
        const currentTimeMs = performance.now();
        const deltaMs = currentTimeMs - timeMs;
        const msPerFrame = 1000 / handleAnimationFpsInput(true, false);
        
        if (mode === 'all frames' || deltaMs >= msPerFrame) {
          const frameDelta = mode === 'all frames' ? 1 : Math.max(1, Math.floor(deltaMs / msPerFrame));
          timeMs += msPerFrame * frameDelta;
    
          let frame = Number(animationTimeInput.value) + frameDelta;
          if (frame > Number(animationTimeInput.max)) {
            frame = 1;
          }
          animationTimeInput.value = String(frame);
    
          await rerender('update', false);
          onFrameRendered?.(frame);
        }

        // If pauseAnimation() has been called, this will be null
        if (playAnimTimeoutHandle === null) return;

        if (!enableAnimationInput.checked) {
          playAnimTimeoutHandle = null;
          return;
        }

        playAnimTimeoutHandle = setTimeout(renderFrame);
      }
      
      playAnimTimeoutHandle = setTimeout(renderFrame);
    }

    function pauseAnimation() {
      if (playAnimTimeoutHandle === null) return;
      clearTimeout(playAnimTimeoutHandle);
      playAnimTimeoutHandle = null;
      animationTimeValueInput.disabled = false;
    }

    animationPlayPauseButton.addEventListener('click', () => {
      if (animationPlaying()) {
        pauseAnimation();
      } else {
        playAnimation('real time');
      }
    });

    animationTimeInput.addEventListener('input', () => rerender());

    /**
     * @param {boolean} allowInvalid 
     */
    function handleAnimationTimeValueInput(allowInvalid) {
      pauseAnimation();

      const sanitizedValue = sanitizeNumberInput(animationTimeValueInput.value, false);
      let frame = sanitizedValue;

      if (frame === null) {
        if (allowInvalid) return;
        frame = 1;
      }

      if (!allowInvalid) {
        frame = lib.util.clamp(frame, 1, Number(animationTimeInput.max));
      }
      
      animationTimeValueInput.value = !allowInvalid ? String(frame) : sanitizedValue === null ? '' : String(sanitizedValue);
      animationTimeInput.value = String(frame);

      rerender();
    }

    animationTimeValueInput.addEventListener('input', () => handleAnimationTimeValueInput(true));
    animationTimeValueInput.addEventListener('focusout', () => handleAnimationTimeValueInput(false));

    {
      const storeLastUsedAnimationInput = lastUsedAnimationFrameInput;
      updateAnimationTimeInputFromFrames(handleAnimationTotalFramesInput(false, false));
      lastUsedAnimationFrameInput = storeLastUsedAnimationInput;
      loadImageAndRerender(true);
    }
  });
});