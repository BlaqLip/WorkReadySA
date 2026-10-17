// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const navLinks = document.getElementById('navLinks');
const navOverlay = document.getElementById('navOverlay');

function toggleMenu() {
  navLinks.classList.toggle('open');
  navOverlay.classList.toggle('active');
}

function closeMenu() {
  navLinks.classList.remove('open');
  navOverlay.classList.remove('active');
}

toggle.addEventListener('click', toggleMenu);
navOverlay.addEventListener('click', closeMenu);
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

// Close nav on outside click (if it missed the overlay)
document.addEventListener('click', e => {
  if (!e.target.closest('.nav') && !e.target.closest('.nav-toggle')) {
    closeMenu();
  }
});

// Blog category filter (UI only)
document.querySelectorAll('.cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Contact form
function handleForm(e) {
  e.preventDefault();
  const msg = document.getElementById('formMsg');
  msg.textContent = "Thank you! We'll be in touch shortly.";
  e.target.reset();
  setTimeout(() => msg.textContent = '', 5000);
}

// Scroll reveal
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.service-card, .blog-card, .mv-card, .contact-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});
