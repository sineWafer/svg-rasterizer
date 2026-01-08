// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  for (const section of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.animation-controls-section'))) {
    const height = Math.ceil(section.getBoundingClientRect().height);
    section.style.setProperty('--js-computed-height', `${height}px`);
  }
});