export const attachSpecialAbilityInfoListeners = (scope: ParentNode = document): void => {
  const position = (button: HTMLButtonElement): void => {
    const popover = button.parentElement?.querySelector<HTMLElement>(".generator-sa-info__popover");
    if (!popover) return;
    const buttonRect = button.getBoundingClientRect();
    const width = Math.min(336, Math.max(240, window.innerWidth - 16));
    popover.style.width = `${width}px`;
    const popoverRect = popover.getBoundingClientRect();
    const preferredLeft = buttonRect.right + 8;
    const left = preferredLeft + width <= window.innerWidth - 8
      ? preferredLeft
      : Math.max(8, buttonRect.left - width - 8);
    const top = Math.max(8, Math.min(buttonRect.top - 8, window.innerHeight - popoverRect.height - 8));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  };

  scope.querySelectorAll<HTMLButtonElement>("[data-generator-sa-info]").forEach((button) => {
    const wrapper = button.parentElement;
    button.addEventListener("mouseenter", () => position(button));
    button.addEventListener("focus", () => position(button));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = !wrapper?.classList.contains("is-open");
      scope.querySelectorAll<HTMLElement>(".generator-sa-info.is-open").forEach((entry) => {
        entry.classList.remove("is-open");
        entry.querySelector<HTMLButtonElement>("[data-generator-sa-info]")?.setAttribute("aria-expanded", "false");
      });
      if (open && wrapper) {
        wrapper.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        position(button);
      }
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      wrapper?.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
    wrapper?.addEventListener("focusout", (event) => {
      if (wrapper.contains(event.relatedTarget as Node | null)) return;
      wrapper.classList.remove("is-open");
      button.setAttribute("aria-expanded", "false");
    });
  });
};
