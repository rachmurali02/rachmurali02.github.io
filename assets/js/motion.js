// Reveal [data-reveal] and [data-rule] elements as they scroll into view.
(() => {
  const targets = document.querySelectorAll('[data-reveal], [data-rule]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('in'));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  targets.forEach(el => observer.observe(el));
})();
