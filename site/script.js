(function(){
  const sections=document.querySelectorAll('section[id]');
  const navLinks=document.querySelectorAll('nav a[href^="#"]');
  if(sections.length&&navLinks.length&&'IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          const id='#'+entry.target.id;
          navLinks.forEach(l=>l.classList.toggle('active',l.getAttribute('href')===id));
        }
      });
    },{rootMargin:'-60px 0px -50% 0px',threshold:0});
    sections.forEach(s=>obs.observe(s));
  }

  document.querySelectorAll('.faq-question').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const answer=btn.nextElementSibling;
      const isOpen=answer.classList.contains('open');
      document.querySelectorAll('.faq-answer.open').forEach(a=>a.classList.remove('open'));
      document.querySelectorAll('.faq-question').forEach(b=>b.setAttribute('aria-expanded','false'));
      if(!isOpen){
        answer.classList.add('open');
        btn.setAttribute('aria-expanded','true');
      }
    });
  });

  const menuBtn=document.querySelector('.menu-toggle');
  const navMenu=document.querySelector('.nav-links');
  if(menuBtn&&navMenu){
    menuBtn.addEventListener('click',()=>{
      const expanded=menuBtn.getAttribute('aria-expanded')==='true';
      menuBtn.setAttribute('aria-expanded',String(!expanded));
      navMenu.classList.toggle('open');
    });
    navMenu.querySelectorAll('a').forEach(link=>{
      link.addEventListener('click',()=>{
        menuBtn.setAttribute('aria-expanded','false');
        navMenu.classList.remove('open');
      });
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&navMenu.classList.contains('open')){
        menuBtn.setAttribute('aria-expanded','false');
        navMenu.classList.remove('open');
        menuBtn.focus();
      }
    });
  }

  document.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const code=btn.closest('pre').querySelector('code');
      if(!code)return;
      const text=code.textContent;
      const fallback=()=>{
        const ta=document.createElement('textarea');
        ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
        document.body.appendChild(ta);ta.select();
        try{document.execCommand('copy');}catch(e){}
        document.body.removeChild(ta);
      };
      const ok=()=>{btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',2000);};
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(ok,()=>{fallback();ok();});
      }else{fallback();ok();}
    });
  });

  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const container=document.createElement('div');
    container.className='particles';
    container.setAttribute('aria-hidden','true');
    document.body.appendChild(container);
    for(let i=0;i<8;i++){
      const p=document.createElement('div');
      p.className='particle';
      p.style.left=Math.random()*100+'%';
      p.style.animationDuration=(8+Math.random()*4)+'s';
      p.style.animationDelay=Math.random()*10+'s';
      container.appendChild(p);
    }
  }
})();
