// @ts-check

document.addEventListener('DOMContentLoaded', async () => {
  const MAX_IMAGE_SIZE = 4096;
  const DEFAULT_IMAGE_SIZE = 300;
  const EPSILON = 0.000001;
  const DEFAULT_ANIMATION_DURATION = 4;
  const DEFAULT_FPS = 30;
  const MIN_FPS = 0.001;
  const MAX_FPS = 65536;
  /** @type {boolean} */ let NEEDS_STRETCHING_ADJUSTMENT;

  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
  const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
  const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
  const lockAspectInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-aspect'));
  const enableAnimationInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-enable-animation'));
  const animationStartTimeInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-start-time'));
  const animationDurationInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-duration'));
  const animationFpsInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-fps'));
  const animationTotalFramesInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-animation-total-frames'));
  const animationPlayPauseButton = /** @type {HTMLButtonElement} */ (document.getElementById('view-animation-play-pause'));
  const animationFrameInput = /** @type {HTMLInputElement} */ (document.getElementById('view-animation-frame'));
  const animationFrameValueInput = /** @type {HTMLInputElement} */ (document.getElementById('view-animation-frame-value'));
  const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));
  const saveSequenceButton = /** @type {HTMLButtonElement} */ (document.getElementById('save-sequence'));
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));
  const sandboxIFrame = /** @type {HTMLIFrameElement} */ (document.getElementById('sandbox'));

  if (sandboxIFrame.loading) {
    await new Promise(resolve => sandboxIFrame.addEventListener('load', resolve, { once: true }));
  }

  const sandboxDocument = /** @type {Document} */ (sandboxIFrame.contentDocument);
  const sandboxSvgContainer = /** @type {HTMLElement} */ (sandboxDocument.getElementById('svg-container'));
  const renderingContext = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  const xmlSerializer = new XMLSerializer();
  const image = new Image();

  /** @type {string?} */ let svgContent;
  /** @type {number} */ let originalWidth;
  /** @type {number} */ let originalHeight;
  /** @type {HTMLInputElement} */ let lastUsedSizeInput;
  /** @type {HTMLInputElement} */ let lastUsedFrameInput;
  /** @type {string} */ let fileName;
  /** @type {number?} */ let playAnimTimeoutHandle;

  function resetVars() {
    svgContent = null;
    originalWidth = 1;
    originalHeight = 1;
    lastUsedSizeInput = widthInput;
    lastUsedFrameInput = animationFpsInput;
    fileName = 'img';
    playAnimTimeoutHandle = null;
  }

  /**
   * @type {{
   *   width: number,
   *   height: number,
   *   animationStartTime: number, // Offset from 0 in seconds
   *   animationDuration: number, // In seconds
   *   animationTotalFrames: number, // Maintained and displayed as float, floored as needed
   *   animationDisplayFrame: number, // Starts at 1
   * }}
   */
  const ctrlValues = /** @type {any} */ ({});

  function resetCtrlValues() {
    ctrlValues.width = lib.util.parsePositiveInt(widthInput) ?? DEFAULT_IMAGE_SIZE;
    ctrlValues.height = lib.util.parsePositiveInt(heightInput) ?? DEFAULT_IMAGE_SIZE;
    ctrlValues.animationStartTime = lib.util.parseOffsetValue(animationStartTimeInput)?.seconds ?? 0;
    ctrlValues.animationDuration = lib.util.parseOffsetValue(animationDurationInput)?.seconds ?? DEFAULT_ANIMATION_DURATION;
    ctrlValues.animationTotalFrames = lib.util.parsePositiveInt(animationTotalFramesInput)
      ?? DEFAULT_ANIMATION_DURATION * DEFAULT_FPS;
    ctrlValues.animationDisplayFrame = lib.util.parsePositiveInt(animationFrameValueInput) ?? 1;
  }

  const animationControls = [
    animationStartTimeInput,
    animationDurationInput,
    animationFpsInput,
    animationTotalFramesInput,
    animationPlayPauseButton,
    animationFrameInput,
    animationFrameValueInput,
    saveSequenceButton,
  ];

  const allControlsExceptFileInputs = [
    widthInput,
    heightInput,
    lockAspectInput,
    enableAnimationInput,
    ...animationControls,
    saveButton,
  ];

  const allControls = [
    fileInput,
    ...allControlsExceptFileInputs,
  ];

  function reset() {
    resetVars();
    fileInput.value = '';
    image.src = '';
    sandboxSvgContainer.innerHTML = '';
    widthInput.value = '';
    heightInput.value = '';
    lockAspectInput.checked = true;
    enableAnimationInput.checked = false;
    enableAnimationInput.disabled = true;
    animationStartTimeInput.value = '0s';
    animationDurationInput.value = `${DEFAULT_ANIMATION_DURATION}s`;
    animationFpsInput.value = String(DEFAULT_FPS);
    const totalFramesStr = String(DEFAULT_ANIMATION_DURATION * DEFAULT_FPS);
    animationTotalFramesInput.value = totalFramesStr;
    animationFrameInput.value = '1';
    animationFrameInput.max = totalFramesStr;
    resetCtrlValues();
    for (const c of allControlsExceptFileInputs) c.disabled = true;
  }

  function resetCurrentFrame() {
    animationFrameInput.max = String(ctrlValues.animationTotalFrames);
    animationFrameInput.value = '1';
    animationFrameValueInput.value = '1';
    ctrlValues.animationDisplayFrame = 1;
  }

  function aspectRatio() {
    const ratio = originalWidth / originalHeight;
    return isNaN(ratio) ? 1 : ratio;
  }

  /**
   * @param {HTMLInputElement} input 
   * @param {boolean} overrideInputValue 
   */
  async function handleSizeInput(input, overrideInputValue) {
    const isWidth = input === widthInput;

    let value = lib.util.parsePositiveInt(input) ?? DEFAULT_IMAGE_SIZE;

    if (value > MAX_IMAGE_SIZE) {
      value = MAX_IMAGE_SIZE;
    }

    if (lockAspectInput.checked) {
      const valueToOtherValue = isWidth ? 1 / aspectRatio() : aspectRatio();
      let otherValue = valueToOtherValue * value;

      if (otherValue > MAX_IMAGE_SIZE) {
        otherValue = MAX_IMAGE_SIZE;
        value = otherValue / valueToOtherValue;
      }

      const [width, height] = isWidth ? [value, otherValue] : [otherValue, value];
      ctrlValues.width = width;
      ctrlValues.height = height;

      if (overrideInputValue) {
        widthInput.value = String(width);
        heightInput.value = String(height);
      } else if (isWidth) {
        heightInput.value = String(height);
      } else {
        widthInput.value = String(width);
      }
    } else {
      if (isWidth) {
        ctrlValues.width = value;
      } else {
        ctrlValues.height = value;
      }

      if (overrideInputValue) {
        input.value = String(value);
      }
    }

    lastUsedSizeInput = input;
    await rerender();
  }

  /**
   * @param {HTMLInputElement} input 
   * @param {boolean} overrideInputValue 
   */
  async function handleTimingInput(input, overrideInputValue) {
    const isStartTime = input === animationStartTimeInput;
    const parseResult = lib.util.parseOffsetValue(input);
    let value = parseResult?.seconds ?? 0;
    if (!isStartTime) value = Math.max(0, value);

    if (overrideInputValue) {
      input.value = parseResult?.toStringRep(value) ?? `${value}s`;
    }

    if (isStartTime) {
      ctrlValues.animationStartTime = value;
      await rerender();
    } else {
      ctrlValues.animationDuration = value;
      await handleFrameInput(lastUsedFrameInput, true); // Does rerender()
    }
  }

  /**
   * @param {HTMLInputElement} input 
   * @param {boolean} overrideInputValue 
   */
  async function handleFrameInput(input, overrideInputValue) {
    const isFps = input === animationFpsInput;
    const value = lib.util.parsePositiveFloat(input) ?? (isFps ? DEFAULT_FPS : DEFAULT_FPS * ctrlValues.animationDuration);

    const fps = lib.util.clamp(isFps ? value : value / ctrlValues.animationDuration, MIN_FPS, MAX_FPS);
    let frames = Math.max(1, fps * ctrlValues.animationDuration);

    if (ctrlValues.animationDuration <= EPSILON) {
      frames = 1;
    }

    ctrlValues.animationTotalFrames = frames;

    if (!isFps || overrideInputValue) {
      animationFpsInput.value = String(fps);
    }

    if (isFps || overrideInputValue) {
      animationTotalFramesInput.value = String(frames);
    }

    lastUsedFrameInput = input;

    animationFrameInput.max = String(frames);
    await handleCurrentFrameInput(); // Does rerender()
  }

  /**
   * @param {number} value 
   */
  function clampCurrentFrame(value) {
    return lib.util.clamp(value, 1, ctrlValues.animationTotalFrames);
  }

  async function handleCurrentFrameInput() {
    const value = clampCurrentFrame(Number(animationFrameInput.value));
    animationFrameValueInput.value = String(value);
    ctrlValues.animationDisplayFrame = value;
    await rerender();
  }

  /**
   * @param {boolean} overrideInputValue 
   */
  async function handleCurrentFrameValueInput(overrideInputValue) {
    const value = clampCurrentFrame(lib.util.parsePositiveInt(animationFrameValueInput) ?? 1);
    animationFrameInput.value = String(value);

    if (overrideInputValue) {
      animationFrameValueInput.value = String(value);
    }

    ctrlValues.animationDisplayFrame = value;
    await rerender();
  }

  /**
   * @param {number} frame 
   */
  async function setCurrentFrameAndRerender(frame) {
    frame = lib.util.clamp(frame, 1, ctrlValues.animationTotalFrames);
    animationFrameValueInput.value = String(frame);
    await handleCurrentFrameValueInput(true); // Does rerender()
  }

  /**
   * @param {HTMLInputElement} input 
   * @param {(input: HTMLInputElement, overrideInputValue: boolean) => void} callback 
   */
  function makeTextInputEventListeners(input, callback) {
    input.addEventListener('input', () => callback(input, false));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        callback(input, true);
      }
    });
    input.addEventListener('focusout', () => callback(input, true));
  }

  fileInput.addEventListener('change', () => loadImageAndRerender());

  makeTextInputEventListeners(widthInput, handleSizeInput);
  makeTextInputEventListeners(heightInput, handleSizeInput);
  lockAspectInput.addEventListener('change', () => handleSizeInput(lastUsedSizeInput, true));

  enableAnimationInput.addEventListener('change', rerender);

  makeTextInputEventListeners(animationStartTimeInput, handleTimingInput);
  makeTextInputEventListeners(animationDurationInput, handleTimingInput);

  makeTextInputEventListeners(animationFpsInput, handleFrameInput);
  makeTextInputEventListeners(animationTotalFramesInput, handleFrameInput);

  animationPlayPauseButton.addEventListener('click', togglePreviewAnimation);
  animationFrameInput.addEventListener('input', handleCurrentFrameInput);
  makeTextInputEventListeners(animationFrameValueInput, (_, overrideInputValue) => handleCurrentFrameValueInput(overrideInputValue));

  saveButton.addEventListener('click', () => saveCurrentFrame());
  saveSequenceButton.addEventListener('click', saveSequence);

  /**
   * @param {string} svgContent 
   */
  function applySvgContent(svgContent) {
    sandboxSvgContainer.innerHTML = svgContent;
    const svg = /** @type {SVGSVGElement} */ (sandboxSvgContainer.children[0]);
    svg.pauseAnimations();
    return svg;
  }

  /**
   * @param {SVGSVGElement} svg 
   */
  async function loadSvgIntoImage(svg) {
    const svgString = xmlSerializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    image.src = URL.createObjectURL(blob);
    return new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
  }

  async function rerender() {
    if (svgContent === null) {
      image.src = '';
    } else {
      const svg = applySvgContent(svgContent);

      const fps = ctrlValues.animationTotalFrames / ctrlValues.animationDuration;
      svg.setCurrentTime(ctrlValues.animationStartTime + (ctrlValues.animationDisplayFrame - 1) / fps);

      const svgAnimationElements = lib.svg.getAllAnimationElements(svg);

      if (enableAnimationInput.checked) {
        lib.svg.applyAnimation(svg);
      }

      // The renderer will use some values from animation elements if they are not removed
      for (const element of svgAnimationElements) {
        element.remove();
      }

      if (NEEDS_STRETCHING_ADJUSTMENT) {
        const scaleY = originalWidth / (originalHeight * (ctrlValues.width / ctrlValues.height));
        svg.style.transform += scaleY >= 1 ? ` scaleY(${scaleY})` : ` scaleX(${1 / scaleY})`;
      }

      await loadSvgIntoImage(svg);
    }

    canvas.width = ctrlValues.width;
    canvas.height = ctrlValues.height;
    renderingContext.drawImage(image, 0, 0, ctrlValues.width, ctrlValues.height);
  }

  /**
   * @param {boolean} setSize 
   * @param {string?} overrideSvgContent 
   */
  async function loadImageAndRerender(setSize = true, overrideSvgContent = null) {
    if (overrideSvgContent === null) {
      const file = fileInput.files?.[0];

      if (!file) {
        reset();
        await rerender();
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
    } else {
      svgContent = overrideSvgContent;
    }

    if (svgContent !== null) {
      sandboxSvgContainer.innerHTML = svgContent;
    }

    const children = sandboxSvgContainer.children;

    if (svgContent === null) {
      reset();
      await rerender();
    } else if (
      children.length !== 1 ||
      !(children[0] instanceof (children[0].ownerDocument.defaultView?.SVGSVGElement ?? SVGSVGElement))
    ) {
      reset();
      await rerender();
      window.alert('The chosen file is not a valid SVG.');
    } else {
      const svg = applySvgContent(svgContent);

      await loadSvgIntoImage(svg);

      originalWidth = image.width;
      originalHeight = image.height;
      for (const c of allControls) c.disabled = false;

      const isAnimatedSvg = lib.svg.getAllAnimationElements(svg).length > 0;
      enableAnimationInput.disabled = !isAnimatedSvg;
      if (!isAnimatedSvg) enableAnimationInput.checked = false;

      resetCurrentFrame();

      if (setSize) {
        widthInput.value = String(originalWidth);
        heightInput.value = String(originalHeight);
        ctrlValues.width = originalWidth;
        ctrlValues.height = originalHeight;
        await handleSizeInput(lastUsedSizeInput, true); // Does rerender()
      } else {
        await rerender();
      }
    }
  }

  /**
   * @param {'all frames' | 'real time'} mode 
   * @param {((frame: number) => void | Promise<any>) | null} onFrameRendered 
   */
  function playAnimation(mode, onFrameRendered = null) {
    if (playAnimTimeoutHandle !== null) {
      pauseAnimation();
    }

    animationFrameValueInput.disabled = true;

    let timeMs = performance.now();

    async function renderFrame() {
      const currentTimeMs = performance.now();
      const deltaMs = currentTimeMs - timeMs;
      const msPerFrame = (1000 * ctrlValues.animationDuration) / ctrlValues.animationTotalFrames;

      if (mode === 'all frames' || deltaMs >= msPerFrame) {
        const frameDelta = mode === 'all frames' ? 1 : Math.max(1, Math.floor(deltaMs / msPerFrame));
        timeMs += msPerFrame * frameDelta;

        let frame = ctrlValues.animationDisplayFrame + frameDelta;
        if (frame > ctrlValues.animationTotalFrames) {
          frame = 1;
        }

        await setCurrentFrameAndRerender(frame);

        const result = onFrameRendered?.(frame);
        if (typeof result === 'object') {
          await result;
        }
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
    animationFrameValueInput.disabled = false;
  }

  function togglePreviewAnimation() {
    if (playAnimTimeoutHandle !== null) {
      pauseAnimation();
    } else {
      playAnimation('real time');
    }
  }

  /**
   * @returns {Promise<Blob>} 
   */
  function getFrameBlob() {
    return new Promise(resolve => {
      // FUTURE: file format and quality
      canvas.toBlob(blob => resolve(/** @type {Blob} */(blob)));
    });
  }

  async function saveCurrentFrame(fileNameSuffix = '') {
    lib.util.saveFile(await getFrameBlob(), fileName + fileNameSuffix);
  }

  async function saveSequence() {
    if (ctrlValues.animationTotalFrames === 1) {
      await saveCurrentFrame();
      return;
    }

    const controlsActiveState = allControls.map(c => ({ control: c, disabled: c.disabled }));
    for (const c of allControls) {
      c.disabled = true;
    }

    const zipWriter = new lib.zip.ZipWriter();
    const suffixLength = String(ctrlValues.animationTotalFrames).length;

    /**
     * @param {number} frame 
     */
    async function doUpdate(frame) {
      const blob = await getFrameBlob();
      await zipWriter.appendFile(blob, `frame-${String(frame).padStart(suffixLength, '0')}.png`);

      if (frame < ctrlValues.animationTotalFrames) return;

      for (const state of controlsActiveState) {
        state.control.disabled = state.disabled;
      }

      pauseAnimation();
      rerender();

      lib.util.saveFile(URL.createObjectURL(zipWriter.toBlob()), fileName);
    }

    await setCurrentFrameAndRerender(1);
    await doUpdate(1);

    playAnimation('all frames', doUpdate);
  }

  // Feature test
  {
    const featureTestContainer = /** @type {HTMLTemplateElement} */ (sandboxDocument.getElementById('feature-test')).content;
    const testSvg = /** @type {SVGSVGElement} */ (featureTestContainer.querySelector('svg'));

    const enableAnimationWasChecked = enableAnimationInput.checked;
    resetVars();
    resetCtrlValues();
    canvas.style.opacity = '0';
    
    // Do we need extra stretching?
    ctrlValues.width = 100;
    ctrlValues.height = 1;
    await loadImageAndRerender(false, testSvg.outerHTML);
    const pixelRed = renderingContext.getImageData(1, 0, 1, 1).data[0];
    NEEDS_STRETCHING_ADJUSTMENT = pixelRed < 127;

    canvas.style.opacity = '';
    enableAnimationInput.checked = enableAnimationWasChecked;
  }

  // Initialize
  resetVars();
  resetCtrlValues();
  loadImageAndRerender(false);
});