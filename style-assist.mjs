// @ts-check
import * as util from './lib/util.mjs';

document.addEventListener('DOMContentLoaded', () => {
  {
    // Compute size of animation foldout for transition animation

    for (const section of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.animation-controls-section'))) {
      const height = Math.ceil(section.getBoundingClientRect().height);
      section.style.setProperty('--js-computed-height', `${height}px`);
    }
  }

  {
    // Responsive layout

    const MIN_WIDTH_FOR_WIDE_MODE = 600;

    function updateResponsiveSize() {
      document.body.classList.toggle('narrow-mode', document.body.clientWidth < MIN_WIDTH_FOR_WIDE_MODE);
    }

    updateResponsiveSize();
    window.addEventListener('resize', updateResponsiveSize);
  }

  {
    // Scroll overflowing content by clicking and dragging

    /** @type {HTMLElement?} */ let dragScrollableElement = null;

    for (const scrollable of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.click-drag-scroll'))) {
      scrollable.addEventListener('pointerdown', e => {
        if (e.target === scrollable) return; // Only scroll when children are grabbed, especially so scrollbars can still be used
        const horizontal = scrollable.clientWidth < scrollable.scrollWidth;
        const vertical = scrollable.clientHeight < scrollable.scrollHeight;
        if (!horizontal && !vertical) return;
        dragScrollableElement = scrollable;
        dragScrollableElement.setPointerCapture(e.pointerId);
        dragScrollableElement.style.cursor = horizontal ? (vertical ? 'move' : 'ew-resize') : 'ns-resize';
      });
    }

    document.addEventListener('pointerup', e => {
      if (dragScrollableElement === null) return;
      dragScrollableElement.releasePointerCapture(e.pointerId);
      dragScrollableElement.style.cursor = '';
      dragScrollableElement = null;
    });

    document.addEventListener('pointermove', e => {
      if (dragScrollableElement === null) return;
      dragScrollableElement.scrollLeft -= e.movementX;
      dragScrollableElement.scrollTop -= e.movementY;
    });
  }

  {
    // Handle tooltips (little bit more flexible than [title])

    const TOOLTIP_APPEAR_TIMEOUT_MS = 500;

    const tooltipDisplay = document.createElement('div');
    tooltipDisplay.classList.add('tooltip-display');
    tooltipDisplay.style.opacity = '0';
    document.body.appendChild(tooltipDisplay);

    /** @type {number?} */ let timeoutHandle = null;

    function hideTooltip() {
      tooltipDisplay.style.opacity = '0';

      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    }

    document.addEventListener('pointermove', event => {
      hideTooltip();

      if (!(event.target instanceof HTMLElement)) return;

      const element = /** @type {HTMLElement} */ (event.target);
      const closest = element.closest('[tooltip]:is(:not(:disabled), .show-tooltip-disabled)');
      const tooltip = !closest || !closest.classList.contains('show-tooltip-disabled') && closest.querySelector(':disabled')
        ? null
        : closest.getAttribute('tooltip');

      if (tooltip == null) {
        tooltipDisplay.style.opacity = '0';
        return;
      }

      timeoutHandle = setTimeout(() => {
        if (tooltip === null) return;

        tooltipDisplay.innerText = tooltip;
        tooltipDisplay.style.opacity = '1';

        const rect = tooltipDisplay.getBoundingClientRect();
        const computedStyle = getComputedStyle(tooltipDisplay);
        const x = util.clamp(
          event.clientX,
          0,
          window.innerWidth - rect.width - (util.parseComputedLength(computedStyle.marginLeft) ?? 0) - 1
        );
        const y = util.clamp(
          event.clientY,
          0,
          window.innerHeight - rect.height - (util.parseComputedLength(computedStyle.marginTop) ?? 0) - 1
        );
        tooltipDisplay.style.transform = `translate(${x}px, ${y}px)`;
      }, TOOLTIP_APPEAR_TIMEOUT_MS);
    }, true);

    document.addEventListener('keydown', hideTooltip);
    document.addEventListener('mousedown', hideTooltip);
  }
});