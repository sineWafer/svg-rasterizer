// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const MAX_IMAGE_SIZE = 4096;
  const DEFAULT_IMAGE_SIZE = 300;

  const sandboxIFrame = /** @type {HTMLIFrameElement} */ (document.getElementById('sandbox'));

  sandboxIFrame.addEventListener('load', () => {
    const sandboxDocument = /** @type {Document} */ (sandboxIFrame.contentDocument);
    const sandboxWindow = /** @type {window} */ (sandboxIFrame.contentWindow);

    const sandboxSvgContainer = /** @type {HTMLElement} */ (sandboxDocument.getElementById('svg-container'));
    const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
    const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
    const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
    const lockAspectInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-aspect'));
    const enableAnimationInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-enable-animation'));
    const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));

    const renderingContext = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const xmlSerializer = new XMLSerializer();
    const image = new Image();
    /** @type {string?} */ let svgContent = null;
    let originalWidth = 1;
    let originalHeight = 1;
    let lastUsedSizeInput = widthInput;
    let fileName = 'img';

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
    }

    function aspectRatio() {
      const ratio = originalWidth / originalHeight;
      return isNaN(ratio) ? 1 : ratio;
    }

    /**
     * @param {number} dimension 
     */
    function clampImageDimension(dimension) {
      return Math.max(1, Math.min(MAX_IMAGE_SIZE, dimension));
    }

    /**
     * @param {'update' | 'apply svg change' | 'apply svg change keep dimensions'} mode 
     */
    async function rerender(mode = 'update') {
      /**
       * @param {HTMLInputElement} input 
       */
      function parseDimension(input) {
        return clampImageDimension(input.value.length === 0 ? DEFAULT_IMAGE_SIZE : Number(input.value));
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
        svg.setCurrentTime(0);

        const svgAnimationElements = lib.getAllSvgAnimationElements(svg);
        if (svgAnimationElements.length > 0) {
          isAnimatedSvg = true;
        }
        const enableSvgAnimation = isAnimatedSvg && enableAnimationInput.checked;

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

          // Keep dimensions mode is to preserver user settings on page reload. Only works on Firefox.
          if (mode !== 'apply svg change keep dimensions') {
            widthInput.value = String(originalWidth);
            heightInput.value = String(originalHeight);
            width = originalWidth;
            height = originalHeight;
          }
        }

        if (enableSvgAnimation) {
          lib.applySvgAnimation(svg);
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

      const disableInputs = svgContent === null;

      widthInput.disabled = disableInputs;
      heightInput.disabled = disableInputs;
      lockAspectInput.disabled = disableInputs;
      enableAnimationInput.disabled = disableInputs || !isAnimatedSvg;
      saveButton.disabled = disableInputs;

      if (disableInputs) {
        widthInput.value = '';
        heightInput.value = '';
        lockAspectInput.checked = true;
      }
      if (enableAnimationInput.disabled) {
        enableAnimationInput.checked = false;
      }
    }

    async function loadImageAndRerender(isInitialImageLoad = false) {
      const file = fileInput.files?.[0];

      if (!file) {
        reset();
        rerender('apply svg change');
        return;
      }

      fileName = file.name;

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
        rerender(isInitialImageLoad ? 'apply svg change keep dimensions' : 'apply svg change')
      }
    }

    fileInput.addEventListener('change', () => loadImageAndRerender());

    saveButton.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = canvas.toDataURL();
      link.download = fileName;
      link.click();
    });

    /**
     * @param {HTMLInputElement?} sizeInput 
     * @param {boolean} allowEmpty 
     */
    function applySizeInputChange(sizeInput = null, allowEmpty = true) {
      sizeInput ??= lastUsedSizeInput;
      lastUsedSizeInput = sizeInput;
      const isWidth = sizeInput === widthInput;
      const otherSizeInput = isWidth ? heightInput : widthInput;

      let str = sizeInput.value.replaceAll(/[^\d.]/g, '');
      const slices = str.split('.');
      str = slices.slice(0, 2).join('.') + slices.slice(2).join();

      let dimension = str.length === 0 ? DEFAULT_IMAGE_SIZE : Math.floor(Number(str));
      if (dimension > MAX_IMAGE_SIZE) {
        dimension = MAX_IMAGE_SIZE;
        str = String(dimension);
      }

      if (lockAspectInput.checked || otherSizeInput.value.length === 0) {
        let dimensionToOtherDimension = isWidth ? 1 / aspectRatio() : aspectRatio();
        let otherDimension = Math.floor(dimension * dimensionToOtherDimension);
        if (otherDimension > MAX_IMAGE_SIZE) {
          otherDimension = MAX_IMAGE_SIZE;
          dimension = Math.floor(otherDimension / dimensionToOtherDimension);
          str = String(dimension);
        }

        otherSizeInput.value = String(otherDimension);
      }

      sizeInput.value = (str.length !== 0 || !allowEmpty) ? String(dimension) : str;

      rerender();
    }

    widthInput.addEventListener('input', () => applySizeInputChange(widthInput));
    widthInput.addEventListener('focusout', () => {
      if (widthInput.value.length === 0) {
        applySizeInputChange(widthInput, false);
      }
    });

    heightInput.addEventListener('input', () => applySizeInputChange(heightInput));
    heightInput.addEventListener('focusout', () => {
      if (heightInput.value.length === 0) {
        applySizeInputChange(heightInput, false);
      }
    });

    lockAspectInput.addEventListener('change', () => applySizeInputChange());

    enableAnimationInput.addEventListener('change', () => rerender())

    loadImageAndRerender(true);
  });
});