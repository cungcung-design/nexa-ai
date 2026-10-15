(function () {
  'use strict';
  var script = document.currentScript;
  if (!script) return;
  var deploymentId = script.getAttribute('data-agent');
  if (!deploymentId || !/^nexa_[a-zA-Z0-9_-]+$/.test(deploymentId)) return;
  var widgetOrigin = new URL(script.src).origin;
  var iframe = document.createElement('iframe');
  iframe.src = widgetOrigin + '/embed/' + encodeURIComponent(deploymentId);
  iframe.title = 'Nexa AI chat preview';
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  Object.assign(iframe.style, {
    position:'fixed',bottom:'88px',right:'16px',width:'min(380px, calc(100vw - 32px))',
    height:'min(560px, calc(100dvh - 112px))',border:'1px solid rgba(139,92,246,.3)',
    borderRadius:'18px',background:'#0d0b15',boxShadow:'0 16px 48px rgba(0,0,0,.4)',
    zIndex:'2147483647',display:'none'
  });
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Chat with AI';
  button.setAttribute('aria-label','Open Nexa AI chat preview');
  button.setAttribute('aria-expanded','false');
  Object.assign(button.style,{
    position:'fixed',bottom:'18px',right:'16px',padding:'14px 20px',border:0,
    borderRadius:'999px',background:'#7c3aed',color:'#fff',font:'600 14px system-ui,sans-serif',
    cursor:'pointer',zIndex:'2147483647',boxShadow:'0 8px 24px rgba(124,58,237,.35)'
  });
  button.addEventListener('click',function(){
    var open=iframe.style.display==='none';
    iframe.style.display=open?'block':'none';
    button.textContent=open?'Close chat':'Chat with AI';
    button.setAttribute('aria-expanded',String(open));
  });
  document.body.appendChild(iframe);
  document.body.appendChild(button);
})();
