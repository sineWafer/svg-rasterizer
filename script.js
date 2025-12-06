// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const MAX_IMAGE_SIZE = 5000;
  const DEFAULT_IMAGE_SIZE = 300;

  const sandboxIFrame = /** @type {HTMLIFrameElement} */ (document.getElementById('sandbox'));

  sandboxIFrame.addEventListener('load', () => {
    const sandboxDocument = /** @type {Document} */ (sandboxIFrame.contentDocument);

    const sandboxSvgContainer = /** @type {HTMLElement} */ (sandboxDocument.getElementById('svg-container'));
    const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
    const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
    const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
    const lockAspectInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-aspect'));
    const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));
    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));

    const renderingContext = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

    const xmlSerializer = new XMLSerializer();
    const image = new Image();
    /** @type {SVGSVGElement?} */ let svg = null;
    let originalWidth = 1;
    let originalHeight = 1;
    let originalSvgStyleTransform = '';
    let lastUsedSizeInput = widthInput;
    let fileName = 'img';
    let initialImageLoad = true;

    function reset() {
      fileInput.value = '';
      image.src = '';
      sandboxSvgContainer.innerHTML = '';
      svg = null;
      originalWidth = 1;
      originalHeight = 1;
      originalSvgStyleTransform = '';
      widthInput.value = '';
      heightInput.value = '';
      lockAspectInput.checked = true;
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

      if (svg === null) {
        image.src = '';
      } else {
        /**
         * @param {SVGSVGElement} svg 
         */
        function svgToImageSource(svg) {
          const svgString = xmlSerializer.serializeToString(svg);
          const blob = new Blob([svgString], { type: 'image/svg+xml' });
          return URL.createObjectURL(blob);
        }

        if (mode !== 'update') {
          const testImage = new Image();
          testImage.src = svgToImageSource(svg);

          await new Promise(resolve => testImage.onload = resolve);

          originalWidth = testImage.width;
          originalHeight = testImage.height;

          if (mode !== 'apply svg change keep dimensions') {
            widthInput.value = String(originalWidth);
            heightInput.value = String(originalHeight);
            width = originalWidth;
            height = originalHeight;
          }
        }

        const scaleY = originalWidth / (originalHeight * (width / height));
        svg.style.transform = originalSvgStyleTransform +
          (scaleY >= 1 ? ` scaleY(${scaleY})` : ` scaleX(${1 / scaleY})`);

        image.src = svgToImageSource(svg);

        await new Promise(resolve => image.addEventListener('load', resolve, { once: true }));
      }

      canvas.width = width;
      canvas.height = height;
      renderingContext.drawImage(image, 0, 0, width, height);

      const disableInputs = svg === null;
      widthInput.disabled = disableInputs;
      heightInput.disabled = disableInputs;
      lockAspectInput.disabled = disableInputs;
      saveButton.disabled = disableInputs;

      if (disableInputs) {
        widthInput.value = '';
        heightInput.value = '';
        lockAspectInput.checked = true;
      }
    }

    async function loadImageAndRerender() {
      const isInitialImageLoad = initialImageLoad;
      initialImageLoad = false;

      const file = fileInput.files?.[0];

      if (!file) {
        reset();
        rerender('apply svg change');
        return;
      }

      fileName = file.name;

      /** @type {string?} */ let svgData = null;
      try {
        // Might fail if the file isn't at the original location anymore after the page reloads
        svgData = await file.text();
      } catch (e) {
        svgData = null;
      }

      if (svgData !== null) {
        sandboxSvgContainer.innerHTML = svgData;
      }

      const children = sandboxSvgContainer.children;

      if (svgData === null) {
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
        svg = /** @type {SVGSVGElement} */ (children[0]);
        svg.pauseAnimations();
        originalSvgStyleTransform = svg.style.transform;

        rerender(isInitialImageLoad ? 'apply svg change keep dimensions' : 'apply svg change')
      }
    }

    fileInput.addEventListener('change', loadImageAndRerender);

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

    loadImageAndRerender();
  });
});