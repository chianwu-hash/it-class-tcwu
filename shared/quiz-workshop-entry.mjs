// No static controller imports: install the canonical import map before navbar
// or any mode initializes auth. Never resolve an arbitrary URL from the query.
const entry = document.querySelector('script[data-workshop-entry]');
try {
  const response = await fetch(entry.dataset.manifest,{signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw Error('練功坊資源未能載入，請重新整理。');
  const manifest = await response.json();
  const map = document.createElement('script'); map.type = 'importmap';
  map.textContent = JSON.stringify({imports:manifest.imports}); document.head.append(map);
  const course = manifest.courses.find(c=>location.pathname.startsWith(c.basePath));
  const mode = entry.dataset.workshopEntry, modules = manifest.entries[mode];
  if (!course || !modules) throw Error('此練功坊入口尚未註冊。');
  document.body.dataset.school = course.school;
  document.body.dataset.course = course.courseId;
  document.body.dataset.workshopNavbarUrl = course.navbar;
  document.body.dataset.workshopNavigation = JSON.stringify(course.navigation);
  if (course.zhuyinImageScale) document.body.dataset.zhuyinImages = 'enlarged';
  // quiz-student retains its local/classroom/cloud navbar lifecycle.
  if (mode !== 'quiz') {
    const script = document.createElement('script');
    script.src = course.navbar; script.dataset.homework = 'true'; script.dataset.quiz = 'true';
    script.dataset.workshopNavigation = JSON.stringify(course.navigation);
    await new Promise((resolve,reject)=>{
      script.onload=resolve; script.onerror=()=>reject(Error('導覽未能載入，請重新整理。'));
      document.querySelector('[data-workshop-navbar]').append(script);
    });
  }
  for (const source of modules) await import(source);
  document.documentElement.dataset.workshopReady = 'true';
} catch (error) {
  const status = document.querySelector('#entry-status,#quiz-lock [role=status],#cloud-identity,#status');
  if (status) status.textContent = error.message;
  document.documentElement.dataset.workshopError = 'true';
  console.error(error);
}
