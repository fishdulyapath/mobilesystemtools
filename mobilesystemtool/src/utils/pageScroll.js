export function scrollReportToTop(options = {}) {
  const behavior = typeof options === "string" ? options : options.behavior || "smooth";

  requestAnimationFrame(() => {
    const target = document.querySelector(".layout-content");
    if (target) {
      if (behavior === "instant") {
        target.scrollTop = 0;
      } else {
        target.scrollTo({ top: 0, behavior });
      }
      return;
    }

    if (behavior === "instant") {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  });
}
