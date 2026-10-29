(function(){
  var h=document.querySelector('header.site');
  if(h){
    var nx=h.nextElementSibling;
    if(nx&&nx.classList.contains('hero'))h.classList.add('over-hero');
    var last=window.pageYOffset;
    var upd=function(){
      var y=window.pageYOffset;
      var menu=document.getElementById('menu');
      var open=menu&&menu.classList.contains('show');
      var sub=h.querySelector('.has-sub.open');
      h.classList.toggle('solid',y>20||open);
      if(y<=20||open||sub||y<last-4)h.classList.remove('nav-hidden');
      else if(y>last+4)h.classList.add('nav-hidden');
      last=y;
    };
    window.addEventListener('scroll',upd,{passive:true});
    var b=h.querySelector('.burger');
    if(b)b.addEventListener('click',function(){setTimeout(upd,0);});
    upd();
  }
  var m=document.cookie.match(/(?:^|; )googtrans=\/es\/([a-z-]+)/);
  var cur=m?m[1]:'es';
  var names={es:'Español',en:'English'};
  var lab=document.getElementById('lang-cur');
  if(lab)lab.textContent=names[cur]||'Español';
  document.documentElement.lang=cur;
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('[data-lang]');
    if(!a)return;
    e.preventDefault();
    var l=a.getAttribute('data-lang');
    var host=location.hostname.indexOf('.')>-1?';domain='+location.hostname:'';
    var past='=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    document.cookie='googtrans'+past;
    if(host)document.cookie='googtrans'+past+host;
    if(l!=='es'){
      document.cookie='googtrans=/es/'+l+';path=/';
      if(host)document.cookie='googtrans=/es/'+l+';path=/'+host;
    }
    location.reload();
  });
  if(cur!=='es'){
    var d=document.createElement('div');d.id='google_translate_element';d.style.display='none';document.body.appendChild(d);
    window.gtInit=function(){new google.translate.TranslateElement({pageLanguage:'es',includedLanguages:'es,en',autoDisplay:false},'google_translate_element');};
    var s=document.createElement('script');s.src='https://translate.google.com/translate_a/element.js?cb=gtInit';document.head.appendChild(s);
  }
})();
