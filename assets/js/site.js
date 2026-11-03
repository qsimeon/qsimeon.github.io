// Site behavior: theme toggle, mobile nav, header state, scroll reveal, card spotlight.
// The initial theme is applied by the inline script in _includes/head.html (before first paint).

const root = document.documentElement;

// theme toggle
document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    const apply = () => {
      root.dataset.theme = next;
      localStorage.setItem("theme", next);
    };
    document.startViewTransition ? document.startViewTransition(apply) : apply();
  });
});

// follow the OS while the visitor hasn't chosen explicitly
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!localStorage.getItem("theme")) root.dataset.theme = e.matches ? "dark" : "light";
});

// mobile nav
const menuBtn = document.querySelector("[data-menu-toggle]");
const nav = document.getElementById("site-nav");
if (menuBtn && nav) {
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  menuBtn.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  nav.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));
}

// header border once the page scrolls
const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.classList.toggle("is-scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

// scroll reveal; siblings get a stagger index via --i
const reveals = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window) {
  reveals.forEach((el) => {
    const group = el.parentElement.querySelectorAll(":scope > [data-reveal]");
    el.style.setProperty("--i", Math.min([...group].indexOf(el), 6));
  });
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-visible");
      io.unobserve(e.target);
    }),
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  reveals.forEach((el) => io.observe(el));
} else {
  reveals.forEach((el) => el.classList.add("is-visible"));
}

// card spotlight follows the pointer
document.querySelectorAll(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  });
});
